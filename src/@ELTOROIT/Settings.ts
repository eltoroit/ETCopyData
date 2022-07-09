import * as fsPromises from "fs/promises";
import mkdirp from "mkdirp";
import { ConfigContents, ConfigFile } from "@salesforce/core";
import { AnyJson, Dictionary } from "@salesforce/ts-types";
import { WhichOrg } from "./OrgManager";
import { LogLevel, Util } from "./Util";

/*
How to add a new entry in the config file?
- Add an entry to the ISettingsValues interface.
- Implement the field in this class.
- Read the value in processFile() (Search for // TODO: UPDATE SETTINGS HERE: READ!)
- Write the field in valuesToWrite(); (Search for // TODO: UPDATE SETTINGS HERE: WRITE!)
- Values get initialized here: resetValues()
*/

// NOTE: Private, used for extending below (not for used in other code)
interface ISettingsSObjectBase {
	name: string;
	orderBy: string;
	where: string;
}

// NOTE: Data in the configuration file
export interface ISettingsSObjectData extends ISettingsSObjectBase {
	ignoreFields: string | string[];
	twoPassReferenceFields: string | string[];
	externalIdField: string;
}

// NOTE: Metadata in the configuration file
export interface ISettingsSObjectMetatada extends ISettingsSObjectBase {
	matchBy: string;
	fieldsToExport: string | string[];
}

// NOTE: Full configuration file
export interface ISettingsValues {
	isValid: boolean;
	orgAliases: Map<WhichOrg, string>;
	sObjectsDataRaw: Map<string, ISettingsSObjectData>;
	sObjectsMetadataRaw: Map<string, ISettingsSObjectMetatada>;
	includeAllCustom: boolean;
	stopOnErrors: boolean;
	copyToProduction: boolean;
	customObjectsToIgnoreRaw: string;
	ignoreFieldsRaw: string;
	twoPassReferenceFieldsRaw: string;
	deleteDestination: boolean;
	// LEARNING: Salesforce default is 10,000
	pollingTimeout: number;
	rootFolderRaw: string;
}

export class Settings implements ISettingsValues {
	public static read(overrideSettings: Settings): Promise<Settings> {
		return new Promise((resolve, reject) => {
			this.readCounter++;
			Util.assertEquals(1, this.readCounter, "Reading settings more than once!");
			const s: Settings = new Settings();
			s.resetValues();
			s.readAll(overrideSettings)
				.then((value: Settings) => {
					return s.write();
				})
				.then((value) => {
					resolve(s);
				})
				.catch((err) => {
					reject(err);
				});
		});
	}
	private static readCounter: number = 0;

	public isValid: boolean;
	public orgAliases: Map<WhichOrg, string>;
	public sObjectsDataRaw: Map<string, ISettingsSObjectData>;
	public sObjectsMetadataRaw: Map<string, ISettingsSObjectMetatada>;
	public ignoreFieldsRaw: string;
	public twoPassReferenceFieldsRaw: string;
	public includeAllCustom: boolean;
	public stopOnErrors: boolean;
	public copyToProduction: boolean;
	public customObjectsToIgnoreRaw: string;
	public customObjectsToIgnore: string[];
	public deleteDestination: boolean;
	public pollingTimeout: number;
	public rootFolderRaw: string;
	public rootFolderFull: string;
	public configfolder: string;

	// Local private variables
	private configFile: ConfigFile<ConfigFile.Options> = null;
	private blankSObjectData: ISettingsSObjectData = null;
	private sObjectNames: Map<boolean, string[]> = new Map<boolean, string[]>();

	public getRequestedSObjectNames(isMD: boolean): string[] {
		let output: string[] = [];

		if (this.sObjectNames.has(isMD)) {
			// Lazy loading
			output = this.sObjectNames.get(isMD);
		} else {
			let map: Map<string, any>;
			output = [];

			if (isMD) {
				map = this.sObjectsMetadataRaw;
			} else {
				map = this.sObjectsDataRaw;
			}

			map.forEach((value, key) => {
				output.push(key);
			});

			this.sObjectNames.set(isMD, output);
		}

		return output;
	}

