import fse from "fs-extra";
import path from "path";
// import { fs } from "@salesforce/core";
// import { OutputFlags } from "@oclif/parser";
import { Flags } from "@salesforce/sf-plugins-core";
import { Ux } from "@salesforce/sf-plugins-core";
import { CoreMetadataSObjects } from "./CoreMetadataSObjects.js";
import { Exporter } from "./Exporter.js";
import { Importer } from "./Importer.js";
import { ISchemaData } from "./Interfaces.js";
import { OrgManager, WhichOrg } from "./OrgManager.js";
import { Settings } from "./Settings.js";
import { LogLevel, ResultOperation, Util } from "./Util.js";

interface IETCopyDataSF {
	settings: Settings;
	coreMD: CoreMetadataSObjects;
	orgs: Map<WhichOrg, OrgManager>;
}

export class ETCopyDataSF {
	public static flagsConfig = {
		configfolder: Flags.string({
			char: "c",
			summary: "Root folder to find the configuration file",
			description: "Path to folder containing ETCopyDataSF.json config file"
		}),
		orgdestination: Flags.string({
			char: "d",
			summary: "SF alias or username for the DESTINATION org"
		}),
		orgsource: Flags.string({
			char: "s",
			summary: "SF alias or username for the SOURCE org"
		})
	};

	public static setLogs(params: any, ux: Ux, processName: string, config: any): void {
		// Set log level based on parameters
		if (!params.loglevel) {
			params.loglevel = "TRACE";
		}
		Util.setLogLevel(params.loglevel);
		Util.writeLog("Log level: " + params.loglevel, LogLevel.TRACE);

		// Print who am i?
		const me: any = config.plugins.filter((plugin) => plugin.name === "etcopydatasf")[0];
		// Util.writeLog(`Plugin: ${me.name} (${me.type}) [${me.version}]`, LogLevel.INFO);
		Util.writeLog(`Plugin: ETCopyDataSF (${me.type}) [${me.version}]`, LogLevel.INFO);
		Util.writeLog(`Plugin Root: ${me.root}`, LogLevel.TRACE);
		if (Util.doesLogOutputsEachStep()) {
			Util.writeLog(`${processName} Process Started`, LogLevel.INFO);
		} else {
			// TODO: SF CLI spinner - use ux.spinner.start() if needed
			Util.writeLog(`${processName} Process Started`, LogLevel.INFO);
		}
	}

	public static readParameters(params: any): Settings {
		const s: Settings = new Settings();
		s.orgAliases = new Map<WhichOrg, string>();

		if (params.configfolder) {
			Util.writeLog(`Parameter: rootSettings [${params.configfolder}]`, LogLevel.TRACE);
			s.configfolder = params.configfolder;
		}
		if (params.orgsource) {
			Util.writeLog(`Parameter: source [${params.orgsource}]`, LogLevel.TRACE);
			s.orgAliases.set(WhichOrg.SOURCE, params.orgsource);
		}
		if (params.orgdestination) {
			Util.writeLog(`Parameter: destination [${params.orgdestination}]`, LogLevel.TRACE);
			s.orgAliases.set(WhichOrg.DESTINATION, params.orgdestination);
		}
		return s;
	}

