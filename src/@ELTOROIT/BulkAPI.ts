import { OrgManager } from "./OrgManager";
import { IExportData } from "./Interfaces";
import { LogLevel, ResultOperation, Util } from "./Util";

export default class BulkAPI {
	private static msg = "";
	private static chunkSize = 10000;

	public static delete(org: OrgManager, sObjName: string): Promise<number> {
		const total = { bad: 0, good: 0, totalSize: 0 };

		const deleteChunk = (chunk: any[]): Promise<any> => {
			return new Promise((resolve, reject) => {
				if (chunk.length === 0) {
					resolve(chunk);
				} else {
					const operation = "delete";
					const options: any = { concurrencyMode: "Parallel" };
					org.conn.bulk.pollTimeout = org.settings.pollingTimeout;

					const job = org.conn.bulk.createJob(sObjName, operation, options);
					const batch = job.createBatch();
					batch.execute(chunk);
					batch.on("error", (batchError) => {
						BulkAPI.msg = `[${org.alias}] Error deleting [${sObjName}] records  [${JSON.stringify(batchError)}]`;
						Util.writeLog(BulkAPI.msg, LogLevel.ERROR);
						resolve(chunk);
					});
					batch.on("queue", (batchInfo) => {
						// // Fired when batch request is queued in server.
						// // Start polling - Do not poll until the batch has started
						batch.poll(1000 /* interval(ms) */, org.settings.pollingTimeout /* timeout(ms) */);
					});
					batch.on("response", (results) => {
						for (const result of results) {
							total[result.success ? "good" : "bad"]++;
						}
						BulkAPI.msg = `[${org.alias}] Deleting records from [${sObjName}] [Good: ${total.good}, bad: ${total.bad}] (${((100 * (total.good + total.bad)) / total.totalSize).toFixed(
							1
						)}%)`;
						Util.writeLog(BulkAPI.msg, LogLevel.TRACE);
						resolve(chunk);
					});
					batch.on("progress", (batchInfo) => {
						// debugger;
						// Fired with temporary progress
						// console.log(new Date().toJSON(), JSON.stringify(batchInfo, null, 2));
					});
				}
			});
		};

		const queryRecords = (totalSize: number): Promise<any> => {
			return new Promise((resolve, reject) => {
				if (totalSize === 0) {
					resolve([]);
					return;
				} else {
					let chunks = [];
					const allChunks = [];
					org.conn.bulk.pollTimeout = org.settings.pollingTimeout;
					org.conn.bulk
						.query(`SELECT Id FROM ${sObjName}`)
						.on("record", (record) => {
							chunks.push(record);
							if (chunks.length >= BulkAPI.chunkSize) {
								allChunks.push(chunks);
								BulkAPI.msg = `[${org.alias}] Querying [${sObjName}] records to be deleted. [${allChunks.length * BulkAPI.chunkSize}]`;
								Util.writeLog(BulkAPI.msg, LogLevel.TRACE);
								chunks = [];
							}
						})
						.on("end", () => {
							BulkAPI.msg = `[${org.alias}] Queried [${allChunks.length * BulkAPI.chunkSize + chunks.length}] [${sObjName}] records to be deleted.`;
							allChunks.push(chunks);
							Util.writeLog(BulkAPI.msg, LogLevel.INFO);
							resolve(allChunks);
						})
						.on("progress", (batchInfo) => {
							// debugger;
							// Fired with temporary progress
							// console.log(new Date().toJSON(), JSON.stringify(batchInfo, null, 2));
						})
						.on("error", (err) => {
							BulkAPI.msg = `[${org.alias}] Error querying [${sObjName}] records to be deleted [${JSON.stringify(err)}]`;
							Util.writeLog(BulkAPI.msg, LogLevel.ERROR);
							reject(err);
						});
				}
			});
		};

		return new Promise((resolve, reject) => {
			BulkAPI.countRecords(org, sObjName, "Deleting")
				.then((totalSize) => {
					total.totalSize = totalSize;
					return queryRecords(totalSize);
				})
				.then(async (allChunks) => {
					for (const chunk of allChunks) {
						// eslint-disable-next-line no-await-in-loop
						await deleteChunk(chunk);
					}
					return Promise.resolve();
				})
				.then((promisesResult) => {
					if (total.good + total.bad > 0) {
						BulkAPI.msg = `[${org.alias}] Deleted [${total.good}] [${sObjName}] records [Good: ${total.good}, bad: ${total.bad}]`;
						Util.writeLog(BulkAPI.msg, LogLevel.INFO);
					}
					resolve(total.bad);
				})
				.catch((err) => {
					BulkAPI.msg = `[${org.alias}] Error deleting [${sObjName}] records [${JSON.stringify(err)}]`;
					Util.writeLog(BulkAPI.msg, LogLevel.ERROR);
					reject(err);
				});
		});
	}