	public getSObjectData(sObjName: string): ISettingsSObjectData {
		let output: ISettingsSObjectData;

		if (this.getRequestedSObjectNames(false).includes(sObjName)) {
			output = this.sObjectsDataRaw.get(sObjName);

			/* HACK: START
			Since the (ignoreFields, fieldsToExport) fields can have multiple interpretations
			... string is written to the file
			... string[] is used internally
			I want to handle clone it, to avoid overriding by reference
			Possible solutions to avoid hack:
			- Use different variable names, but since I want to implement an interface it can't be private
			- Have the interface be the array and then a *Raw to be the string
			*/
			output = JSON.parse(JSON.stringify(output));
			// HACK: END

			// Fix fields
			output.ignoreFields = Util.mergeAndCleanArrays(output.ignoreFields as string, this.ignoreFieldsRaw);
			output.twoPassReferenceFields = Util.mergeAndCleanArrays(output.twoPassReferenceFields as string, this.twoPassReferenceFieldsRaw);
		} else {
			output = this.getBlankSObjectData(sObjName);
		}

		return output;
	}

	public getSObjectMetadata(sObjName: string): ISettingsSObjectMetatada {
		let output: ISettingsSObjectMetatada = this.sObjectsMetadataRaw.get(sObjName);

		/* HACK: START
		Since the (ignoreFields, fieldsToExport) fields can have multiple interpretations
		... string is written to the file
		... string[] is used internally
		I want to handle clone it, to avoid overriding by reference
		Possible solutions to avoid hack:
		- Use different variable names, but since I want to implement an interface it can't be private
		- Have the interface be the array and then a *Raw to be the string
		*/
		output = JSON.parse(JSON.stringify(output));
		// HACK: END

		// Fix fields
		output.fieldsToExport = Util.mergeAndCleanArrays(output.fieldsToExport as string, "Id, " + output.matchBy);

		return output;
	}

	public getOrgAlias(wo: WhichOrg): string {
		return this.orgAliases.get(wo);
	}

	public writeToFile(path: string, fileName: string, data: object): Promise<void> {
		// VERBOSE: make files human readable
		const isVerbose: boolean = true;

		return new Promise((resolve, reject) => {
			const fullPath = this.rootFolderFull + `/${path}`;
			mkdirp(fullPath)
				.then(() => {
					let strData = "";
					if (isVerbose) {
						// LEARNING: [JSON]: Prettyfy JSON.
						strData = JSON.stringify(data, null, "	");
					} else {
						strData = JSON.stringify(data);
					}

					fsPromises
						.writeFile(fullPath + `/${fileName}`, strData)
						.then(() => {
							resolve();
						})
						.catch((err) => {
							reject(err);
						});
				})
				.catch((err) => reject(err));
		});
	}

