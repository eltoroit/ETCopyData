import { IExportData } from "./Interfaces";
import { OrgManager } from "./OrgManager";
import { LogLevel, ResultOperation, Util } from "./Util";

export class Exporter {

	public static all(org: OrgManager, folderCode: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const promises = [];

			// LEARNING: [PROMISES]: Pushing promises into the array, so they run in parallel.
			promises.push(Exporter.exportData(org, folderCode));
			promises.push(Exporter.exportMetadata(org, folderCode));

			// LEARNING: [PROMISES]: Wait for all promises which are running in parallel
			Promise.all(promises)
				.then(() => { resolve(); })
				.catch((err) => { reject(err); });
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

	private mapRecordsFetched: Map<string, IExportData> = new Map<string, IExportData>();

	private privExportData(org: OrgManager, folderCode: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const promises = [];

			org.order.findImportOrder().forEach((sObjName) => {
				Util.writeLog(`[${org.alias}] Querying Data sObject [${sObjName}]`, LogLevel.TRACE);
				promises.push(
					this.queryData(org, sObjName, folderCode),
				);
			});

			Promise.all(promises)
				.then(() => { resolve(); })
				.catch((err) => { reject(err); });
		});
	}
	private privExportMetadata(org: OrgManager, folderCode: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const promises = [];

			// Metadata
			org.coreMD.sObjects.forEach((sObjName) => {
				Util.writeLog(`[${org.alias}] Querying Metadata sObject [${sObjName}]`, LogLevel.TRACE);
				promises.push(
					this.queryData(org, sObjName, folderCode),
				);
			});

			Promise.all(promises)
				.then(() => { resolve(); })
				.catch((err) => { reject(err); });
		});
	}

	private queryData(org: OrgManager, sObjName: string, folderCode: string): Promise<void> {
		this.mapRecordsFetched.set(sObjName, {
			fetched: 0,
			records: [],
			total: -1,
		});

		return new Promise(
			(resolve, reject) => {
				// let records = [];
				org.conn.query(
					this.makeSOQL(org, sObjName),
					{ autoFetch: true },
					(qErr, queryResult) => {
						if (qErr) { reject(qErr); }

						this.getRecords(org, sObjName, queryResult)
							.then(() => {
								const data: IExportData = this.mapRecordsFetched.get(sObjName);
								const msg = `[${org.alias}] Queried [${sObjName}], retrieved ${data.total} records `;
								Util.writeLog(msg, LogLevel.INFO);
								Util.logResultsAdd(org, ResultOperation.EXPORT, sObjName, data.total, 0);

								// Checks....
								Util.assertEquals(data.fetched, data.total, "Not all the records were fetched [1].");
								Util.assertEquals(data.total, data.records.length, "Not all the records were fetched [2].");

								if (data.total >= 0) {
									org.settings.writeToFile(org.alias + folderCode, sObjName + ".json", data)
										.then(() => {
											// NOTE: Clean memory, and avoid heap dumps.
											data.records = [];
											// Now, resolve it.
											resolve();
										})
										.catch((err) => { reject(err); });
								} else {
									resolve();
								}
							})
							.catch((err) => { reject(err); });
					});
			},
		);
	}

	private makeSOQL(org: OrgManager, sObjName: string): string {
		let soql = "";

		if (org.coreMD.isMD(sObjName)) {
			soql += org.coreMD.makeSOQL(sObjName);
		} else {
			const sObjSettings = org.settings.getSObjectData(sObjName);

			soql += "SELECT " + org.discovery.getFields(sObjName) + " ";
			soql += "FROM " + sObjName + " ";
			if (sObjSettings.where != null) {
				soql += "WHERE " + sObjSettings.where + " ";
			}
			if (sObjSettings.orderBy != null) {
				soql += "ORDER BY " + sObjSettings.orderBy + " ";
			}
			if (sObjSettings.maxRecords > 0) {
				soql += "LIMIT " + sObjSettings.maxRecords + " ";
			}
		}
		Util.writeLog(`[${org.alias}] Querying [${sObjName}] with SOQL: [${soql}]`, LogLevel.TRACE);

		return soql;
	}

	// LEARNING: Querying sObject records. Performs a recursive call to invoke the QueryMore and get all the chunks.
	private getRecords(org: OrgManager, sObjName, queryResult): Promise<void> {
		return new Promise(
			(resolve, reject) => {
				const recordsFetched: IExportData = this.mapRecordsFetched.get(sObjName);
				recordsFetched.total = queryResult.totalSize;
				recordsFetched.fetched += queryResult.records.length;
				recordsFetched.records = recordsFetched.records.concat(queryResult.records);

				if (queryResult.done) {
					resolve();
				} else {
					org.conn.queryMore(queryResult.nextRecordsUrl, { autoFetch: true })
						.then((qRes) => {
							this.getRecords(org, sObjName, qRes)
								.then(() => { resolve(); })
								.catch((err) => { reject(err); });
						})
						.catch((err) => { reject(err); });
				}
			});
	}
}