	public static upsert(org: any, operation: string, sObjName: string, allRecords: any[], matchingIds: any, extIdField): Promise<any> {
		const total = { bad: 0, good: 0 };

		const processResults = (error, offset, chunk: any[], results: any[]): void => {
			if (error) {
				total.bad += chunk.length;
				throw new Error(error);
			}

			// NOTE: I need a traditional loop because the index (i) will be used in two lists of same size and same order.
			for (let i = 0; i < results.length; i++) {
				BulkAPI.msg = "";
				if (results[i].success) {
					total.good++;
					matchingIds.get(sObjName).set(chunk[i].Id, results[i].id);

					// VERBOSE: Show record was added succesfully
					BulkAPI.msg += `[${org.alias}] Successfully imported [${sObjName}] record #${offset + i + 1}. `;
					BulkAPI.msg += `Ids mapped: [${chunk[i].Id}] => [${results[i].id}]`;
					Util.writeLog(BulkAPI.msg, LogLevel.TRACE);
				} else {
					total.bad++;
					BulkAPI.msg += `*** [${org.alias}] Error importing [${sObjName}] record #${offset + i + 1}. `;
					BulkAPI.msg += JSON.stringify(results[i].errors);
					Util.writeLog(BulkAPI.msg, LogLevel.ERROR);
				}
			}
		};

		const upsertChunk = (chunk: any[]): Promise<any> => {
			return new Promise((resolve, reject) => {
				org.conn.bulk.pollTimeout = org.settings.pollingTimeout;
				const options: any = { concurrencyMode: "Parallel", extIdField };
				Util.writeLog(`[${org.alias}] Importing [${chunk.length}] [${sObjName}] records using [${operation}] with external Id [${options.extIdField}]`, LogLevel.TRACE);
				const job = org.conn.bulk.createJob(sObjName, operation, options);
				const batch = job.createBatch();
				batch.execute(chunk);
				batch.on("error", (batchError) => {
					processResults(batchError, total.good + total.bad, chunk, null);
					reject(total);
				});
				batch.on("queue", (batchInfo) => {
					// Fired when batch request is queued in server.
					// Start polling - Do not poll until the batch has started
					batch.poll(1000 /* interval(ms) */, org.settings.pollingTimeout /* timeout(ms) */);
				});
				batch.on("response", (results) => {
					// Fired when batch finished and result retrieved
					processResults(null, total.good + total.bad, chunk, results);
					resolve(total);
				});
				batch.on("progress", (batchInfo) => {
					// Fired with temporary progress
					// console.log(JSON.stringify(batchInfo, null, 2));
					// debugger;
				});
			});
		};

		return new Promise((resolve, reject) => {
			const chunks = BulkAPI.splitIntoChunks(allRecords);
			const promises = chunks.map((chunk) => {
				return upsertChunk(chunk);
			});

			Promise.allSettled(promises)
				.then((promisesResult) => {
					BulkAPI.msg = "";
					BulkAPI.msg += `[${org.alias}] Imported [${sObjName}]. `;
					BulkAPI.msg += `Record count: [Good = ${total.good}, Bad = ${total.bad}]`;
					Util.writeLog(BulkAPI.msg, LogLevel.INFO);
					Util.logResultsAdd(org, ResultOperation.IMPORT, sObjName, total.good, total.bad);
					resolve(total.bad);
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	public static update(org: any, sObjName: string, allRecords: any[]): Promise<any> {
		const total = { bad: 0, good: 0 };

		const processResults = (error, chunk: any[], results: any[]): void => {
			if (error) {
				throw new Error(error);
			}

			for (let i = 0; i < results.length; i++) {
				if (results[i].success) {
					total.good++;
					Util.writeLog(`[${org.alias}] Successfully updated references in [${sObjName}] record #${i + 1}, old Id [${chunk[i].Id}]`, LogLevel.TRACE);
				} else {
					total.bad++;
					Util.writeLog(`[${org.alias}] Error updating references in [${sObjName}] record #${i + 1}, old Id [${chunk[i].Id}]` + JSON.stringify(results[i].errors), LogLevel.TRACE);
				}
			}

			Util.writeLog(`[${org.alias}] Updated references for [${sObjName}]. Record count: [Good = ${total.good}, Bad = ${total.bad}]`, LogLevel.TRACE);
		};

		const updateChunk = (chunk: any[]): Promise<any> => {
			return new Promise((resolve, reject) => {
				org.conn.bulk.pollTimeout = org.settings.pollingTimeout;
				const options: any = { concurrencyMode: "Parallel", extIdField: null };
				Util.writeLog(`Updating [${chunk.length}] [${sObjName}] records`, LogLevel.TRACE);
				const job = org.conn.bulk.createJob(sObjName, "update", options);
				const batch = job.createBatch();
				batch.execute(chunk);
				batch.on("error", (batchError) => {
					processResults(batchError, chunk, null);
					reject(total);
				});
				batch.on("queue", (batchInfo) => {
					// Fired when batch request is queued in server.
					// Start polling - Do not poll until the batch has started
					batch.poll(1000 /* interval(ms) */, org.settings.pollingTimeout /* timeout(ms) */);
				});
				batch.on("response", (results) => {
					// Fired when batch finished and result retrieved
					processResults(null, chunk, results);
					resolve(total);
				});
				batch.on("progress", (batchInfo) => {
					// Fired with temporary progress
					// console.log(JSON.stringify(batchInfo, null, 2));
					// debugger;
				});
			});
		};

		return new Promise((resolve, reject) => {
			const chunks = BulkAPI.splitIntoChunks(allRecords);
			const promises = chunks.map((chunk) => {
				return updateChunk(chunk);
			});

			Promise.allSettled(promises)
				.then((promisesResult) => {
					BulkAPI.msg = "";
					BulkAPI.msg += `[${org.alias}] Updated [${sObjName}]. `;
					BulkAPI.msg += `Record count: [Good = ${total.good}, Bad = ${total.bad}]`;
					Util.writeLog(BulkAPI.msg, LogLevel.INFO);
					// Util.logResultsAdd(org, ResultOperation.IMPORT, sObjName, total.good, total.bad);
					resolve(total.bad);
				})
				.catch((temp2) => {
					reject(total.bad);
				});
		});
	}

	public static export(org: any, sObjName: string, SOQL: string, mapRecordsFetched: any, fileName: any): Promise<void> {
		return new Promise((resolve, reject) => {
			this.countRecords(org, sObjName, "Exporting")
				.then((maxFetch) => {
					const records = [];
					const query: any = org.conn
						.query(SOQL)
						.on("record", (record) => {
							records.push(record);
							const recordCount = records.length;
							if (recordCount % BulkAPI.chunkSize === 0) {
								const msg = `[${org.alias}] Querying [${sObjName}], retrieved ${recordCount} records (${((100 * recordCount) / maxFetch).toFixed(1)}%)`;
								Util.writeLog(msg, LogLevel.TRACE);
							}
						})
						.on("end", () => {
							const msg = `[${org.alias}] Queried [${sObjName}], retrieved ${records.length} records `;
							Util.writeLog(msg, LogLevel.INFO);
							Util.logResultsAdd(org, ResultOperation.EXPORT, sObjName, records.length, 0);

							const data: IExportData = mapRecordsFetched.get(sObjName);
							data.total = query.totalSize;
							data.fetched = records.length;
							data.records = records;

							// Checks....
							Util.assertEquals(data.fetched, data.total, "Not all the records were fetched [1].");
							Util.assertEquals(data.total, data.records.length, "Not all the records were fetched [2].");

							if (data.total >= 0) {
								org.settings
									.writeToFile(fileName.folder, fileName.file, data)
									.then(() => {
										// NOTE: Clean memory, and avoid heap overflow.
										data.records = [];
										// Now, resolve it.
										resolve();
									})
									.catch((err) => {
										reject(err);
									});
							} else {
								resolve();
							}
						})
						.on("error", (err) => {
							reject(err);
						})
						.run({ autoFetch: true, maxFetch });
				})
				.catch((err) => reject(err));
		});
	}

	private static countRecords(org: OrgManager, sObjName: string, operation: string): Promise<number> {
		return new Promise((resolve, reject) => {
			const query = org.conn
				.query(`SELECT count() FROM ${sObjName}`)
				.on("record", (record) => {
					// Do not remove this event handler!
					// console.log(record);
				})
				.on("end", () => {
					const data: any = query;
					BulkAPI.msg = `[${org.alias}] Counted [${data.totalSize}] [${sObjName}] records (${operation})`;
					Util.writeLog(BulkAPI.msg, LogLevel.INFO);
					resolve(data.totalSize);
				})
				.on("error", (err) => {
					BulkAPI.msg = `[${org.alias}] Error counting [${sObjName}] records (${operation}) [${JSON.stringify(err)}]`;
					Util.writeLog(BulkAPI.msg, LogLevel.ERROR);
					reject(err);
				})
				.run({ autoFetch: true, maxFetch: 100 });
		});
	}

	private static splitIntoChunks(records: any[]): any[] {
		const output = [];
		for (let i = 0; i < records.length; i += BulkAPI.chunkSize) {
			output.push(records.slice(i, i + BulkAPI.chunkSize));
		}
		return output;
	}
}
