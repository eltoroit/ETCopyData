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

					if (relationships.length > 0) {
						errorMsg += ` Verify these relationships: ${relationships.join(", ")}`;
					} else {
						// No direct circular relationships found - likely self-references or complex cycles
						errorMsg += "\n\nTo resolve this, update your ETCopyDataSF.json configuration file with the following twoPassReferenceFields:\n\n";

						// Collect all fields that are causing the deadlock
						const suggestions: Map<string, string[]> = new Map();

						for (const objName of allSObjNames) {
							const sObj = this.orgManager.discovery.getSObjects().get(objName);
							const fieldSuggestions: string[] = [];

							// Check all parents that are in the deadlock set (cross-object references)
							sObj.parents.forEach((parent) => {
								if (allSObjNames.includes(parent.sObj)) {
									fieldSuggestions.push(parent.parentId);
								}
							});

							// Also check twoPassParents (these are already configured but might be part of complex cycle)
							sObj.twoPassParents.forEach((parent) => {
								if (allSObjNames.includes(parent.sObj) && !fieldSuggestions.includes(parent.parentId)) {
									fieldSuggestions.push(parent.parentId);
								}
							});

							if (fieldSuggestions.length > 0) {
								suggestions.set(objName, fieldSuggestions);
							}
						}

						// If no suggestions found from parents, check the config for fields that might need twoPassReferenceFields
						// This happens when self-referencing fields were rejected during schema discovery
						if (suggestions.size === 0) {
							// Check ALL objects (not just deadlocked ones) for potential self-reference configuration needs
							const allObjects = Array.from(this.orgManager.discovery.getSObjects().keys());
							const objectsNeedingConfig = [];

							for (const objName of allObjects) {
								const sObj = this.orgManager.discovery.getSObjects().get(objName);
								const sObjData = this.orgManager.settings.getSObjectData(objName);

								// Check if this object has any lookup fields that might be self-referencing
								// Common self-referencing fields that are often rejected
								const commonSelfRefFields = ["MasterRecordId", "ParentId", "ReportsToId"];
								const potentialFields = commonSelfRefFields.filter(field =>
									sObjData.twoPassReferenceFields.indexOf(field) === -1  // Not already configured
								);

								if (potentialFields.length > 0 || allSObjNames.includes(objName)) {
									objectsNeedingConfig.push(objName);
								}
							}

							// Show configuration for objects in the deadlock
							for (const objName of allSObjNames) {
								errorMsg += `  {\n    "name": "${objName}",\n    "twoPassReferenceFields": "MasterRecordId,ParentId"  // Or other self-referencing lookup fields\n  },\n`;
							}

							errorMsg += "\nNote: The exact field names depend on your schema. Common self-referencing fields include:\n";
							errorMsg += "  - MasterRecordId (for merged records)\n";
							errorMsg += "  - ParentId (for hierarchical relationships)\n";
							errorMsg += "  - ReportsToId (for Contact hierarchy)\n";
							errorMsg += "\nCheck the INFO log messages above to see which fields were rejected due to self-references.";

							// If other objects also have potential issues, mention them
							const otherObjects = objectsNeedingConfig.filter(obj => !allSObjNames.includes(obj));
							if (otherObjects.length > 0) {
								errorMsg += `\n\nAdditional objects that may also need configuration: ${otherObjects.join(", ")}`;
							}
						} else {
							// Format as JSON for easy copy-paste
							const sObjectConfigs = [];
							for (const [objName, fields] of suggestions.entries()) {
								sObjectConfigs.push(`  {\n    "name": "${objName}",\n    "twoPassReferenceFields": "${fields.join(",")}"\n  }`);
							}
							errorMsg += sObjectConfigs.join(",\n");
							errorMsg += "\n\nNote: You may not need ALL of these fields - configure only the ones causing circular dependencies.";
						}
						errorMsg += "\nFor more information, see the References section in the documentation.";
					}

					// Log the error message before throwing the exception
				// Split by newlines and log each line separately for better readability
				const lines = errorMsg.split('\n');
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
