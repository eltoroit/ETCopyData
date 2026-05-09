import { OrgManager } from "./OrgManager.js";
import { IExportData } from "./Interfaces.js";
import { LogLevel, ResultOperation, Util } from "./Util.js";

let msg = "";
let chunkSize = 10000;

function splitIntoChunks(records: any[]): any[] {
	const output = [];
	for (let i = 0; i < records.length; i += chunkSize) {
		output.push(records.slice(i, i + chunkSize));
	}
	return output;
}

function countRecords(org: OrgManager, sObjName: string, operation: string, SOQL?: string): Promise<number> {
	// Uses Rest API, no need to use Bulk API for this simple count
	return new Promise((resolve, reject) => {
		let tmpSOQL: string = `SELECT count() FROM ${sObjName}`;
		if (SOQL) {
			// Add the filter criteria to count only specific records
			let a;
			a = `FROM ${sObjName}`;
			tmpSOQL = `${tmpSOQL.trim()} ${SOQL.substring(SOQL.indexOf(a) + a.length).trim()}`.trim();
			a = tmpSOQL.toUpperCase().indexOf("ORDER BY");
			if (a > 0) {
				tmpSOQL = tmpSOQL.substring(0, a).trim();
			}
		}
		const query = org.conn
			.query(tmpSOQL)
			.on("record", (record) => {
				// Do not remove this event handler!
				// console.log(record);
			})
			.on("end", () => {
				const data: any = query;
				msg = `[${org.alias}] Counted [${data.totalSize}] [${sObjName}] records (${operation})`;
				Util.writeLog(msg, LogLevel.DEBUG);
				resolve(data.totalSize);
			})
			.on("error", (err) => {
				msg = `[${org.alias}] Error counting [${sObjName}] records (${operation}) [${JSON.stringify(err)}]`;
				Util.writeLog(msg, LogLevel.ERROR);
				reject(err);
			})
			.run({ autoFetch: true, maxFetch: 100 });
	});
}

function progress(current, max): string {
	return `(${((100 * current) / max).toFixed(1)}%)`;
}

export default class Data {
	public static delete(org: OrgManager, sObjName: string): Promise<number> {
		if (!org.settings.useBulkAPI) {
			chunkSize = org.settings.restChunkSize;
		}
		if (org.settings.useBulkAPI) {
			return JsBulk.delete(org, sObjName);
		} else {
			return JsRest.delete(org, sObjName);
		}
	}
	public static upsert(org: any, operation: string, sObjName: string, allRecords: any[], matchingIds: any, extIdField): Promise<any> {
		if (!org.settings.useBulkAPI) {
			chunkSize = org.settings.restChunkSize;
		}
		if (org.settings.useBulkAPI) {
			return JsBulk.upsert(org, operation, sObjName, allRecords, matchingIds, extIdField);
		} else {
			return JsRest.upsert(org, operation, sObjName, allRecords, matchingIds, extIdField);
		}
	}
	public static update(org: any, sObjName: string, allRecords: any[]): Promise<any> {
		if (!org.settings.useBulkAPI) {
			chunkSize = org.settings.restChunkSize;
		}
		if (org.settings.useBulkAPI) {
			return JsBulk.update(org, sObjName, allRecords);
		} else {
			return JsRest.update(org, sObjName, allRecords);
		}
	}
	public static export(org: any, sObjName: string, SOQL: string, mapRecordsFetched: any, fileName: any): Promise<void> {
		if (!org.settings.useBulkAPI) {
			chunkSize = org.settings.restChunkSize;
		}
		if (org.settings.useBulkAPI) {
			return JsBulk.export(org, sObjName, SOQL, mapRecordsFetched, fileName);
		} else {
			return JsRest.export(org, sObjName, SOQL, mapRecordsFetched, fileName);
		}
	}
}

