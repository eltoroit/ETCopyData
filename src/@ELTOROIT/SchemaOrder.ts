import { ISchemaData, ISchemaDataParent } from "./Interfaces";
import { OrgManager } from "./OrgManager";
import { Util } from "./Util";

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
					Util.throwError('Deadlock determining import order, '
									+ 'most likely caused by circular or self reference, '
									+ 'configure those fields as twoPassReferenceFields');
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
		this.orgManager.discovery.getSObjects().forEach(
			(sObj: ISchemaData, sObjName: string) => {
				sObjNamesToLoad.push(sObjName);
			},
		);
		return sObjNamesToLoad;
	}

	private findSObjectsWithoutParents(allSObjNames: string[]): string[] {
		const sObjectsFound: string[] = [];

		// Find sObjects without parents
		allSObjNames.forEach(
			(sObjName: string) => {
				if (this.orgManager.discovery.getSObjects().get(sObjName).parentsRequired.length === 0) {
					sObjectsFound.push(sObjName);
				}
			},
		);

		return sObjectsFound;
	}

	private removeMetadata(): void {
		this.orgManager.discovery.getSObjects().forEach(
			(sObj: ISchemaData, sObjName: string) => {
				const parentsRequired: string[] = [];
				sObj.parents.forEach(
					(parent: ISchemaDataParent) => {
						if (this.orgManager.coreMD.isMD(parent.sObj)) {
							// Not required....
						} else {
							parentsRequired.push(parent.sObj);
						}
					},
				);
				sObj.parentsRequired = parentsRequired;
			},
		);
	}

	private removeSObjectFoundFromOthers(sObjectsFound: string[]): void {
		this.orgManager.discovery.getSObjects().forEach(
			(sObj: ISchemaData) => {
				sObj.parentsRequired = sObj.parentsRequired.filter(
					(sObjName: string) => {
						return !sObjectsFound.includes(sObjName);
					},
				);
			},
		);
	}

	private removeSObjectFromChecks(allSObjNames: string[], sObjectsFound: string[]): string[] {
		return allSObjNames.filter(
			(sObjName: string) => {
				return !sObjectsFound.includes(sObjName);
			},
		);
	}

}
