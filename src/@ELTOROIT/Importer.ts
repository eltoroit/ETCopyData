import { BulkOptions, Date, RecordResult } from "jsforce";
import { ISchemaDataParent } from "./Interfaces";
import { OrgManager } from "./OrgManager";
import { LogLevel, ResultOperation, Util } from "./Util";

export class Importer {
	private matchingIds: Map<string, Map<string, string>>; // SobjectName => Old => New
	private countImportErrorsRecords: number = 0;
	private countImportErrorsSObjects: number = 0;

	public deleteAll(orgDestination: OrgManager): Promise<number> {
		let countErrorsRecords: number = 0;
		let countErrorsSObjects: number = 0;
		return new Promise((resolve, reject) => {
			if (orgDestination.settings.deleteDestination) {
				const sObjectsToLoad: string[] = orgDestination.order.findImportOrder();
				const sObjectsToLoadReversed: string[] = sObjectsToLoad.slice(0).reverse();

				Util.serialize(
					this, sObjectsToLoadReversed, (index): Promise<void> => {
						return new Promise((resolveEach, rejectEach) => {
							const sObjName = sObjectsToLoadReversed[index];
							this.deleteOneBeforeLoading(orgDestination, sObjName)
								.then((value: number) => {
									countErrorsRecords += value;
									if (value > 0) {
										countErrorsSObjects++;
									}
									resolveEach();
								})
								.catch((err) => { Util.throwError(err); });
						});
					})
					.then(() => {
						let msg = "";
						if (countErrorsRecords > 0) {
							msg += `[${orgDestination.alias}] Deleting records failed. `;
							msg += `SObjects: ${countErrorsSObjects}, records ${countErrorsRecords}`;
							Util.writeLog(msg, orgDestination.settings.stopOnErrors ? LogLevel.FATAL : LogLevel.WARN);
						}

						if ((!orgDestination.settings.stopOnErrors) || (countErrorsRecords === 0)) {
							resolve(countErrorsRecords);
						} else {
							reject(msg);
						}
					})
					.catch((err) => { Util.throwError(err); });
			} else {
				resolve(0);
			}
		});
	}

	public importAll(orgSource: OrgManager, orgDestination: OrgManager): Promise<number> {
		return new Promise((resolve, reject) => {
			// Find matching IDs for metadata
			// Loop through all the sObjects in the import order
			//  	Read file from JSON into usable structure
			//  	Update the old IDs with the values in the newIdMap
			//  	Import data into destination
			//  	Update newIdMap with the new Ids.
			// End Loop

			this.deleteAll(orgDestination)
				.then((numberErrors: number) => {
					return this.findMatchingMetadataIds(orgSource, orgDestination);
				})
				.then(() => {
					this.countImportErrorsRecords = 0;
					this.countImportErrorsSObjects = 0;
					const sObjectsToLoad: string[] = orgDestination.order.findImportOrder();
					Util.writeLog("sObjects should be processed in this order: " + sObjectsToLoad, LogLevel.TRACE);
					return this.loadAllSObjectData(orgSource, orgDestination, sObjectsToLoad, 0);
				})
				.then(() => {
					let msg = "";
					if (this.countImportErrorsRecords > 0) {
						msg += `[${orgDestination.alias}] Importing records failed. `;
						msg += `SObjects: ${this.countImportErrorsSObjects}, records ${this.countImportErrorsRecords}`;
						Util.writeLog(msg, orgDestination.settings.stopOnErrors ? LogLevel.FATAL : LogLevel.WARN);
					}

					if ((!orgDestination.settings.stopOnErrors) || (this.countImportErrorsRecords === 0)) {
						resolve(this.countImportErrorsRecords);
					} else {
						reject(msg);
					}
				})
				.catch((err) => { Util.throwError(err); });
		});
	}