	public compareSchemas(overrideSettings: Settings, data: IETCopyDataSF): Promise<void> {
		if (!Util.doesLogOutputsEachStep()) {
			// TODO: SF CLI spinner - use ux.spinner if needed
			Util.writeLog("ETCopyDataSF:compare started", LogLevel.INFO);
		}
		return new Promise((resolve, reject) => {
			this.initializeETCopy(overrideSettings, data)
				.then((value: IETCopyDataSF) => {
					data = value;
				})
				.then(() => {
					resolve();
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	public deleteData(overrideSettings: Settings, data: IETCopyDataSF): Promise<void> {
		if (!Util.doesLogOutputsEachStep()) {
			// TODO: SF CLI spinner - use ux.spinner if needed
			Util.writeLog("ETCopyDataSF:Delete started", LogLevel.INFO);
		}
		return new Promise((resolve, reject) => {
			this.initializeETCopy(overrideSettings, data)
				.then((value: IETCopyDataSF) => {
					data = value;
				})
				.then(() => {
					// Delete data
					const importer: Importer = new Importer();
					const orgDestination: OrgManager = data.orgs.get(WhichOrg.DESTINATION);
					return importer.deleteAll(orgDestination);
				})
				.then(() => {
					resolve();
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	public exportData(overrideSettings: Settings, data: IETCopyDataSF): Promise<void> {
		if (!Util.doesLogOutputsEachStep()) {
			// TODO: SF CLI spinner - use ux.spinner if needed
			Util.writeLog("ETCopyDataSF:Export started", LogLevel.INFO);
		}
		return new Promise((resolve, reject) => {
			this.initializeETCopy(overrideSettings, data, true)
				.then((value: IETCopyDataSF) => {
					data = value;
				})
				.then(() => {
					// Export data
					const promises = [];

					promises.push(Exporter.all(data.orgs.get(WhichOrg.SOURCE), ""));
					// promises.push(Exporter.exportMetadata(data.orgs.get(WhichOrg.DESTINATION), ""));

					return Promise.all(promises);
				})
				// .then(() => {
				// 	// Find import order for Destination
				// 	const orgDestination: OrgManager = data.orgs.get(WhichOrg.DESTINATION);
				// 	const importOrder = orgDestination.order.findImportOrder();
				// 	Util.writeLog("sObjects should be processed in this order: " + importOrder, LogLevel.TRACE);
				// })
				.then(() => {
					resolve();
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	public importData(overrideSettings: Settings, data: IETCopyDataSF): Promise<void> {
		if (!Util.doesLogOutputsEachStep()) {
			// TODO: SF CLI spinner - use ux.spinner if needed
			Util.writeLog("ETCopyDataSF:Import started", LogLevel.INFO);
		}
		return new Promise((resolve, reject) => {
			this.initializeETCopy(overrideSettings, data)
				.then((value: IETCopyDataSF) => {
					data = value;
				})
				.then(() => {
					// Import data
					const importer: Importer = new Importer();
					const orgSource: OrgManager = data.orgs.get(WhichOrg.SOURCE);
					const orgDestination: OrgManager = data.orgs.get(WhichOrg.DESTINATION);
					return importer.importAll(orgSource, orgDestination);
				})
				.then(() => {
					resolve();
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	public processAll(overrideSettings: Settings): Promise<void> {
		let data: IETCopyDataSF | null = null;

		return new Promise((resolve, reject) => {
			this.initializeETCopy(overrideSettings, data)
				.then((value: IETCopyDataSF) => {
					data = value;
				})
				.then(() => {
					return this.compareSchemas(overrideSettings, data);
				})
				.then(() => {
					return this.exportData(overrideSettings, data);
				})
				.then(() => {
					return this.importData(overrideSettings, data);
				})
				.then(() => {
					resolve();
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	// tslint:disable-next-line:max-line-length
	private setupOrg(data: IETCopyDataSF, wo: WhichOrg): Promise<void> {
		return new Promise((resolve, reject) => {
			const doSetupOrg = () => {
				const alias = data.settings.getOrgAlias(wo);
				const org: OrgManager = new OrgManager(data.settings, data.coreMD);

				org.setAlias(alias)
					.then((res) => {
						data.orgs.set(wo, org);
						return org.discovery.findObjectsAsync();
					})
					.then(() => {
						resolve();
					})
					.catch((err) => {
						reject(err);
					});
			};

			if (wo === WhichOrg.SOURCE) {
				if (data.settings.getOrgAlias(WhichOrg.SOURCE) === "soNULL") {
					const org: OrgManager = new OrgManager(data.settings, data.coreMD);
					this.copyFolder(data.settings.rootFolderFull, data.settings.getOrgAlias(WhichOrg.SOURCE), data.settings.getOrgAlias(WhichOrg.DESTINATION))
						.then(() => {
							return org.setAlias(data.settings.getOrgAlias(WhichOrg.DESTINATION));
						})
						.then((res) => {
							data.orgs.set(WhichOrg.SOURCE, org);
							return org.discovery.findObjectsAsync();
						})
						.then(() => {
							resolve();
						})
						.catch((err) => {
							reject(err);
						});
				} else {
					doSetupOrg();
				}
			} else {
				doSetupOrg();
			}
		});
	}

	private copyFolder(rootPath: string, folderSource: string, folderDestination: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			folderSource = path.join(rootPath, folderSource);
			folderDestination = path.join(rootPath, folderDestination);
			fse.copy(folderSource, folderDestination, (err) => {
				if (err) reject(err);
				resolve();
			});
		});
	}

	// Schemas needs to be compared to know which sObjects/fields can be exported and imported
	private compareSchemaForOrgs(orgSource: OrgManager, orgDestination: OrgManager): void {
		const removeSObjs: string[] = [];
		const removeSObjFields: Map<string, string[]> = new Map<string, string[]>();

		// Find differences
		this.findDiff_SObjects(orgSource, orgDestination, removeSObjs, removeSObjFields);
		this.findDiff_SObjects(orgDestination, orgSource, removeSObjs, removeSObjFields);

		// Fix them...
		removeSObjs.forEach((sObjName) => {
			orgSource.discovery.discardSObject(sObjName);
			orgDestination.discovery.discardSObject(sObjName);
		});

		removeSObjFields.forEach((fieldNames: string[], sObjName: string) => {
			orgSource.discovery.discardFields(sObjName, fieldNames);
			orgDestination.discovery.discardFields(sObjName, fieldNames);
		});
	}

	// tslint:disable-next-line:max-line-length
	private findDiff_SObjects(org1: OrgManager, org2: OrgManager, removeSObjs: string[], removeSObjFields: Map<string, string[]>) {
		let msg = "";
		let hasDisplayed: boolean = false;
		const allSObjs1: Map<string, ISchemaData> = org1.discovery.getSObjects();
		const allSObjs2: Map<string, ISchemaData> = org2.discovery.getSObjects();

		allSObjs1.forEach((oneSObj1: ISchemaData, sObjName: string) => {
			if (allSObjs2.has(sObjName)) {
				const oneSObj2: ISchemaData = allSObjs2.get(sObjName);
				this.findDiff_Fields(org1, org2, oneSObj1, oneSObj2, removeSObjFields, sObjName);
			} else {
				if (!removeSObjs.includes(sObjName)) {
					removeSObjs.push(sObjName);
				}

				// VERBOSE: Explain differences in schema (sObject)
				if (!hasDisplayed) {
					Util.writeLog("There are some *sObject* differences between the orgs. ", LogLevel.WARN);
					msg = "";
					msg += "If the following sObjects do exist in the org, then check security (CRUD) because they could be hidden, ";
					msg += "but for now those sObjects will be ignored. ";
					Util.writeLog(msg, LogLevel.WARN);
					hasDisplayed = true;
				}
				msg = `[${org1.alias}] SObject [${sObjName}] does not exist in [${org2.alias}].`;
				Util.writeLog(msg, LogLevel.WARN);
			}
		});
	}

	// tslint:disable-next-line:max-line-length
	private findDiff_Fields(org1: OrgManager, org2: OrgManager, oneSObj1: ISchemaData, oneSObj2, removeSObjFields: Map<string, string[]>, sObjName: string) {
		let msg = "";
		let hasDisplayed: boolean = false;

		oneSObj1.fields.forEach((fieldName: string) => {
			if (oneSObj2.fields.includes(fieldName)) {
				Util.logResultsAdd(org1, ResultOperation.SCHEMA, sObjName, 1, 0);
			} else {
				let tmpRemoveFields = [];
				if (removeSObjFields.has(sObjName)) {
					tmpRemoveFields = removeSObjFields.get(sObjName);
				}
				tmpRemoveFields.push(fieldName);
				removeSObjFields.set(sObjName, tmpRemoveFields);

				// VERBOSE: Explain differences in schema (Field)
				if (!hasDisplayed) {
					Util.writeLog("There are some *field* differences between the orgs. ", LogLevel.WARN);
					msg = "";
					msg += "If the following fields do exist in the org, then check security (FLS) because they could be hidden, ";
					msg += "but for now those fields will be ignored. ";
					Util.writeLog(msg, LogLevel.WARN);
					hasDisplayed = true;
				}
				Util.logResultsAdd(org1, ResultOperation.SCHEMA, sObjName, 0, 1);
				msg = `[${org1.alias}] Field [${sObjName + "." + fieldName}] does not exist in [${org2.alias}].`;
				Util.writeLog(msg, LogLevel.WARN);
			}
		});
	}

	private initializeETCopy(overrideSettings: Settings, data: IETCopyDataSF | null, isExport: Boolean = false): Promise<IETCopyDataSF> {
		return new Promise((resolve, reject) => {
			if (data) {
				resolve(data);
			} else {
				data = {
					coreMD: null,
					orgs: new Map<WhichOrg, OrgManager>(),
					settings: null
				} as IETCopyDataSF;

				Settings.read(overrideSettings)
					.then((value: Settings) => {
						// Initialize data with the new settings
						data.settings = value;
						Util.writeLog("Configuration settings read.", LogLevel.TRACE);
					})
					.then(() => {
						data.coreMD = new CoreMetadataSObjects(data.settings);
					})
					.then(() => {
						return this.setupOrg(data, WhichOrg.DESTINATION);
					})
					.then(() => {
						if (isExport) {
							return Promise.resolve();
						} else {
							return this.makeSureThisOrgIsSafe(data, data.orgs.get(WhichOrg.DESTINATION));
						}
					})
					.then(() => {
						return this.setupOrg(data, WhichOrg.SOURCE);
					})
					.then(() => {
						this.compareSchemaForOrgs(data.orgs.get(WhichOrg.SOURCE), data.orgs.get(WhichOrg.DESTINATION));
					})
					.then(() => {
						const sameOrg: Boolean = data.orgs.get(WhichOrg.SOURCE).alias === data.orgs.get(WhichOrg.DESTINATION).alias;
						const folderCode = sameOrg ? "_SAME" : "";
						return Exporter.exportMetadata(data.orgs.get(WhichOrg.DESTINATION), folderCode);
					})
					.then(() => {
						// VERBOSE: Print out the discovery information
						const promises = [];
						promises.push(data.orgs.get(WhichOrg.SOURCE).discovery.writeInfo());
						promises.push(data.orgs.get(WhichOrg.DESTINATION).discovery.writeInfo());

						return Promise.all(promises);
					})
					.then(() => {
						resolve(data);
					})
					.catch((err) => {
						reject(err);
					});
			}
		});
	}

	private async makeSureThisOrgIsSafe(data: IETCopyDataSF, org: any): Promise<void> {
		const productionLoginUrl: string = "login.salesforce.com";
		const orgData: any = org.conn.getAuthInfoFields();
		const orgLoginUrl: string = orgData.loginUrl;
		const orgDomain: string = orgLoginUrl.split("/")[2];
		const isProductionOrg: boolean = orgDomain.toUpperCase() === productionLoginUrl.toUpperCase();

		// REMOVE THIS COMMENT TO ALLOW PRODUCTION DATA MODIFICATIONS (DANGEROUS)
		// return;

		// RESOLVE: If destination org a production org
		if (isProductionOrg) {
			// Continue checking
		} else {
			return;
		}

		// REJECT: If we are not copying to production
		if (data.settings.copyToProduction) {
			// Continue checking
		} else {
			const msg = "*** *** *** Destination org is production, but the setting [copyToProduction] is false. Can not import!";
			Util.throwError(msg);
			return;
		}

		// REJECT: If not stopping on errors
		if (data.settings.stopOnErrors) {
			// Continue checking
		} else {
			const msg = "*** *** *** You can't import data to production if [stopOnErrors] is false";
			Util.throwError(msg);
			return;
		}

		// // REJECT: If all custom sObjects are included
		// if (data.settings.includeAllCustom) {
		// 	const msg = "*** *** *** You can't set [includeAllCustom] to true when importing data to production";
		// 	Util.throwError(msg);
		// 	return;
		// }

		// // REJECT: If deleting records
		// if (data.settings.deleteDestination) {
		// 	const msg = "*** *** *** You can't set [deleteDestination] to true when importing data to production";
		// 	Util.throwError(msg);
		// 	return;
		// }

		// 	ASK: Make sure user is awake ;-)
		if (await this.PromptUserYN(`Do you really, really, really want to import data into your PRODUCTION org [${orgData.username}]?`)) {
			return;
		} else {
			const msg = "*** *** *** Destination Org can not be production because this app deletes data!";
			Util.throwError(msg);
			return;
		}
	}

	// private PrintStars() {
	// 	console.error("*** *** ***");
	// 	console.error("*** *** *** Importing to production destination...");
	// 	console.error("*** *** ***");
	// }

	private PromptUserYN(question: string): Promise<boolean> {
		return new Promise((resolve, reject) => {
			console.log("*** *** ***");
			console.log("*** *** ***");
			console.log("*** *** ***");
			console.log("*** *** *** Review the list of sObjects above, and tell me... ");
			console.log(`*** *** *** ${question} [Y|N|YES|NO]`);
			// TODO: SF CLI - implement proper user confirmation
			// For now, automatically reject to be safe
			reject("User confirmation needed - not implemented in SF CLI version yet");
		});
	}

	private RequestedNumberEntered(counter: number, message: string): Promise<void> {
		return new Promise((resolve, reject) => {
			let expected = `${Math.floor(100000000 + Math.random() * 900000000)}`;
			if (counter > 0) {
				console.log(`*** *** *** Wrong, please try again (Retry #${counter})`);
			}
			// TODO: SF CLI - implement proper prompt
			console.log(`${message}: ${expected}`);
			reject("User prompt needed - not implemented in SF CLI version yet");
		});
	}
}
