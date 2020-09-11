import { ConfigContents, ConfigFile, fs } from "@salesforce/core";
import { AnyJson, Dictionary, toAnyJson } from "@salesforce/ts-types";
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
	maxRecords: number;
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
	ignoreFieldsRaw: string;
	twoPassReferenceFieldsRaw: string;
	maxRecordsEachRaw: number;
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
	public maxRecordsEachRaw: number;
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
			if (this.maxRecordsEachRaw > 0 && output.maxRecords === -1) {
				output.maxRecords = this.maxRecordsEachRaw;
			}
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
			fs.mkdirp(fullPath).then(() => {
				let strData = "";
				if (isVerbose) {
					// LEARNING: [JSON]: Prettyfy JSON.
					strData = JSON.stringify(data, null, "	");
				} else {
					strData = JSON.stringify(data);
				}

				fs.writeFile(fullPath + `/${fileName}`, strData)
					.then(() => {
						resolve();
					})
					.catch((err) => {
						reject(err);
					});
			});
		});
	}

	public readFromFile(path: string, fileName: string): Promise<object> {
		return new Promise((resolve, reject) => {
			const fullPath = this.rootFolderFull + `/${path}`;
			fs.mkdirp(fullPath)
				.then(() => {
					fs.readFile(fullPath + `/${fileName}`)
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
				if (readFolder.indexOf(overrideFolder) !== 0) {
					this.rootFolderFull = overrideFolder + "/" + readFolder;
				}
			}

			fs.mkdirp(this.rootFolderFull).then(() => {
				let path: string = "";
				path = this.rootFolderFull;

				// VERBOSE: Create sub-folders based on time so files do not override
				// path += `/${Util.getWallTime(true)}`;

				fs.mkdirp(path).then(() => {
					this.rootFolderFull = path;
					resolve(this.rootFolderFull);
				});
			});
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
						msg = `Configuration value for [${WhichOrg.SOURCE}] read from command line: ${overridenValue}`;
						this.orgAliases.set(WhichOrg.SOURCE, overridenValue);
						Util.writeLog(msg, LogLevel.INFO);
					} else {
						promises.push(
							this.processStringValues(resValues, WhichOrg.SOURCE, true).then((value: string) => {
								this.orgAliases.set(WhichOrg.SOURCE, value);
							})
						);
					}

					// Destination Org
					overridenValue = overrideSettings.orgAliases.get(WhichOrg.DESTINATION);
					if (overridenValue) {
						msg = `Configuration value for [${WhichOrg.DESTINATION}] read from command line: ${overridenValue}`;
						this.orgAliases.set(WhichOrg.DESTINATION, overridenValue);
						Util.writeLog(msg, LogLevel.INFO);
					} else {
						promises.push(
							this.processStringValues(resValues, WhichOrg.DESTINATION, true).then((value: string) => {
								this.orgAliases.set(WhichOrg.DESTINATION, value);
							})
						);
					}

					// sObjectsData
					promises.push(
						this.processsObjectsValues(resValues, "sObjectsData", true).then(() => {
							msg = `Configuration value for [sObjectsData]: ${this.sObjectsDataRaw.size} sObjects found.`;
							Util.writeLog(msg, LogLevel.INFO);
						})
					);

					// sObjectsMetadata
					promises.push(
						this.processsObjectsValues(resValues, "sObjectsMetadata", true).then(() => {
							msg = `Configuration value for [sObjectsMetadata]: ${this.sObjectsMetadataRaw.size} sObjects found.`;
							Util.writeLog(msg, LogLevel.INFO);
						})
					);

					// includeAllCustom
					promises.push(
						this.processStringValues(resValues, "includeAllCustom", false).then((value: string) => {
							this.includeAllCustom = value === "true";
						})
					);

					// stopOnErrors
					promises.push(
						this.processStringValues(resValues, "stopOnErrors", false).then((value: string) => {
							this.stopOnErrors = value === "true";
						})
					);

					// copyToProduction
					promises.push(
						this.processStringValues(resValues, "copyToProduction", false).then((value: string) => {
							this.copyToProduction = value === "true";
						})
					);

					// rootFolder
					promises.push(
						this.processStringValues(resValues, "rootFolder", false)
							.then((value: string) => {
								return this.getDataFolder(value, overrideSettings);
							})
							.then(() => {
								//
							})
					);

					// ignoreFields
					promises.push(
						this.processStringValues(resValues, "ignoreFields", false).then((value: string) => {
							this.ignoreFieldsRaw = value;
						})
					);

					// twoPassReferenceFields
					promises.push(
						this.processStringValues(resValues, "twoPassReferenceFields", false).then((value: string) => {
							this.twoPassReferenceFieldsRaw = value;
						})
					);

					// maxRecordsEach
					promises.push(
						this.processStringValues(resValues, "maxRecordsEach", false)
							// LEARNING: Parsing a string into a number, 10 is for the base (16 for hex)
							.then((value: string) => {
								this.maxRecordsEachRaw = parseInt(value, 10);
							})
					);

					// deleteDestination
					promises.push(
						this.processStringValues(resValues, "deleteDestination", false).then((value: string) => {
							this.deleteDestination = value === "true";
						})
					);

					// pollingTimeout
					promises.push(
						this.processStringValues(resValues, "pollingTimeout", false).then((value: string) => {
							this.pollingTimeout = parseInt(value, 10);
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
				Util.writeLog("Configuration value for [" + entryName + "]: " + valueStr, LogLevel.INFO);
				resolve(valueStr);
			} else {
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
			ignoreFields: null,
			twoPassReferenceFields: null,
			maxRecords: -1,
			name: sObjName,
			orderBy: null,
			where: null,
			externalIdField: null
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
			fieldsToExport: null,
			matchBy: null,
			name: sObjName,
			orderBy: null,
			where: null
		};
		Object.keys(sObject).forEach((key) => {
			newValue[key] = sObject[key];
		});
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
		output.now = toAnyJson(new Date().toJSON());

		// Output regular data
		output[WhichOrg.SOURCE] = this.orgAliases.get(WhichOrg.SOURCE);
		output[WhichOrg.DESTINATION] = this.orgAliases.get(WhichOrg.DESTINATION);
		output.sObjectsData = this.valuesToWriteForSobjectMap(false);
		output.sObjectsMetadata = this.valuesToWriteForSobjectMap(true);
		output.rootFolder = this.rootFolderRaw;
		output.includeAllCustom = this.includeAllCustom;
		output.stopOnErrors = this.stopOnErrors;
		output.ignoreFields = this.ignoreFieldsRaw;
		output.copyToProduction = this.copyToProduction;
		output.twoPassReferenceFields = this.twoPassReferenceFieldsRaw;
		output.maxRecordsEach = this.maxRecordsEachRaw;
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
				if (isMD) {
					sObj = this.sObjectsMetadataRaw.get(sObjName);
				} else {
					sObj = this.sObjectsDataRaw.get(sObjName);
				}
			}

			outputOneSObject.name = sObjName;
			Object.keys(sObj)
				.sort()
				.forEach((fieldName) => {
					let isSkip = false;
					let value = sObj[fieldName];

					if (isVerbose) {
						if (["ignoreFields", "twoPassReferenceFields", "fieldsToExport"].includes(fieldName)) {
							value = value.toString();
						}
					} else {
						// Only perform these checks if it's not verbose mode
						isSkip = isSkip || value === null;
						isSkip = isSkip || (fieldName === "maxRecords" ? value === -1 : false);
					}

					if (!isSkip) {
						outputOneSObject[fieldName] = value;
					}
				});

			outputAllSObjects.push(outputOneSObject);
		});
		return outputAllSObjects;
	}

	private resetValues() {
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
		this.ignoreFieldsRaw = null;
		this.twoPassReferenceFieldsRaw = null;
		this.maxRecordsEachRaw = -1;
		this.deleteDestination = false;
		this.pollingTimeout = 100000;
	}

	private getBlankSObjectData(sObjName: string): ISettingsSObjectData {
		let output: ISettingsSObjectData = this.blankSObjectData;

		if (output === null) {
			output = {
				ignoreFields: Util.mergeAndCleanArrays(this.ignoreFieldsRaw, ""),
				twoPassReferenceFields: Util.mergeAndCleanArrays(this.twoPassReferenceFieldsRaw, ""),
				maxRecords: this.maxRecordsEachRaw,
				name: null,
				orderBy: null,
				where: null,
				externalIdField: null
			};
			this.blankSObjectData = output;
		}

		output.name = sObjName;
		return output;
	}
}