class JsBulk {
	public static delete(org: OrgManager, sObjName: string): Promise<number> {
		const total = { bad: 0, good: 0, totalSize: 0 };

		const deleteChunk = (chunk: any[]): Promise<any> => {
			return new Promise((resolve, reject) => {
				if (chunk.length === 0) {
					resolve(chunk);
				} else {
					const operation = "delete";
					const options: any = { concurrencyMode: "Parallel" };
					org.conn.bulk.pollTimeout = org.settings.bulkPollingTimeout;

					const job = org.conn.bulk.createJob(sObjName, operation, options);
					const batch = job.createBatch();
					let progressTimer: NodeJS.Timeout | null = null;
					batch.execute(chunk);
					batch.on("error", (batchError) => {
						if (progressTimer) clearInterval(progressTimer);
						msg = `[${org.alias}] Error deleting [${sObjName}] records  [${JSON.stringify(batchError)}]`;
						Util.writeLog(msg, LogLevel.ERROR);
						resolve(chunk);
					});
					batch.on("queue", (batchInfo) => {
						batch.poll(1000 /* interval(ms) */, org.settings.bulkPollingTimeout /* timeout(ms) */);
						progressTimer = JsBulk.startProgressPoller(batch, (n) =>
							`[${org.alias}] Deleting [${sObjName}]: [${n}/${total.totalSize}] records processed`
						);
					});
					batch.on("response", (results) => {
						if (progressTimer) clearInterval(progressTimer);
						for (const result of results) {
							total[result.success ? "good" : "bad"]++;
						}
						msg = `[${org.alias}] Deleting records from [${sObjName}] [Good: ${total.good}, bad: ${total.bad}] ${progress(total.good + total.bad, total.totalSize)}`;
						Util.writeLog(msg, LogLevel.INFO);
						JsBulk.closeJob(job, org.alias, sObjName, "Deleting").catch((err) => reject(err));
						resolve(chunk);
					});
				}
			});
		};

		const queryRecordsToDelete = (totalSize: number): Promise<any> => {
			return new Promise((resolve, reject) => {
				if (totalSize === 0) {
					resolve([]);
					return;
				} else {
					let chunks = [];
					const allChunks = [];
					let SOQLToDelete: string = `SELECT Id FROM ${sObjName}`;
					if (sObjName === "Contact" && org.discovery.getSObjects().get("Contact").fields.includes("IsPersonAccount")) {
						SOQLToDelete = `SELECT Id FROM ${sObjName} WHERE IsPersonAccount = false`;
					}
					org.conn.bulk.pollTimeout = org.settings.bulkPollingTimeout;

					// Use REST API query with streaming for Bulk delete operations
					// Bulk API 1.0 streaming interface is deprecated in @salesforce/core v7+
					const orgConn: any = org.conn;
					orgConn
						.query(SOQLToDelete)
						.on("record", (record) => {
							chunks.push(record);
							if (chunks.length >= chunkSize) {
								allChunks.push(chunks);
								msg = `[${org.alias}] Querying [${sObjName}] records to be deleted. [${allChunks.length * chunkSize}] ${progress(allChunks.length * chunkSize, totalSize)}`;
								Util.writeLog(msg, LogLevel.INFO);
								chunks = [];
							}
						})
						.on("end", () => {
							msg = `[${org.alias}] Queried [${allChunks.length * chunkSize + chunks.length}] [${sObjName}] records to be deleted.`;
							allChunks.push(chunks);
							Util.writeLog(msg, LogLevel.INFO);
							resolve(allChunks);
						})
						.on("error", (err) => {
							msg = `[${org.alias}] Error querying [${sObjName}] records to be deleted [${JSON.stringify(err)}]`;
							Util.writeLog(msg, LogLevel.ERROR);
							reject(err);
						})
						.run({ autoFetch: true, maxFetch: totalSize });
				}
			});
		};

		return new Promise((resolve, reject) => {
			countRecords(org, sObjName, "Deleting")
				.then((totalSize) => {
					total.totalSize = totalSize;
					return queryRecordsToDelete(totalSize);
				})
				.then(async (allChunks) => {
					let count = 0;
					for (const chunk of allChunks) {
						// eslint-disable-next-line no-await-in-loop
						await deleteChunk(chunk);
						count += chunk.length;
						Util.writeLog(`[${org.alias}] Deleted [${count}/${total.totalSize}] [${sObjName}] records`, LogLevel.INFO);
					}
					return Promise.resolve();
				})
				.then((promisesResult) => {
					if (total.good + total.bad > 0) {
						msg = `[${org.alias}] Deleted [${total.good}] [${sObjName}] records [Good: ${total.good}, bad: ${total.bad}]`;
						Util.writeLog(msg, LogLevel.INFO);
					}
					resolve(total.bad);
				})
				.catch((err) => {
					msg = `[${org.alias}] Error deleting [${sObjName}] records [${JSON.stringify(err)}]`;
					Util.writeLog(msg, LogLevel.ERROR);
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
				msg = "";
				if (results[i].success) {
					total.good++;
					matchingIds.get(sObjName).set(chunk[i].Id, results[i].id);

					// VERBOSE: Show record was added succesfully
					msg += `[${org.alias}] Successfully imported [${sObjName}] record #${offset + i + 1}. `;
					msg += `Ids mapped: [${chunk[i].Id}] => [${results[i].id}] ${progress(total.good + total.bad, allRecords.length)}`;
					Util.writeLog(msg, LogLevel.TRACE);
				} else {
					total.bad++;
					msg += `*** [${org.alias}] Error importing [${sObjName}] record #${offset + i + 1}. `;
					msg += JSON.stringify(results[i].errors);
					Util.writeLog(msg, LogLevel.ERROR);
				}
			}
			msg = `[${org.alias}] Importing [${sObjName}] records ${progress(total.good + total.bad, allRecords.length)}`;
			Util.writeLog(msg, LogLevel.INFO);
		};

		const upsertChunk = (chunk: any[]): Promise<any> => {
			return new Promise((resolve, reject) => {
				org.conn.bulk.pollTimeout = org.settings.bulkPollingTimeout;
				const options: any = { concurrencyMode: "Parallel", extIdField };
				Util.writeLog(
					`[${org.alias}] Importing [${total.good + total.bad + chunk.length}] [${sObjName}] records using [${operation}] with external Id [${options.extIdField}] ${progress(
						total.good + total.bad + chunk.length,
						allRecords.length
					)}`,
					LogLevel.TRACE
				);
				const job = org.conn.bulk.createJob(sObjName, operation, options);
				const batch = job.createBatch();
				let progressTimer: NodeJS.Timeout | null = null;
				batch.execute(chunk);
				batch.on("error", (err) => {
					if (progressTimer) clearInterval(progressTimer);
					processResults(err, total.good + total.bad, chunk, null);
					reject(err);
				});
				batch.on("queue", (batchInfo) => {
					batch.poll(1000 /* interval(ms) */, org.settings.bulkPollingTimeout /* timeout(ms) */);
					progressTimer = JsBulk.startProgressPoller(batch, (n) =>
						`[${org.alias}] ${operation} [${sObjName}]: [${total.good + total.bad + n}/${allRecords.length}] records processed`
					);
				});
				batch.on("response", (results) => {
					if (progressTimer) clearInterval(progressTimer);
					// Fired when batch finished and result retrieved
					processResults(null, total.good + total.bad, chunk, results);
					JsBulk.closeJob(job, org.alias, sObjName, operation).catch((err) => reject(err));
					resolve(total);
				});
			});
		};

		return new Promise((resolve, reject) => {
			const chunks = splitIntoChunks(allRecords);
			const promises = chunks.map((chunk) => {
				return upsertChunk(chunk);
			});

			Promise.allSettled(promises)
				.then((promisesResult) => {
					msg = "";
					msg += `[${org.alias}] Imported [${sObjName}]. `;
					msg += `Record count: [Good = ${total.good}, Bad = ${total.bad}]`;
					Util.writeLog(msg, LogLevel.INFO);
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
					Util.writeLog(
						`[${org.alias}] Successfully updated references in [${sObjName}] record #${i + 1}, old Id [${chunk[i].Id}] ${progress(total.good + total.bad, allRecords.length)}`,
						LogLevel.TRACE
					);
				} else {
					total.bad++;
					Util.writeLog(`[${org.alias}] Error updating references in [${sObjName}] record #${i + 1}, old Id [${chunk[i].Id}]` + JSON.stringify(results[i].errors), LogLevel.TRACE);
				}
			}

			Util.writeLog(`[${org.alias}] Updated references for [${sObjName}]. ${progress(total.good + total.bad, allRecords.length)}`, LogLevel.INFO);
		};

		const updateChunk = (chunk: any[]): Promise<any> => {
			return new Promise((resolve, reject) => {
				org.conn.bulk.pollTimeout = org.settings.bulkPollingTimeout;
				const options: any = { concurrencyMode: "Parallel", extIdField: null };
				Util.writeLog(`Updating [${chunk.length}] [${sObjName}] records`, LogLevel.TRACE);
				const job = org.conn.bulk.createJob(sObjName, "update", options);
				const batch = job.createBatch();
				let progressTimer: NodeJS.Timeout | null = null;
				batch.execute(chunk);
				batch.on("error", (err) => {
					if (progressTimer) clearInterval(progressTimer);
					processResults(err, chunk, null);
					reject(err);
				});
				batch.on("queue", (batchInfo) => {
					batch.poll(1000 /* interval(ms) */, org.settings.bulkPollingTimeout /* timeout(ms) */);
					progressTimer = JsBulk.startProgressPoller(batch, (n) =>
						`[${org.alias}] Updating [${sObjName}]: [${total.good + total.bad + n}/${allRecords.length}] records processed`
					);
				});
				batch.on("response", (results) => {
					if (progressTimer) clearInterval(progressTimer);
					// Fired when batch finished and result retrieved
					processResults(null, chunk, results);
					JsBulk.closeJob(job, org.alias, sObjName, "Updating").catch((err) => reject(err));
					resolve(total);
				});
			});
		};

		return new Promise((resolve, reject) => {
			const chunks = splitIntoChunks(allRecords);
			const promises = chunks.map((chunk) => {
				return updateChunk(chunk);
			});

			Promise.allSettled(promises)
				.then((promisesResult) => {
					msg = "";
					msg += `[${org.alias}] Updated [${sObjName}]. `;
					msg += `Record count: [Good = ${total.good}, Bad = ${total.bad}]`;
					Util.writeLog(msg, LogLevel.INFO);
					// Util.logResultsAdd(org, ResultOperation.IMPORT, sObjName, total.good, total.bad);
					resolve(total.bad);
				})
				.catch((err) => {
					reject(err);
				});
		});
	}
	public static export(org: any, sObjName: string, SOQL: string, mapRecordsFetched: any, fileName: any): Promise<void> {
		return new Promise((resolve, reject) => {
			countRecords(org, sObjName, "Exporting", SOQL)
				.then((maxFetch) => {
					const records = [];
					// Use REST API query with streaming for Bulk export operations
					// Bulk API 1.0 streaming interface is deprecated in @salesforce/core v7+
					const query: any = org.conn
						.query(SOQL)
						.on("record", (record) => {
							records.push(record);
							const recordCount = records.length;
							if (recordCount % chunkSize === 0) {
								msg = `[${org.alias}] Querying [${sObjName}], retrieved ${recordCount} records ${progress(recordCount, maxFetch)}`;
								Util.writeLog(msg, LogLevel.INFO);
							}
						})
						.on("end", () => {
							msg = `[${org.alias}] Queried [${sObjName}], retrieved ${records.length} records `;
							Util.writeLog(msg, LogLevel.INFO);
							Util.logResultsAdd(org, ResultOperation.EXPORT, sObjName, records.length, 0);

							const data = {
								fetched: records.length,
								records,
								total: query.totalSize || records.length
							};
							org.settings
								.writeToFile(fileName.folder, fileName.file, data)
								.then(() => {
									// Now, resolve it.
									resolve();
								})
								.catch((err) => {
									reject(err);
								});
						})
						.on("error", (err) => {
							reject(err);
						})
						.run({ autoFetch: true, maxFetch });
				})
				.catch((err) => reject(err));
		});
	}
	private static startProgressPoller(batch: any, buildMsg: (n: number) => string): NodeJS.Timeout {
		return setInterval(() => {
			batch.check((err: any, info: any) => {
				if (err || !info) return;
				const n = parseInt(info.numberRecordsProcessed, 10) || 0;
				Util.writeLog(buildMsg(n), LogLevel.INFO);
			});
		}, 5000);
	}
	private static closeJob(job: any, orgAlias: string, sObjName: string, operation: string): Promise<void> {
		return new Promise((resolve, reject) => {
			job.close()
				.then(() => {
					msg = `[${orgAlias}] Closed Bulk API job for [${operation}] on [${sObjName}]`;
					Util.writeLog(msg, LogLevel.TRACE);
				})
				.catch((err) => {
					msg = `[${orgAlias}] Error closing job for [${operation}] on [${sObjName}] [${JSON.stringify(err)}]`;
					Util.writeLog(msg, LogLevel.ERROR);
					reject(err);
				});
		});
	}
}

class JsRest {
	public static delete(org: OrgManager, sObjName: string): Promise<number> {
		const total = { bad: 0, good: 0, totalSize: 0 };

		const deleteChunk = (chunk: any[]): Promise<any> => {
			return new Promise((resolve, reject) => {
				if (chunk.length === 0) {
					resolve(chunk);
				} else {
					const orgConn: any = org.conn;
					orgConn
						.sobject(sObjName)
						.destroy(chunk, true)
						.then((rets: any[]) => {
							rets.forEach((ret) => {
								total[ret.success ? "good" : "bad"]++;
								if (!ret.success) {
									msg = `[${org.alias}] Error deleting record from [${sObjName}] ${JSON.stringify(ret.errors)}`;
									Util.writeLog(msg, LogLevel.ERROR);
								}
							});
							msg = `[${org.alias}] Deleting records from [${sObjName}] [Good: ${total.good}, bad: ${total.bad}] ${progress(total.good + total.bad, total.totalSize)}`;
							Util.writeLog(msg, LogLevel.DEBUG);
							resolve(chunk);
						})
						.catch((err) => {
							msg = `[${org.alias}] Error deleting [${sObjName}] records [${JSON.stringify(err)}]`;
							Util.writeLog(msg, LogLevel.ERROR);
							reject(err);
						});
				}
			});
		};

		const queryRecordsToDelete = (totalSize: number): Promise<any> => {
			return new Promise((resolve, reject) => {
				if (totalSize === 0) {
					resolve([]);
				} else {
					let chunks = [];
					const allChunks = [];
					const orgConn: any = org.conn;
					let SOQLToDelete: string = `SELECT Id FROM ${sObjName}`;
					if (sObjName === "Contact" && org.discovery.getSObjects().get(sObjName).fields.includes("IsPersonAccount")) {
						SOQLToDelete = `SELECT Id FROM ${sObjName} WHERE IsPersonAccount = false`;
					}
					orgConn
						.query(SOQLToDelete)
						.on("record", (record) => {
							chunks.push(record.Id);
							if (chunks.length >= chunkSize) {
								allChunks.push(chunks);
								msg = `[${org.alias}] Querying [${sObjName}] records to be deleted. [${allChunks.length * chunkSize}] ${progress(allChunks.length * chunkSize, totalSize)}`;
								Util.writeLog(msg, LogLevel.DEBUG);
								chunks = [];
							}
						})
						.on("end", () => {
							msg = `[${org.alias}] Queried [${allChunks.length * chunkSize + chunks.length}] [${sObjName}] records to be deleted.`;
							allChunks.push(chunks);
							Util.writeLog(msg, LogLevel.DEBUG);
							resolve(allChunks);
						})
						.on("error", (err) => {
							msg = `[${org.alias}] Error querying [${sObjName}] records to be deleted [${JSON.stringify(err)}]`;
							Util.writeLog(msg, LogLevel.ERROR);
							reject(err);
						})
						.run({ autoFetch: true, maxFetch: totalSize });
				}
			});
		};

		return new Promise((resolve, reject) => {
			countRecords(org, sObjName, "Deleting")
				.then((totalSize) => {
					total.totalSize = totalSize;
					return queryRecordsToDelete(totalSize);
				})
				.then((allChunks) => {
					// SERIES
					const processData = async (chunks): Promise<void> => {
						let count = 0;
						for (const chunk of chunks) {
							// eslint-disable-next-line no-await-in-loop
							await deleteChunk(chunk);
							count += chunk.length;
							Util.writeLog(`[${org.alias}] Deleted [${count}/${total.totalSize}] [${sObjName}] records`, LogLevel.INFO);
						}
					};
					return processData(allChunks);

					// PARALLEL
					// for (const chunk of allChunks) {
					// 	// eslint-disable-next-line no-await-in-loop
					// 	await deleteChunk(chunk);
					// }
					// return Promise.resolve();
				})
				.then((promisesResult) => {
					if (total.good + total.bad > 0) {
						msg = `[${org.alias}] Deleted [${total.good}] [${sObjName}] records [Good: ${total.good}, bad: ${total.bad}]`;
						Util.writeLog(msg, LogLevel.INFO);
					}
					resolve(total.bad);
				})
				.catch((err) => {
					msg = `[${org.alias}] Error deleting [${sObjName}] records [${JSON.stringify(err)}]`;
					Util.writeLog(msg, LogLevel.ERROR);
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
				msg = "";
				if (results[i].success) {
					total.good++;
					matchingIds.get(sObjName).set(chunk[i].Id, results[i].id);

					// VERBOSE: Show record was added succesfully
					msg += `[${org.alias}] Successfully imported [${sObjName}] record #${offset + i + 1}. `;
					msg += `Ids mapped: [${chunk[i].Id}] => [${results[i].id}] ${progress(total.good + total.bad, allRecords.length)}`;
					Util.writeLog(msg, LogLevel.TRACE);
				} else {
					total.bad++;
					msg += `*** [${org.alias}] Error importing [${sObjName}] record #${offset + i + 1}. `;
					msg += JSON.stringify(results[i].errors);
					Util.writeLog(msg, LogLevel.ERROR);
				}
			}
			msg = `[${org.alias}] Importing [${sObjName}] records ${progress(total.good + total.bad, allRecords.length)}`;
			Util.writeLog(msg, LogLevel.DEBUG);
		};

		const upsertChunk = (chunk: any[]): Promise<any> => {
			return new Promise((resolve, reject) => {
				Util.writeLog(`[${org.alias}] Importing [${chunk.length}] [${sObjName}] records using [${operation}] with external Id [${extIdField}]`, LogLevel.TRACE);
				let promise;
				if (operation === "insert") {
					promise = org.conn.sobject(sObjName).insert(chunk);
				} else if (operation === "upsert") {
					promise = org.conn.sobject(sObjName).upsert(chunk, extIdField);
				}
				promise
					.then((results) => {
						processResults(null, total.good + total.bad, chunk, results);
						resolve(total);
					})
					.catch((err) => {
						processResults(err, total.good + total.bad, chunk, null);
						reject(err);
					});
			});
		};

		return new Promise((resolve, reject) => {
			Promise.resolve()
				.then(() => {
					// SERIES
					const processData = async (chunks): Promise<void> => {
						for (const chunk of chunks) {
							// eslint-disable-next-line no-await-in-loop
							await upsertChunk(chunk);
							Util.writeLog(`[${org.alias}] Imported [${total.good + total.bad}/${allRecords.length}] [${sObjName}] records`, LogLevel.INFO);
						}
					};
					return processData(splitIntoChunks(allRecords));

					// PARALLEL
					// const chunks = splitIntoChunks(allRecords);
					// const promises = chunks.map((chunk) => {
					// 	return upsertChunk(chunk);
					// });
					// return Promise.allSettled(promises)
				})
				.then(() => {
					msg = "";
					msg += `[${org.alias}] Imported [${sObjName}]. `;
					msg += `Record count: [Good = ${total.good}, Bad = ${total.bad}]`;
					Util.writeLog(msg, LogLevel.INFO);
					Util.logResultsAdd(org, ResultOperation.IMPORT, sObjName, total.good, total.bad);
					resolve(total.bad);
				})
				.catch((err) => reject(err));
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
					Util.writeLog(
						`[${org.alias}] Successfully updated references in [${sObjName}] record #${i + 1}, old Id [${chunk[i].Id}] ${progress(total.good + total.bad, allRecords.length)}`,
						LogLevel.TRACE
					);
				} else {
					total.bad++;
					Util.writeLog(`[${org.alias}] Error updating references in [${sObjName}] record #${i + 1}, old Id [${chunk[i].Id}]` + JSON.stringify(results[i].errors), LogLevel.ERROR);
				}
			}

			Util.writeLog(
				`[${org.alias}] Updated references for [${sObjName}]. Record count: [Good = ${total.good}, Bad = ${total.bad}] ${progress(total.good + total.bad, allRecords.length)}`,
				LogLevel.INFO
			);
		};

		const updateChunk = (chunk: any[]): Promise<any> => {
			return new Promise((resolve, reject) => {
				Util.writeLog(`[${org.alias}] Updating [${chunk.length}] [${sObjName}] records`, LogLevel.TRACE);
				org.conn
					.sobject(sObjName)
					.update(chunk)
					.then((results) => {
						processResults(null, chunk, results);
						resolve(total);
					})
					.catch((err) => {
						processResults(err, chunk, null);
						reject(err);
					});
			});
		};

		return new Promise((resolve, reject) => {
			Promise.resolve()
				.then(async () => {
					const chunks = splitIntoChunks(allRecords);
					for (const chunk of chunks) {
						// eslint-disable-next-line no-await-in-loop
						await updateChunk(chunk);
						Util.writeLog(`[${org.alias}] Updated [${total.good + total.bad}/${allRecords.length}] [${sObjName}] records`, LogLevel.INFO);
					}
				})
				.then(() => {
					msg = "";
					msg += `[${org.alias}] Updated [${sObjName}]. `;
					msg += `Record count: [Good = ${total.good}, Bad = ${total.bad}]`;
					Util.writeLog(msg, LogLevel.INFO);
					// Util.logResultsAdd(org, ResultOperation.IMPORT, sObjName, total.good, total.bad);
					resolve(total.bad);
				})
				.catch((err) => {
					reject(err);
				});
		});
	}
	public static export(org: any, sObjName: string, SOQL: string, mapRecordsFetched: any, fileName: any): Promise<void> {
		return new Promise((resolve, reject) => {
			countRecords(org, sObjName, "Exporting", SOQL)
				.then((maxFetch) => {
					const records = [];
					const query: any = org.conn
						.query(SOQL)
						.on("record", (record) => {
							records.push(record);
							const recordCount = records.length;
							if (recordCount % chunkSize === 0) {
								msg = `[${org.alias}] Querying [${sObjName}], retrieved ${recordCount} records ${progress(recordCount, maxFetch)}`;
								Util.writeLog(msg, LogLevel.INFO);
							}
						})
						.on("end", () => {
							msg = `[${org.alias}] Queried [${sObjName}], retrieved ${records.length} records `;
							Util.writeLog(msg, LogLevel.DEBUG);
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
}