	private findMatchingMetadataIds(orgSource: OrgManager, orgDestination: OrgManager): Promise<void> {
		return new Promise((resolve, reject) => {
			// Map<sObjName, Map<string (SRC, DST), Map<Key, Id>>>>
			let tempMD: Map<string, Map<string, Map<string, string>>>;

			this.matchingIds = new Map<string, Map<string, string>>();
			tempMD = new Map<string, Map<string, Map<string, string>>>();

			// Load exported Metadata
			const promises = [];
			orgSource.coreMD.sObjects.forEach((sObjName: string) => {
				const matchBy = orgSource.settings.getSObjectMetadata(sObjName).matchBy;

				tempMD.set(sObjName, new Map<string, Map<string, string>>());
				tempMD.get(sObjName).set(orgSource.alias, new Map<string, string>());
				tempMD.get(sObjName).set(orgDestination.alias, new Map<string, string>());

				promises.push(this.processMetadataRecords(orgSource, sObjName, matchBy, tempMD));
				promises.push(this.processMetadataRecords(orgDestination, sObjName, matchBy, tempMD));
			});

			Promise.all(promises)
				.then(() => {
					tempMD.forEach((value: Map<string, Map<string, string>>, sObjName: string) => {
						this.matchingIds.set(sObjName, new Map<string, string>());
						const mapSource = value.get(orgSource.alias);
						const mapDestination = value.get(orgDestination.alias);

						mapSource.forEach((idSource: string, keySource: string) => {
							let idDestination = null;
							if (mapDestination.has(keySource)) {
								idDestination = mapDestination.get(keySource);
							}
							this.matchingIds.get(sObjName).set(idSource, idDestination);
						});
					});
					resolve();
				})
				.catch((err) => { Util.throwError(err); });
		});
	}

	// tslint:disable-next-line:max-line-length
	private processMetadataRecords(org: OrgManager, sObjName: string, matchBy: string, tempMD: Map<string, Map<string, Map<string, string>>>): Promise<void> {
		return new Promise((resolve, reject) => {
			let key: string;
			let value: string;

			org.settings.readFromFile(org.alias, sObjName + ".json")
				.then((jsonSource: any) => {
					const records: any[] = jsonSource.records;
					records.forEach((record) => {
						key = record[matchBy];
						value = record.Id;
						tempMD.get(sObjName).get(org.alias).set(key, value);
					});
					resolve();
				})
				.catch((err) => { Util.throwError(err); });
		});
	}

	// FIXME: Make this generic, so that recursion can be applied to anything. We need it for deletion too.
	// WARNING: Serializing an asynchronous operation. Recursion is going to help here...
	// WARNING: This can't be done in parallel mode, since the IDs from the previous load are needed for the next loads
	// tslint:disable-next-line:max-line-length
	private loadAllSObjectData(orgSource: OrgManager, orgDestination: OrgManager, sObjectsToLoad: string[], index: number): Promise<void> {
		return new Promise((resolve, reject) => {
			if (index >= sObjectsToLoad.length) {
				resolve();
			} else {
				const sObjName: string = sObjectsToLoad[index];
				let msg = "";
				msg += `[${orgDestination.alias}] Importing Sobject: [${sObjName}] (${index + 1} of ${sObjectsToLoad.length})`;
				Util.writeLog(msg, LogLevel.TRACE);
				this.loadOneSObjectData(orgSource, orgDestination, sObjName)
					.then((value: number) => {
						this.countImportErrorsRecords += value;
						if (value > 0) {
							this.countImportErrorsSObjects++;
						}
						this.loadAllSObjectData(orgSource, orgDestination, sObjectsToLoad, ++index)
							.then(() => { resolve(); })
							.catch((err) => { Util.throwError(err); });
					})
					.catch((err) => { Util.throwError(err); });
			}
		});

	}

