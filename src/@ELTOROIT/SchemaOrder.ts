import { ISchemaData, ISchemaDataParent } from "./Interfaces.js";
import { OrgManager } from "./OrgManager.js";
import { LogLevel, Util } from "./Util.js";

export class SchemaOrder {
	private orgManager: OrgManager;
	private importOrder: string[] = null;

	constructor(orgManager: OrgManager) {
		this.orgManager = orgManager;
	}

	public findImportOrder(): string[] {
		if (this.importOrder === null) {
			this.removeMetadata();
			this.importOrder = [];
			let allSObjNames: string[] = this.getSObjNames();

			while (allSObjNames.length > 0) {
				const sObjectsFound: string[] = this.findSObjectsWithoutParents(allSObjNames);
				if (sObjectsFound.length === 0) {
					const relationships = [];
					const data = new Map<string, string[]>();
					allSObjNames.forEach((sObjName) => {
						data.set(sObjName, this.orgManager.discovery.getSObjects().get(sObjName).parentsRequired);
					});
					for (const objNameA of data.keys()) {
						const objA = this.orgManager.discovery.getSObjects().get(objNameA);
						data.get(objNameA).forEach((objNameB) => {
							if (data.has(objNameB) && data.get(objNameB).includes(objNameA)) {
								let addComma = false;
								let str = `[${objNameA}<=>${objNameB} (`;
								const objB = this.orgManager.discovery.getSObjects().get(objNameB);
								const parentsA = objA.parents.filter((parent) => parent.sObj === objNameB);
								const parentsB = objB.parents.filter((parent) => parent.sObj === objNameA);
								parentsA.forEach((parentA) => {
									if (addComma) str += ", ";
									addComma = true;
									str += `${objNameA}.${parentA.parentId}`;
								});
								parentsB.forEach((parentB) => {
									if (addComma) str += ", ";
									addComma = true;
									str += `${objNameB}.${parentB.parentId}`;
								});
								str += ")";

								relationships.push(str);
								data.set(
									objNameA,
									data.get(objNameA).filter((tmpObjName) => tmpObjName !== objNameB)
								);
							}
						});
					}

					// Build helpful error message with configuration guidance
					let errorMsg = "Deadlock determining import order, most likely caused by circular or self reference, configure those fields as twoPassReferenceFields.";
					errorMsg += "\n\nTo resolve this, update your ETCopyDataSF.json configuration file with the following twoPassReferenceFields:\n\n";

					if (relationships.length > 0) {
						// Cross-object circular relationships detected - extract fields from relationships
						// Parse the relationships to get the actual fields causing circular dependencies
						const suggestions: Map<string, Set<string>> = new Map();

						// Parse the relationships array to extract specific fields
						// Format: "[Account<=>Contact (Account.PersonContactId, Contact.AccountId)]"
						for (const relationship of relationships) {
							// Extract fields from the relationship string
							const match = relationship.match(/\(([^)]+)\)/);
							if (match) {
								const fieldList = match[1].split(",").map(f => f.trim());
								for (const fieldRef of fieldList) {
									// Parse "ObjectName.FieldName"
									const parts = fieldRef.split(".");
									if (parts.length === 2) {
										const [objName, fieldName] = parts;
										if (!suggestions.has(objName)) {
											suggestions.set(objName, new Set());
										}
										suggestions.get(objName).add(fieldName);
									}
								}
							}
						}

						// Also get rejected self-referencing fields for objects in the deadlock
						for (const objName of allSObjNames) {
							const rejectedFields = this.orgManager.discovery.getRejectedSelfReferencingFields(objName);
							if (rejectedFields.length > 0) {
								if (!suggestions.has(objName)) {
									suggestions.set(objName, new Set());
								}
								rejectedFields.forEach(field => suggestions.get(objName).add(field));
							}
						}

						// Show only the specific fields that need configuration (sorted alphabetically)
						const sortedSuggestions = Array.from(suggestions.entries()).sort((a, b) => a[0].localeCompare(b[0]));
						for (const [objName, fields] of sortedSuggestions) {
							const sortedFields = Array.from(fields).sort();
							errorMsg += `- Object [${objName}], twoPassReferenceFields [${sortedFields.join(",")}]\n`;
						}
					} else {
						// No direct circular relationships found - likely self-references only
						// Show only rejected self-referencing fields (sorted alphabetically)
						const sortedObjNames = [...allSObjNames].sort();
						for (const objName of sortedObjNames) {
							const rejectedFields = this.orgManager.discovery.getRejectedSelfReferencingFields(objName);
							if (rejectedFields.length > 0) {
								const sortedFields = rejectedFields.sort();
								errorMsg += `- Object [${objName}], twoPassReferenceFields [${sortedFields.join(",")}]\n`;
							}
						}
					}

					// Log the error message before throwing the exception
					// Split by newlines and log each line separately for better readability
					const lines = errorMsg.split("\n");
					for (const line of lines) {
						// Skip empty lines to avoid null errors in writeLog
						if (line.trim().length > 0) {
							Util.writeLog(line, LogLevel.ERROR);
						}
					}
					Util.throwError(errorMsg);
				}

				// Add the newly found sObjects to the master list
				this.importOrder = this.importOrder.concat(sObjectsFound);

				// Since this object 'has been loaded' (technically, not quite true...
				// but at least we know in which order they should load)...
				// ... then the other sobjects should not require the sobjects we found.
				this.removeSObjectFoundFromOthers(sObjectsFound);

				// ... and should not be an object to check any more.
				allSObjNames = this.removeSObjectFromChecks(allSObjNames, sObjectsFound);
			}
		}
		return this.importOrder;
	}

	private getSObjNames(): string[] {
		const sObjNamesToLoad: string[] = [];
		this.orgManager.discovery.getSObjects().forEach((sObj: ISchemaData, sObjName: string) => {
			sObjNamesToLoad.push(sObjName);
		});
		return sObjNamesToLoad;
	}

	private findSObjectsWithoutParents(allSObjNames: string[]): string[] {
		const sObjectsFound: string[] = [];

		// Find sObjects without parents
		allSObjNames.forEach((sObjName: string) => {
			if (this.orgManager.discovery.getSObjects().get(sObjName).parentsRequired.length === 0) {
				sObjectsFound.push(sObjName);
			}
		});

		return sObjectsFound;
	}

	private removeMetadata(): void {
		this.orgManager.discovery.getSObjects().forEach((sObj: ISchemaData, sObjName: string) => {
			const parentsRequired: string[] = [];
			sObj.parents.forEach((parent: ISchemaDataParent) => {
				if (this.orgManager.coreMD.isMD(parent.sObj)) {
					// Not required....
				} else {
					parentsRequired.push(parent.sObj);
				}
			});
			sObj.parentsRequired = parentsRequired;
		});
	}

	private removeSObjectFoundFromOthers(sObjectsFound: string[]): void {
		this.orgManager.discovery.getSObjects().forEach((sObj: ISchemaData) => {
			sObj.parentsRequired = sObj.parentsRequired.filter((sObjName: string) => {
				return !sObjectsFound.includes(sObjName);
			});
		});
	}

	private removeSObjectFromChecks(allSObjNames: string[], sObjectsFound: string[]): string[] {
		return allSObjNames.filter((sObjName: string) => {
			return !sObjectsFound.includes(sObjName);
		});
	}
}