	public readFromFile(path: string, fileName: string): Promise<object> {
		return new Promise((resolve, reject) => {
			const fullPath = this.rootFolderFull + `/${path}`;
			mkdirp(fullPath)
				.then(() => {
					fsPromises
						.readFile(fullPath + `/${fileName}`)
						.then((value: Buffer) => {
							resolve(JSON.parse(value.toString()));
						})
						.catch((err) => {
							reject(err);
						});
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	private readAll(overrideSettings: Settings): Promise<Settings> {
		let path: string;

		return new Promise((resolve, reject) => {
			// This has to be done in serial mode, so chain the requests...
			// LEARNING: [PROMISES]: Promises running in serial mode. the next block can't start before the previous finishes.
			this.openConfigFile(overrideSettings.configfolder)
				.then((resfile: ConfigFile<ConfigFile.Options>) => {
					this.configFile = resfile;
					// LEARNING: [PROMISES]: Remember to return the method that throws a promise.
					return resfile.exists();
				})
				.then((fileExists) => {
					if (fileExists) {
						return this.processFile(overrideSettings);
					} else {
						this.isValid = false;
						path = this.configFile.getPath();
						this.write()
							.then(() => {
								Util.throwError(`Configuration file [${path}] did not exist and was created with default values. " +
									"Please fix it and run again`);
							})
							.catch((err) => {
								reject(err);
							});
					}
				})
				.then(() => {
					resolve(this);
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	private getDataFolder(readFolder: string, overrideSettings: Settings): Promise<string> {
		return new Promise((resolve, reject) => {
			// Make folder
			const overrideFolder = overrideSettings.configfolder;
			if (!readFolder) {
				readFolder = "ETCopyData";
			}
			this.rootFolderRaw = readFolder;
			this.rootFolderFull = this.rootFolderRaw;

			if (overrideFolder) {
				if (!readFolder.startsWith(overrideFolder)) {
					this.rootFolderFull = overrideFolder + "/" + readFolder;
				}
			}

			mkdirp(this.rootFolderFull)
				.then((value) => {
					let path: string = "";
					path = this.rootFolderFull;

					// VERBOSE: Create sub-folders based on time so files do not override
					// path += `/${Util.getWallTime(true)}`;

					mkdirp(path)
						.then(() => {
							this.rootFolderFull = path;
							resolve(this.rootFolderFull);
						})
						.catch((err) => reject(err));
				})
				.catch((err) => reject(err));
		});
	}

	// TODO: UPDATE SETTINGS HERE: READ!
	private processFile(overrideSettings: Settings): Promise<Settings> {
		return new Promise((resolve, reject) => {
			this.isValid = true;
			this.configFile
				.read()
				.then((resValues: Dictionary<AnyJson>) => {
					// This can be done in parallel mode, so use an array of promises and wait for all of them to complete at the end
					let msg: string = "";
					let overridenValue: string = "";

					const promises = [];

					// Source Org
					overridenValue = overrideSettings.orgAliases.get(WhichOrg.SOURCE);
					if (overridenValue) {
						this.orgAliases.set(WhichOrg.SOURCE, overridenValue);
						msg = `Configuration value for [${WhichOrg.SOURCE}]: ${overridenValue} (read from command line)`;
						Util.writeLog(msg, LogLevel.INFO);
					} else {
						promises.push(
							this.processStringValues(resValues, WhichOrg.SOURCE, true).then((value: string) => {
								this.orgAliases.set(WhichOrg.SOURCE, value);
								msg = `Configuration value for [${WhichOrg.SOURCE}]: ${value}`;
								Util.writeLog(msg, LogLevel.INFO);
							})
						);
					}

					// Destination Org
					overridenValue = overrideSettings.orgAliases.get(WhichOrg.DESTINATION);
					if (overridenValue) {
						this.orgAliases.set(WhichOrg.DESTINATION, overridenValue);
						msg = `Configuration value for [${WhichOrg.DESTINATION}]: ${overridenValue} (read from command line)`;
						Util.writeLog(msg, LogLevel.INFO);
					} else {
						promises.push(
							this.processStringValues(resValues, WhichOrg.DESTINATION, true).then((value: string) => {
								this.orgAliases.set(WhichOrg.DESTINATION, value);
								msg = `Configuration value for [${WhichOrg.DESTINATION}]: ${value}`;
								Util.writeLog(msg, LogLevel.INFO);
							})
						);
					}

					// sObjectsData
					promises.push(
						this.processsObjectsValues(resValues, "sObjectsData", true).then(() => {
							msg = `Configuration value for [sObjectsData]: ${this.sObjectsDataRaw.size} sObjects explicitly mentioned.`;
							Util.writeLog(msg, LogLevel.INFO);
						})
					);

					// sObjectsMetadata
					promises.push(
						this.processsObjectsValues(resValues, "sObjectsMetadata", true).then(() => {
							msg = `Configuration value for [sObjectsMetadata]: ${this.sObjectsMetadataRaw.size} sObjects explicitly mentioned.`;
							Util.writeLog(msg, LogLevel.INFO);
						})
					);

					// includeAllCustom
					promises.push(
						this.processStringValues(resValues, "includeAllCustom", false).then((value: string) => {
							this.includeAllCustom = value === "true";
							msg = `Configuration value for [includeAllCustom]: ${this.includeAllCustom}`;
							Util.writeLog(msg, LogLevel.INFO);
						})
					);

					// stopOnErrors
					promises.push(
						this.processStringValues(resValues, "stopOnErrors", false).then((value: string) => {
							this.stopOnErrors = value === "true";
							msg = `Configuration value for [stopOnErrors]: ${this.stopOnErrors}`;
							Util.writeLog(msg, LogLevel.INFO);
						})
					);

					// copyToProduction
					promises.push(
						this.processStringValues(resValues, "copyToProduction", false).then((value: string) => {
							this.copyToProduction = value === "true";
							msg = `Configuration value for [copyToProduction]: ${this.copyToProduction}`;
							Util.writeLog(msg, LogLevel.INFO);
						})
					);

					// customObjectsToIgnore
					promises.push(
						this.processStringValues(resValues, "customObjectsToIgnore", false).then((value: string) => {
							this.customObjectsToIgnoreRaw = value;
							this.customObjectsToIgnore = Util.mergeAndCleanArrays(this.customObjectsToIgnoreRaw, this.customObjectsToIgnoreRaw);
							msg = `Configuration value for [customObjectsToIgnore]: ${this.customObjectsToIgnoreRaw}`;
							Util.writeLog(msg, LogLevel.INFO);
						})
					);

					// rootFolder
					promises.push(
						this.processStringValues(resValues, "rootFolder", false)
							.then((value: string) => {
								return this.getDataFolder(value, overrideSettings);
							})
							.then((value) => {
								msg = `Configuration value for [rootFolder]: ${value}`;
								Util.writeLog(msg, LogLevel.INFO);
							})
					);

					// ignoreFields
					promises.push(
						this.processStringValues(resValues, "ignoreFields", false).then((value: string) => {
							this.ignoreFieldsRaw = value;
							msg = `Configuration value for [ignoreFields]: ${this.ignoreFieldsRaw}`;
							Util.writeLog(msg, LogLevel.INFO);
						})
					);

					// twoPassReferenceFields
					promises.push(
						this.processStringValues(resValues, "twoPassReferenceFields", false).then((value: string) => {
							this.twoPassReferenceFieldsRaw = value;
							msg = `Configuration value for [twoPassReferenceFields]: ${this.twoPassReferenceFieldsRaw}`;
							Util.writeLog(msg, LogLevel.INFO);
						})
					);

					// deleteDestination
					promises.push(
						this.processStringValues(resValues, "deleteDestination", false).then((value: string) => {
							this.deleteDestination = value === "true";
							msg = `Configuration value for [deleteDestination]: ${this.deleteDestination}`;
							Util.writeLog(msg, LogLevel.INFO);
						})
					);

					// pollingTimeout
					promises.push(
						this.processStringValues(resValues, "pollingTimeout", false).then((value: string) => {
							this.pollingTimeout = parseInt(value, 10);
							const sec = this.pollingTimeout / 1000;
							const min = sec / 60;
							msg = `Configuration value for [pollingTimeout]: ${this.pollingTimeout} milliseconds (${min} minutes)`;
							Util.writeLog(msg, LogLevel.INFO);
						})
					);

					Promise.all(promises)
						.then(() => {
							resolve(this);
						})
						.catch((err) => {
							reject(err);
						});
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	private processStringValues(resValues, entryName: string, isRequired: boolean): Promise<string> {
		return new Promise((resolve, reject) => {
			let valueStr = "";
			const value = resValues[entryName];

			if (value) {
				if (value == null) {
					valueStr = null;
				} else {
					valueStr = value.toString();
				}
				resolve(valueStr);
			} else {
				// eslint-disable-next-line no-lonely-if
				if (isRequired) {
					this.isValid = false;
					reject("Config file does not have an entry for [" + entryName + "]");
				} else {
					resolve(null);
				}
			}
		});
	}

	private processsObjectsValues(resValues, entryName: string, isRequired: boolean): Promise<void> {
		return new Promise((resolve, reject) => {
			const sObjects = resValues[entryName];

			if (sObjects) {
				if (sObjects == null) {
					if (isRequired) {
						this.isValid = false;
						reject("Config file has an entry for [" + entryName + "], but it's null");
					} else {
						this[entryName] = new Map();
						resolve(null);
					}
				} else {
					sObjects.forEach((sObject: any) => {
						if (entryName === "sObjectsData") {
							this.processsObjectsDataValue(sObject);
						} else if (entryName === "sObjectsMetadata") {
							this.processsObjectsMetadataValue(sObject);
						} else {
							reject("Config file does not have an entry for [" + entryName + "]");
						}
					});
					resolve(null);
				}
			} else {
				// eslint-disable-next-line no-lonely-if
				if (isRequired) {
					this.isValid = false;
					reject("Config file does not have an entry for [" + entryName + "]");
				} else {
					this[entryName] = new Map();
					resolve(null);
				}
			}
		});
	}

	private processsObjectsDataValue(sObject: any): void {
		const sObjName = sObject.name;

		const newValue: ISettingsSObjectData = {
			name: sObjName,
			ignoreFields: null,
			externalIdField: null,
			twoPassReferenceFields: null,
			where: null,
			orderBy: null
		};
		// LEARNING: [OBJECT]: How to loop through the values of an JSON object, which is not a Typescript Map.
		Object.keys(sObject).forEach((key) => {
			newValue[key] = sObject[key];
		});
		this.sObjectsDataRaw.set(sObjName, newValue);
	}

	private processsObjectsMetadataValue(sObject: any): void {
		const sObjName = sObject.name;

		const newValue: ISettingsSObjectMetatada = {
			name: sObjName,
			matchBy: null,
			fieldsToExport: "",
			where: null,
			orderBy: null
		};
		Object.keys(sObject).forEach((key) => {
			newValue[key] = sObject[key];
		});
		if (!newValue.matchBy) {
			throw new Error(`'${sObject.name}' section must have a 'matchBy' for fields to match`);
		}
		this.sObjectsMetadataRaw.set(sObjName, newValue);
	}

	private openConfigFile(configfolder: string): Promise<ConfigFile<ConfigFile.Options>> {
		this.configfolder = configfolder;
		if (!this.configfolder) {
			this.configfolder = ".";
		}
		return ConfigFile.create({
			filename: "ETCopyData.json",
			isGlobal: false,
			isState: false,
			rootFolder: this.configfolder
		});
	}

	private write(): Promise<object> {
		return this.configFile.write(this.valuesToWrite());
	}

	// TODO: UPDATE SETTINGS HERE: WRITE!
	private valuesToWrite(): ConfigContents {
		const output: ConfigContents = {};

		// VERBOSE: Print debug time in output file so files do get changed, and we know we are looking at the right file.
		// Do not update timestamp
		// output.now = toAnyJson(new Date().toJSON());

		// Output regular data
		output[WhichOrg.SOURCE] = this.orgAliases.get(WhichOrg.SOURCE);
		output[WhichOrg.DESTINATION] = this.orgAliases.get(WhichOrg.DESTINATION);
		output.sObjectsData = this.valuesToWriteForSobjectMap(false);
		output.sObjectsMetadata = this.valuesToWriteForSobjectMap(true);
		output.rootFolder = this.rootFolderRaw;
		output.includeAllCustom = this.includeAllCustom;
		output.customObjectsToIgnore = this.customObjectsToIgnoreRaw;
		output.stopOnErrors = this.stopOnErrors;
		output.ignoreFields = this.ignoreFieldsRaw;
		output.copyToProduction = this.copyToProduction;
		output.twoPassReferenceFields = this.twoPassReferenceFieldsRaw;
		output.deleteDestination = this.deleteDestination;
		output.pollingTimeout = this.pollingTimeout;

		return output;
	}

	private valuesToWriteForSobjectMap(isMD: boolean): any[] {
		// VERBOSE: Print all the merged fields, or the original file?
		const isVerbose: boolean = true;

		const outputAllSObjects = [];
		this.getRequestedSObjectNames(isMD).forEach((sObjName) => {
			let sObj;
			const outputOneSObject: any = {};

			if (isVerbose) {
				if (isMD) {
					sObj = this.getSObjectMetadata(sObjName);
				} else {
					sObj = this.getSObjectData(sObjName);
				}
			} else {
				// eslint-disable-next-line no-lonely-if
				if (isMD) {
					sObj = this.sObjectsMetadataRaw.get(sObjName);
				} else {
					sObj = this.sObjectsDataRaw.get(sObjName);
				}
			}

			outputOneSObject.name = sObjName;
			Object.keys(sObj).forEach((fieldName) => {
				let isSkip = false;
				let value = sObj[fieldName];

				if (isVerbose) {
					if (["ignoreFields", "twoPassReferenceFields", "fieldsToExport"].includes(fieldName)) {
						value = value.toString();
					}
				} else {
					// Only perform these checks if it's not verbose mode
					isSkip = isSkip || value === null;
				}

				if (!isSkip) {
					outputOneSObject[fieldName] = value;
				}
			});

			outputAllSObjects.push(outputOneSObject);
		});
		return outputAllSObjects;
	}

	private resetValues(): void {
		this.isValid = false;

		this.orgAliases = new Map<WhichOrg, string>();
		this.orgAliases.set(WhichOrg.SOURCE, null);
		this.orgAliases.set(WhichOrg.DESTINATION, null);

		this.sObjectsDataRaw = new Map<string, ISettingsSObjectData>();
		this.sObjectsMetadataRaw = new Map<string, ISettingsSObjectMetatada>();

		this.rootFolderRaw = null;
		this.includeAllCustom = false;
		this.stopOnErrors = true;
		this.copyToProduction = false;
		this.customObjectsToIgnoreRaw = null;
		this.ignoreFieldsRaw = null;
		this.twoPassReferenceFieldsRaw = null;
		this.deleteDestination = false;
		this.pollingTimeout = 100000;
	}

	private getBlankSObjectData(sObjName: string): ISettingsSObjectData {
		let output: ISettingsSObjectData = this.blankSObjectData;

		if (output === null) {
			output = {
				name: null,
				externalIdField: null,
				twoPassReferenceFields: Util.mergeAndCleanArrays(this.twoPassReferenceFieldsRaw, ""),
				ignoreFields: Util.mergeAndCleanArrays(this.ignoreFieldsRaw, ""),
				where: null,
				orderBy: null
			};
			this.blankSObjectData = output;
		}

		output.name = sObjName;
		return output;
	}
}