	private loadOneSObjectData(orgSource: OrgManager, orgDestination: OrgManager, sObjName: string): Promise<number> {
		return new Promise((resolve, reject) => {
			// Read file from JSON into usable structure
			let msg = "";
			let records: any[];
			let hasNotified: boolean = false;
			orgSource.settings.readFromFile(orgSource.alias, sObjName + ".json")
				.then((jsonSource: any) => {
					records = jsonSource.records;
					records.forEach((record: any) => {
						// Update parent IDs.
						orgDestination.discovery.getSObjects().get(sObjName).parents.forEach(
							(parent: ISchemaDataParent) => {
								const sourceParentId = record[parent.parentId];
								// Issue #003: Null pointer if there was no data, so split and check for null
								const destinationParentMap = this.matchingIds.get(parent.sObj);
								const destinationParentId = destinationParentMap ? destinationParentMap.get(sourceParentId) : null;
								record[parent.parentId] = destinationParentId;

								if (destinationParentId === null) {
									// Do not include fields that are blank, so default values can be used.
									delete record[parent.parentId];

									// VERBOSE: This may blank a field if there is no corresponding parent in the destination
									if (!hasNotified) {
										msg = `Default fields values are being used because no parents were found`;
										Util.writeLog(msg, LogLevel.WARN);
										hasNotified = true;
									}

									msg = ``;
									msg += `[${orgDestination.alias}] [${sObjName + "." + parent.parentId}] `;
									msg += `for source [${record.Id}] cleared, because `;
									msg += `no [${parent.sObj}] matched source [${sourceParentId}] `;
									Util.writeLog(msg, LogLevel.INFO);
								}
							});
					});

					if (records.length > 0) {
						// LOADING
						this.matchingIds.set(sObjName, new Map<string, string>());
						orgDestination.conn.bulk.pollTimeout = orgDestination.settings.pollingTimeout;
						// WARNING: Salesforce Bulk has a weird behavior that if the options are not given,
						// WARNING: then the rest of the parameters are shifted to the left rather than taking null as a placeholder.
						const bulkOptions: BulkOptions = { concurrencyMode: "Parallel", extIdField: null };
						// LEARNING: Inserting sObject records in bulk
						orgDestination.conn.bulk.load(sObjName, "insert", bulkOptions, records, (error, results: any[]) => {
							let badCount: number = 0;
							let goodCount: number = 0;

							if (error) {
								Util.throwError(error);
							}

							// NOTE: I need a traditional loop because the index (i) will be used in two lists of same size and same order.
							for (let i = 0; i < results.length; i++) {
								msg = "";
								if (results[i].success) {
									goodCount++;
									this.matchingIds.get(sObjName).set(records[i].Id, results[i].id);

									// VERBOSE: Show record was added succesfully
									msg += `[${orgDestination.alias}] Successfully imported [${sObjName}] record #${i + 1}. `;
									msg += `Ids mapped: [${records[i].Id}] => [${results[i].id}]`;
									Util.writeLog(msg, LogLevel.TRACE);
								} else {
									badCount++;
									msg += `*** [${orgDestination.alias}] Error importing [${sObjName}] record #${i + 1}. `;
									msg += results[i].errors.join(", ");
									Util.writeLog(msg, LogLevel.ERROR);
								}
							}

							msg = "";
							msg += `[${orgDestination.alias}] Imported [${sObjName}]. `;
							msg += `Record count: [Good = ${goodCount}, Bad = ${badCount}]`;
							Util.writeLog(msg, LogLevel.INFO);
							Util.logResultsAdd(orgDestination, ResultOperation.IMPORT, sObjName, goodCount, badCount);

							resolve(badCount);
						});
					} else {
						resolve(0);
					}
				})
				.catch((err) => { Util.throwError(err); });
		});
	}

	private deleteOneBeforeLoading(org: OrgManager, sObjName: string): Promise<number> {
		let msg = "";

		return new Promise((resolve, reject) => {
			// DELETING
			Util.writeLog(`[${org.alias}] Deleting records from [${sObjName}]`, LogLevel.TRACE);
			org.conn.bulk.pollTimeout = org.settings.pollingTimeout;
			// LEARNING: Deleting sObject records in bulk
			org.conn.sobject(sObjName)
				.find({ CreatedDate: { $lte: Date.TOMORROW } })
				.destroy(sObjName)
				.then((results: RecordResult[]) => {
					let totalSuccess: number = 0;
					let totalFailures: number = 0;
					results.forEach((result: any) => {
						if (result.success) {
							totalSuccess++;
						} else {
							if ((result.errors.length === 1) && (result.errors[0] === "ENTITY_IS_DELETED:entity is deleted:--")) {
								// Ignore error
							} else {
								totalFailures++;
								msg = `*** [${org.alias}] Error deleting [${sObjName}] records. ${result.errors.join(", ")}`;
								Util.writeLog(msg, LogLevel.ERROR);
							}
						}
					});
					Util.logResultsAdd(org, ResultOperation.DELETE, sObjName, totalSuccess, totalFailures);
					msg = `[${org.alias}] Deleted ${totalSuccess} records from [${sObjName}]`;
					Util.writeLog(msg, LogLevel.INFO);

					resolve(totalFailures);
				})
				.catch((err) => { reject(err); });
		});
	}
}
