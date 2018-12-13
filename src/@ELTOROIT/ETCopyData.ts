import { UX } from "@salesforce/command";
import { CoreMetadataSObjects } from "./CoreMetadataSObjects";
import { Exporter } from "./Exporter";
import { Importer } from "./Importer";
import { ISchemaData } from "./Interfaces";
import { OrgManager, WhichOrg } from "./OrgManager";
import { Settings } from "./Settings";
import { LogLevel, ResultOperation, Util } from "./Util";

interface IETCopyData {
	settings: Settings;
	coreMD: CoreMetadataSObjects;
	orgs: Map<WhichOrg, OrgManager>;
}

export class ETCopyData {
	public compareSchemas(data: IETCopyData = null): Promise<void> {
		if (!Util.doesLogOutputsEachStep()) {
			UX.create()
				.then((ux) => {
					ux.startSpinner("ETCopyData:Compare");
				})
				.catch((err) => { Util.throwError(err); });
		}
		return new Promise((resolve, reject) => {
			this.initializeETCopy(data)
				.then((value: IETCopyData) => {
					data = value;
				})
				.then(() => {
					resolve();
				})
				.catch((err) => { Util.throwError(err); });
		});
	}

	public deleteData(data: IETCopyData = null): Promise<void> {
		if (!Util.doesLogOutputsEachStep()) {
			UX.create()
				.then((ux) => {
					ux.startSpinner("ETCopyData:Delete");
				})
				.catch((err) => { Util.throwError(err); });
		}
		return new Promise((resolve, reject) => {
			this.initializeETCopy(data)
				.then((value: IETCopyData) => {
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
				.catch((err) => { Util.throwError(err); });
		});
	}

	public exportData(data: IETCopyData = null): Promise<void> {
		if (!Util.doesLogOutputsEachStep()) {
			UX.create()
				.then((ux) => {
					ux.startSpinner("ETCopyData:Export");
				})
				.catch((err) => { Util.throwError(err); });
		}
		return new Promise((resolve, reject) => {
			this.initializeETCopy(data)
				.then((value: IETCopyData) => {
					data = value;
				})
				.then(() => {
					// Export data
					const promises = [];

					promises.push(Exporter.all(data.orgs.get(WhichOrg.SOURCE), ""));
					promises.push(Exporter.exportMetadata(data.orgs.get(WhichOrg.DESTINATION), ""));

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
				.catch((err) => { Util.throwError(err); });
		});
	}

	public importData(data: IETCopyData = null): Promise<void> {
		if (!Util.doesLogOutputsEachStep()) {
			UX.create()
				.then((ux) => {
					ux.startSpinner("ETCopyData:Import");
				})
				.catch((err) => { Util.throwError(err); });
		}
		return new Promise((resolve, reject) => {
			this.initializeETCopy(data)
				.then((value: IETCopyData) => {
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
				.catch((err) => { Util.throwError(err); });
		});
	}

	public processAll(): Promise<void> {
		let data: IETCopyData = null;

		return new Promise((resolve, reject) => {
			this.initializeETCopy(data)
				.then((value: IETCopyData) => {
					data = value;
				})
				.then(() => {
					return this.compareSchemas(data);
				})
				.then(() => {
					return this.exportData(data);
				})
				.then(() => {
					return this.importData(data);
				})
				.then(() => {
					resolve();
				})
				.catch((err) => { Util.throwError(err); });
		});
	}

	// tslint:disable-next-line:max-line-length
	private setupOrg(data: IETCopyData, wo: WhichOrg): Promise<void> {
		return new Promise((resolve, reject) => {
			const alias = data.settings.getOrgAlias(wo);
			const org: OrgManager = new OrgManager(data.settings, data.coreMD);

			org.setAlias(alias)
				.then((res) => {
					data.orgs.set(wo, org);
					return org.discovery.findObjectsAsync();
				})
				.then(() => { resolve(); })
				.catch((err) => { Util.throwError(err); });
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
					Util.writeLog("There are some field differences between the orgs. ", LogLevel.WARN);
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
					Util.writeLog("There are some field differences between the orgs. ", LogLevel.WARN);
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

	private initializeETCopy(data: IETCopyData = null): Promise<IETCopyData> {
		return new Promise((resolve, reject) => {
			if (data) {
				resolve(data);
			} else {
				data = {
					coreMD: null,
					orgs: new Map<WhichOrg, OrgManager>(),
					settings: null,
				};

				Settings.read()
					.then((value: Settings) => {
						// Initialize data with the new settings
						data.settings = value;
						Util.writeLog("Configuration settings read.", LogLevel.TRACE);
					})
					.then(() => {
						data.coreMD = new CoreMetadataSObjects(data.settings);
					})
					.then(() => {
						return this.setupOrg(data, WhichOrg.SOURCE);
					})
					.then(() => {
						return this.setupOrg(data, WhichOrg.DESTINATION);
					})
					.then(() => {
						this.makeSureThisOrgIsSafe(data.orgs.get(WhichOrg.DESTINATION));
					})
					.then(() => {
						this.compareSchemaForOrgs(data.orgs.get(WhichOrg.SOURCE), data.orgs.get(WhichOrg.DESTINATION));
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
					.catch((err) => { Util.throwError(err); });
			}
		});
	}

	private makeSureThisOrgIsSafe(org: any): Promise<void> {
		const productionLoginUrl: string = "login.salesforce.com";
		const orgLoginUrl: string = org.conn.getAuthInfoFields().loginUrl;
		const orgDomain: string = orgLoginUrl.split("/")[2];
		const isValidOrg: boolean = orgDomain.toUpperCase() !== productionLoginUrl.toUpperCase();

		if (!isValidOrg) {
			const msg = "Destination Org can not be production because this app deletes data!";
			Util.writeLog(msg, LogLevel.FATAL);
			Util.throwError(msg);
		}
	}
}
