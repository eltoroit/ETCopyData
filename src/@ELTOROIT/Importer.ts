import DataAPI from "./DataAPI";
import { OrgManager } from "./OrgManager";
import { ISchemaDataParent } from "./Interfaces";
import { LogLevel, Util } from "./Util";

class ReferenceFieldMapping {
	public fieldName: string;
	public sourceId: string;
	public constructor(fieldName: string, sourceId: string) {
		this.fieldName = fieldName;
		this.sourceId = sourceId;
	}
}

export class Importer {
	private matchingIds: Map<string, Map<string, string>>; // SobjectName => Old => New
	private twoPassReferenceFieldData: Map<string, Map<string, Array<ReferenceFieldMapping>>>; // SObjectName => Id (old) => references (old)
	private countImportErrorsRecords: number = 0;
	private countImportErrorsSObjects: number = 0;

	public deleteAll(orgDestination: OrgManager): Promise<number> {
		let countErrorsRecords: number = 0;
		let countErrorsSObjects: number = 0;
		return new Promise((resolve, reject) => {
			if (orgDestination.settings.deleteDestination) {
				const sObjectsToLoad: string[] = orgDestination.order.findImportOrder();
				const sObjectsToLoadReversed: string[] = sObjectsToLoad.slice(0).reverse();

				Util.writeLog(`[${orgDestination.alias}] sObjects should be deleted in this order: ${sObjectsToLoadReversed.join(", ")}`, LogLevel.TRACE);
				Util.serialize(this, sObjectsToLoadReversed, (index): Promise<void> => {
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
							.catch((err) => {
								rejectEach(err);
							});
					});
				})
					.then(() => {
						let msg = "";
						if (countErrorsRecords > 0) {
							msg += `[${orgDestination.alias}] Deleting records failed. `;
							msg += `SObjects: ${countErrorsSObjects}, records ${countErrorsRecords}`;
							Util.writeLog(msg, orgDestination.settings.stopOnErrors ? LogLevel.FATAL : LogLevel.WARN);
						}

						if (!orgDestination.settings.stopOnErrors || countErrorsRecords === 0) {
							resolve(countErrorsRecords);
						} else {
							reject(msg);
						}
					})
					.catch((err) => {
						reject(err);
					});
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
			// Set references for twoPassReferenceFields

			this.twoPassReferenceFieldData = new Map<string, Map<string, Array<ReferenceFieldMapping>>>();

			this.countImportErrorsRecords = 0;
			this.countImportErrorsSObjects = 0;
			this.deleteAll(orgDestination)
				.then((numberErrors: number) => {
					return this.findMatchingMetadataIds(orgSource, orgDestination);
				})
				.then(() => {
					const sObjectsToLoad: string[] = orgDestination.order.findImportOrder();
					Util.writeLog(`[${orgDestination.alias}] sObjects should be imported in this order: ${sObjectsToLoad.join(", ")}`, LogLevel.TRACE);
					return this.loadAllSObjectData(orgSource, orgDestination, sObjectsToLoad, 0);
				})
				.then(() => {
					return this.setTwoPassReferences(orgSource, orgDestination);
				})
				.then(() => {
					let msg = "";
					if (this.countImportErrorsRecords > 0) {
						msg += `[${orgDestination.alias}] Importing records failed. `;
						msg += `SObjects: ${this.countImportErrorsSObjects}, records ${this.countImportErrorsRecords}`;
						Util.writeLog(msg, orgDestination.settings.stopOnErrors ? LogLevel.FATAL : LogLevel.WARN);
					}

					if (!orgDestination.settings.stopOnErrors || this.countImportErrorsRecords === 0) {
						resolve(this.countImportErrorsRecords);
					} else {
						reject(msg);
					}
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	private findMatchingMetadataIds(orgSource: OrgManager, orgDestination: OrgManager): Promise<void> {
		return new Promise((resolve, reject) => {
			// Map<sObjName, Map<string (SRC, DST), Map<Key, Id>>>>
			this.matchingIds = new Map<string, Map<string, string>>();
			const tempMD: Map<string, Map<string, Map<string, string>>> = new Map<string, Map<string, Map<string, string>>>();

			// Same org alias?
			const sameOrg: Boolean = orgSource.alias === orgDestination.alias;
			const folderCode = sameOrg ? "_SAME" : "";

			// Load exported Metadata
			const promises = [];
			orgSource.coreMD.sObjects.forEach((sObjName: string) => {
				const matchBy = orgSource.settings.getSObjectMetadata(sObjName).matchBy;

				tempMD.set(sObjName, new Map<string, Map<string, string>>());
				tempMD.get(sObjName).set(orgSource.alias, new Map<string, string>());
				tempMD.get(sObjName).set(orgDestination.alias + folderCode, new Map<string, string>());

				promises.push(this.processMetadataRecords(orgSource, sObjName, matchBy, tempMD, ""));
				promises.push(this.processMetadataRecords(orgDestination, sObjName, matchBy, tempMD, folderCode));
			});

			Promise.all(promises)
				.then(() => {
					tempMD.forEach((value: Map<string, Map<string, string>>, sObjName: string) => {
						this.matchingIds.set(sObjName, new Map<string, string>());
						const mapSource = value.get(orgSource.alias);
						const mapDestination = value.get(orgDestination.alias + folderCode);

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
				.catch((err) => {
					reject(err);
				});
		});
	}

	// tslint:disable-next-line:max-line-length
	private processMetadataRecords(org: OrgManager, sObjName: string, matchBy: string, tempMD: Map<string, Map<string, Map<string, string>>>, folderCode: string): Promise<void> {
		return new Promise((resolve, reject) => {
			let key: string;
			let value: string;

			org.settings
				.readFromFile(org.alias + folderCode, sObjName + ".json")
				.then((jsonSource: any) => {
					const records: any[] = jsonSource.records;
					records.forEach((record) => {
						key = "";
						matchBy.split(",").forEach((part) => {
							if (key !== "") {
								key += "|";
							}
							const v = record[part.trim()];
							key += v;
							if (v === undefined) {
								reject(`Value for field [${part.trim()}] was not found in [${org.alias}] for [${sObjName}]. Check spelling.`);
							}
						});
						value = record.Id;
						tempMD
							.get(sObjName)
							.get(org.alias + folderCode)
							.set(key, value);
					});
					resolve();
				})
				.catch((err) => {
					reject(err);
				});
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
						if (value > 0) {
							this.countImportErrorsSObjects++;
						}
						this.loadAllSObjectData(orgSource, orgDestination, sObjectsToLoad, ++index)
							.then(() => {
								resolve();
							})
							.catch((err) => {
								reject(err);
							});
					})
					.catch((err) => {
						reject(err);
					});
			}
		});
	}

	private queryPersonContactIds(orgSource: OrgManager, orgDestination: OrgManager, exportedRecords: any[]): Promise<void> {
		return new Promise((resolve, reject) => {
			// Get all newly imported Account IDs (destination IDs)
			const accountMapping = this.matchingIds.get("Account");
			if (!accountMapping || accountMapping.size === 0) {
				resolve();
				return;
			}

			const newAccountIds: string[] = Array.from(accountMapping.values()).filter((id) => id !== null);

			if (newAccountIds.length === 0) {
				resolve();
				return;
			}

			// Query destination org for Person Accounts and their PersonContactIds
			const query = `SELECT Id, PersonContactId FROM Account WHERE IsPersonAccount = true AND Id IN ('${newAccountIds.join("','")}')`;

			Util.writeLog(`[${orgDestination.alias}] Querying for Person Contact IDs from newly imported Person Accounts`, LogLevel.INFO);

			orgDestination.conn
				.query(query)
				.then((result: any) => {
					if (result.records && result.records.length > 0) {
						// Initialize Contact mapping if it doesn't exist
						if (!this.matchingIds.has("Contact")) {
							this.matchingIds.set("Contact", new Map<string, string>());
						}
						const contactMapping = this.matchingIds.get("Contact");

						// Create a reverse map: new Account ID -> old Account ID
						const reverseAccountMap = new Map<string, string>();
						accountMapping.forEach((newId, oldId) => {
							if (newId !== null) {
								reverseAccountMap.set(newId, oldId);
							}
						});

						// Map old PersonContactId to new PersonContactId
						result.records.forEach((account: any) => {
							const newAccountId = account.Id;
							const newPersonContactId = account.PersonContactId;
							const oldAccountId = reverseAccountMap.get(newAccountId);

							if (oldAccountId && newPersonContactId) {
								// Find the old PersonContactId from the exported records
								const exportedAccount = exportedRecords.find((rec) => rec.Id === oldAccountId);
								if (exportedAccount && exportedAccount.PersonContactId) {
									const oldPersonContactId = exportedAccount.PersonContactId;
									contactMapping.set(oldPersonContactId, newPersonContactId);
									Util.writeLog(`[${orgDestination.alias}] Mapped Person Contact: [${oldPersonContactId}] => [${newPersonContactId}]`, LogLevel.TRACE);
								}
							}
						});

						Util.writeLog(`[${orgDestination.alias}] Mapped ${result.records.length} Person Contact IDs`, LogLevel.INFO);
					}
					resolve();
				})
				.catch((err) => {
					Util.writeLog(`[${orgDestination.alias}] Error querying Person Contact IDs: ${err}`, LogLevel.ERROR);
					reject(err);
				});
		});
	}

	private loadOneSObjectData(orgSource: OrgManager, orgDestination: OrgManager, sObjName: string): Promise<number> {
		// Read file from JSON into usable structure
		let msg = "";
		let hasNotified: boolean = false;

		const readFileAndUpdateIds = (): any => {
			let records: any[];
			return new Promise((resolve, reject) => {
				orgSource.settings
					.readFromFile(orgSource.alias, sObjName + ".json")
					.then((jsonSource: any) => {
						records = jsonSource.records;
						records.forEach((record: any) => {
							const parents = orgDestination.discovery.getSObjects().get(sObjName).parents;
							// Update parent IDs.
							parents.forEach((parent: ISchemaDataParent) => {
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

							// Clear reference fields that will be set in second pass
							const asArray = (param: string | string[]): string[] => {
								return typeof param === "string" ? [param] : param;
							};
							asArray(orgDestination.settings.getSObjectData(sObjName).twoPassReferenceFields).forEach((fieldName: string) => {
								let skip = false;
								if (sObjName === "Account" && fieldName === "PersonContactId") {
									skip ||= true;
								}
								if (!skip) {
									if (record[fieldName] !== null && record[fieldName] !== undefined) {
										let sObjectData = this.twoPassReferenceFieldData.get(sObjName);
										if (sObjectData === undefined) {
											sObjectData = new Map<string, Array<ReferenceFieldMapping>>();
											this.twoPassReferenceFieldData.set(sObjName, sObjectData);
										}
										let mappings = sObjectData.get(record.Id);
										if (mappings === undefined) {
											mappings = new Array<ReferenceFieldMapping>();
											sObjectData.set(record.Id, mappings);
										}
										mappings.push(new ReferenceFieldMapping(fieldName, record[fieldName]));
										delete record[fieldName];
									}
								}
							});
						});

						// Filter out Person Contacts - they are auto-created with Person Accounts
						if (sObjName === "Contact") {
							const originalCount = records.length;
							records = records.filter((record: any) => {
								// Keep only regular Contacts (not Person Contacts)
								return record.IsPersonAccount !== true;
							});
							const personContactCount = originalCount - records.length;
							if (personContactCount > 0) {
								Util.writeLog(
									`[${orgDestination.alias}] Skipped ${personContactCount} Person Contact(s) (auto-created with Person Accounts). Importing ${records.length} regular Contact(s).`,
									LogLevel.INFO
								);
							}
						}

						resolve(records);
					})
					.catch((err) => reject(err));
			});
		};

		const cleanData = (recordsToProcess): any[] => {
			const sObjSource = orgSource.discovery.privSObjects.get(sObjName);
			const sObjDestination = orgDestination.discovery.privSObjects.get(sObjName);
			// Remove rejected fields
			const sObjSourceRejects = sObjSource.rejectedFields ? sObjSource.rejectedFields : [];
			const sObjDestinationRejects = sObjDestination.rejectedFields ? sObjDestination.rejectedFields : [];
			const allRejects: Set<string> = new Set(sObjSourceRejects.concat(sObjDestinationRejects));
			const allDestinationFields: Set<string> = new Set<string>(sObjDestination.fields);
			const fieldsCleaned: Map<String, number> = new Map();

			// Person Account read-only fields that cannot be set on import
			const personAccountReadOnlyFields = new Set(["Name", "PersonContactId", "PersonMailingAddress", "PersonOtherAddress", "IsPersonAccount"]);

			const cleaned = recordsToProcess.map((record) => {
				const newRecord = {};

				// Detect if this is a Person Account or Person Contact
				const isPersonAccount =
					(sObjName === "Account" || sObjName === "Contact") &&
					(record.IsPersonAccount === true || (record.FirstName !== undefined && record.FirstName !== null) || (record.LastName !== undefined && record.LastName !== null));

				// eslint-disable-next-line guard-for-in
				for (const field in record) {
					if (field !== "attributes") {
						if (record[field]) {
							let dirtyReason = null;

							// Special handling for Person Account read-only fields
							if (isPersonAccount && personAccountReadOnlyFields.has(field)) {
								dirtyReason = "PERSON_ACCOUNT_READONLY_FIELD";
							} else if (allRejects.has(field)) {
								dirtyReason = "NOT_IN_SOURCE";
							} else if (!allDestinationFields.has(field)) {
								dirtyReason = "NOT_IN_DESTINATION";
							}

							if (dirtyReason) {
								let count = 0;
								if (fieldsCleaned.has(field)) count = fieldsCleaned.get(field);
								if (count === 0) {
									Util.writeLog(`[${orgDestination.alias}] Field [${sObjName}.${field}] has been removed because [${dirtyReason}]`, LogLevel.WARN);
								}
								fieldsCleaned.set(field, count + 1);
							} else {
								// Add it
								newRecord[field] = record[field];
							}
						}
					}
				}
				return newRecord;
			});
			for (const [field, count] of fieldsCleaned) {
				Util.writeLog(`[${orgDestination.alias}] Field [${sObjName}.${field}] has been removed from [${count}] records because they can't be loaded`, LogLevel.WARN);
			}

			return cleaned;
		};

		return new Promise((resolve, reject) => {
			readFileAndUpdateIds()
				.then((records) => {
					if (records.length === 0) {
						resolve(0);
					} else {
						this.matchingIds.set(sObjName, new Map<string, string>());
						const operation = orgDestination.settings.getSObjectData(sObjName).externalIdField ? "upsert" : "insert";
						const recordsToProcess = cleanData(this.getRecordsForOperation(records, operation));
						DataAPI.upsert(orgDestination, operation, sObjName, recordsToProcess, this.matchingIds, orgDestination.settings.getSObjectData(sObjName).externalIdField || null)
							.then((badCount) => {
								this.countImportErrorsRecords += badCount;

								// After importing Accounts, query for Person Contact IDs
								if (sObjName === "Account") {
									return this.queryPersonContactIds(orgSource, orgDestination, records)
										.then(() => badCount)
										.catch((err) => {
											Util.writeLog(`[${orgDestination.alias}] Warning: Failed to map Person Contact IDs: ${err}`, LogLevel.WARN);
											return badCount;
										});
								}
								return badCount;
							})
							.then((badCount) => {
								resolve(badCount);
							})
							.catch((err) => reject(err));
					}
				})
				.catch((err) => reject(err));
		});
	}

	private getRecordsForOperation(records: any[], operation: String): any[] {
		if (operation === "insert") {
			return records;
		}

		// Must remove the ID field without impacting the mapping
		let newRecords = JSON.parse(JSON.stringify(records));
		newRecords = newRecords.map((record) => {
			delete record.Id;
			return record;
		});
		return newRecords;
	}

	private setTwoPassReferences(orgSource: OrgManager, orgDestination: OrgManager): Promise<void> {
		return new Promise((resolve, reject) => {
			const keys: Array<string> = Array.from(this.twoPassReferenceFieldData.keys());

			Util.serialize(this, keys, (index): Promise<void> => {
				return new Promise((resolveEach, rejectEach) => {
					const sObjectName = keys[index];
					Util.writeLog(`[${orgDestination.alias}] Updating references for [${sObjectName}] (${index + 1} of ${keys.length})`, LogLevel.TRACE);

					const schemaData = orgDestination.discovery.getSObjects().get(sObjectName);
					const records = [];

					const baseRecord = {};
					schemaData.twoPassParents.forEach((parent) => {
						baseRecord[parent.parentId] = null;
					});

					const availableMatchingIds = new Map<string, Map<string, string>>(); // field name => id mapping data (old => new)
					schemaData.twoPassParents.forEach((parent, tmpIndex) => {
						if (this.matchingIds.has(parent.sObj)) {
							availableMatchingIds.set(parent.parentId, this.matchingIds.get(parent.sObj));
							Util.writeLog(`[${orgDestination.alias}] mapping field [${parent.parentId}] (#${tmpIndex}) to SObject [${parent.sObj}]`, LogLevel.TRACE);
						} else {
							Util.writeLog(`[${orgDestination.alias}] data not available for mapping field [${parent.parentId}] (#${tmpIndex}) to SObject [${parent.sObj}]`, LogLevel.WARN);
						}
					});

					// Create an object for each record that has one or more fields that need to be updated
					let tmpIndex = 0;
					this.twoPassReferenceFieldData.get(sObjectName).forEach((mappings: Array<ReferenceFieldMapping>, id: string) => {
						tmpIndex++;
						const record = Object.assign({ Id: this.matchingIds.get(sObjectName).get(id) }, baseRecord);
						mappings.forEach((mapping: ReferenceFieldMapping) => {
							const destinationId = availableMatchingIds.get(mapping.fieldName).get(mapping.sourceId);
							if (destinationId !== undefined) {
								record[mapping.fieldName] = destinationId;
								Util.writeLog(`[${orgDestination.alias}] mapping field [${mapping.fieldName}] for (#${tmpIndex}) [${id}]:[ ${mapping.sourceId}] => [${destinationId}]`, LogLevel.TRACE);
							} else {
								Util.writeLog(`[${orgDestination.alias}] mapping data for [${mapping.fieldName}] did not include mapping for [${mapping.sourceId}] (#${tmpIndex}) `, LogLevel.INFO);
							}
						});
						records.push(record);
					});

					DataAPI.update(orgDestination, sObjectName, records)
						.then((badCount) => {
							this.countImportErrorsRecords += badCount;
							resolveEach(badCount);
						})
						.catch((err) => rejectEach(err));
				});
			})
				.then(() => {
					resolve();
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	private deleteOneBeforeLoading(org: OrgManager, sObjName: string): Promise<number> {
		return new Promise((resolve, reject) => {
			DataAPI.delete(org, sObjName)
				.then((badCount) => {
					this.countImportErrorsRecords += badCount;
					resolve(badCount);
				})
				.catch((err) => reject(err));
		});
	}
}
