import DataAPI from "./DataAPI";
import { IExportData } from "./Interfaces";
import { OrgManager } from "./OrgManager";
import { LogLevel, Util } from "./Util";

export class Exporter {
	public static all(org: OrgManager, folderCode: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const promises = [];

			// LEARNING: [PROMISES]: Pushing promises into the array, so they run in parallel.
			promises.push(Exporter.exportData(org, folderCode));
			promises.push(Exporter.exportMetadata(org, folderCode));

			// LEARNING: [PROMISES]: Wait for all promises which are running in parallel
			Promise.all(promises)
				.then(() => {
					resolve();
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	public static exportData(org: OrgManager, folderCode: string): Promise<void> {
		const exporter: Exporter = new Exporter();
		return exporter.privExportData(org, folderCode);
	}

	public static exportMetadata(org: OrgManager, folderCode: string): Promise<void> {
		const exporter: Exporter = new Exporter();
		return exporter.privExportMetadata(org, folderCode);
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	private mapRecordsFetched: Map<string, IExportData> = new Map<string, IExportData>();

	private privExportData(org: OrgManager, folderCode: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const promises = [];

			org.order.findImportOrder().forEach((sObjName) => {
				Util.writeLog(`[${org.alias}] Querying Data sObject [${sObjName}]`, LogLevel.TRACE);
				promises.push(this.queryData(org, sObjName, folderCode));
			});

			Promise.all(promises)
				.then(() => {
					resolve();
				})
				.catch((err) => {
					reject(err);
				});
		});
	}
	private privExportMetadata(org: OrgManager, folderCode: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const promises = [];

			// Metadata
			org.coreMD.sObjects.forEach((sObjName) => {
				Util.writeLog(`[${org.alias}] Querying Metadata sObject [${sObjName}]`, LogLevel.TRACE);
				promises.push(this.queryData(org, sObjName, folderCode));
			});

			Promise.all(promises)
				.then(() => {
					resolve();
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	private queryData(org: OrgManager, sObjName: string, folderCode: string): Promise<void> {
		this.mapRecordsFetched.set(sObjName, {
			fetched: 0,
			records: [],
			total: -1
		});

		return new Promise((resolve, reject) => {
			const SOQL = this.makeSOQL(org, sObjName);
			const fileName = {
				folder: org.alias + folderCode,
				file: sObjName + ".json"
			};
			DataAPI.export(org, sObjName, SOQL, this.mapRecordsFetched, fileName)
				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	private makeSOQL(org: OrgManager, sObjName: string): string {
		let soql = "";

		if (org.coreMD.isMD(sObjName)) {
			soql += org.coreMD.makeSOQL(sObjName);
		} else {
			const sObjSettings = org.settings.getSObjectData(sObjName);

			soql += "SELECT " + org.discovery.getFields(sObjName) + " ";
			soql += "FROM " + sObjName + " ";
			if (sObjSettings.where != null && sObjSettings.where !== "") {
				soql += "WHERE " + sObjSettings.where + " ";
			}
			if (sObjSettings.orderBy != null && sObjSettings.orderBy !== "") {
				soql += "ORDER BY " + sObjSettings.orderBy + " ";
			}
		}
		Util.writeLog(`[${org.alias}] Querying [${sObjName}] with SOQL: [${soql}]`, LogLevel.TRACE);

		return soql;
	}
}
