import { UX } from "@salesforce/command";
import { Result } from "@salesforce/command/lib/sfdxCommand";
import { Logger, SfdxError } from "@salesforce/core";
import { AnyFunction } from "@salesforce/ts-types";
import { OrgManager } from "./OrgManager";
// import { asAnyJson } from "@salesforce/ts-types";

// TRACE is just for making sure the code works.
export enum LogLevel {
	TRACE = 1,
	DEBUG = 2,
	INFO = 3,
	WARN = 4,
	ERROR = 5,
	FATAL = 6
}
export enum ResultOperation {
	SCHEMA,
	DELETE,
	EXPORT,
	IMPORT
}

export interface ILogger {
	entryNumber: string;
	level: string;
	lineNumber: string;
	timestamp: string;
	description: string;
}

// TODO: Create a function that returns the logs filtered so you only see WARN and above.
// TODO: Create another function that sumarizes the logs {FATAL: 0, ERROR: 3, WARN: 10, INFO: ...
// TODO: Have a "silent" mode for CI/CD that returns the summary of errors.

export class Util {
	public static isAborted: boolean = false;
	public static abortedCounter: number = 0;

	public static assert(condition: boolean, msg: string) {
		if (!condition) {
			this.throwError("ASSERT failed: " + msg);
		}
	}

	public static assertEquals(expected: any, actual: any, msg: string) {
		if (expected !== actual) {
			this.throwError("ASSERT failed: " + msg + ": Expected: " + expected + ", Actual: " + actual);
		}
	}

	public static assertNotEquals(expected: any, actual: any, msg: string) {
		if (expected === actual) {
			this.throwError("ASSERT failed: " + msg + ": Same value: " + expected);
		}
	}

	public static throwError(msg: any) {
		this.isAborted = true;
		this.abortedCounter++;

		if (msg.stack) {
			Util.writeLog(`*** Abort Counter: ${this.abortedCounter} ***`, LogLevel.FATAL);
			Util.writeLog(msg.stack, LogLevel.FATAL);
		}

		throw new SfdxError(msg, "Error", null, -1);
	}

	public static doesLogOutputsEachStep(): boolean {
		return this.desiredLogLevel <= LogLevel.INFO;
	}

	public static setLogLevel(desiredLogLevel: string) {
		desiredLogLevel = desiredLogLevel.toUpperCase();

		switch (LogLevel[desiredLogLevel]) {
			case LogLevel.TRACE:
				this.desiredLogLevel = LogLevel.TRACE;
				break;
			case LogLevel.DEBUG:
				this.desiredLogLevel = LogLevel.DEBUG;
				break;
			case LogLevel.INFO:
				this.desiredLogLevel = LogLevel.INFO;
				break;
			case LogLevel.WARN:
				this.desiredLogLevel = LogLevel.WARN;
				break;
			case LogLevel.ERROR:
				this.desiredLogLevel = LogLevel.ERROR;
				break;
			case LogLevel.FATAL:
				this.desiredLogLevel = LogLevel.FATAL;
				break;
			default:
				Util.throwError("ERROR: Level [" + LogLevel[desiredLogLevel] + "] not available for logging");
				break;
		}
	}

	public static writeLog(message: any, level: LogLevel) {
		if (!this.desiredLogLevel) {
			// If the desiredLogLevel has not been initialized, error out.
			Util.throwError("Log Level not set. Call Util.setLogLevel(LogLevel).");
		}

		if (level < this.desiredLogLevel) {
			// If we are capturing at a desiredLogLevel higher than this message, just ignore it.
			return;
		}

		const lineNumber: string = this.getLineNumber(new Error().stack);
		const timestamp = this.getWallTime(false).split("T")[1];

		if (message instanceof Array) {
			message.forEach((line) => {
				this.writeLogLine(line, timestamp, level, lineNumber);
			});
		} else {
			this.writeLogLine(message, timestamp, level, lineNumber);
		}
	}

	public static getLogsTable(): Partial<Result> {
		let tableColumnData: any = {
			columns: [
				{ key: "timestamp", label: "Timestamp" },
				{ key: "entryNumber", label: "#" },
				{ key: "level", label: "Level" },
				{ key: "lineNumber", label: "Line Number" },
				{ key: "description", label: "Description" }
			]
		};
		return {
			// LEARNING: Defining the function in an object
			display: () => {
				// LEARNING: [ARRAY]: Shadow clone of the array.
				const data = this.entries.slice(0);
				// LEARNING: Getting ux in a static method
				UX.create().then((ux) => {
					ux.table(data, tableColumnData);
				});
			}
		};
	}

	public static mergeAndCleanArrays(strValue1: string, strValue2: string): string[] {
		let output: string[];
		let arrValue1: string[] = [];
		let arrValue2: string[] = [];

		if (strValue1 !== "" && strValue1 !== null) {
			arrValue1 = strValue1.split(",");
		}
		if (strValue2 !== "" && strValue2 !== null) {
			arrValue2 = strValue2.split(",");
		}

		// LEARNING: [ARRAY]: Creates a new array with the values (possible duplicates) from both arrays.
		output = arrValue1.concat(arrValue2);

		// LEARNING: [ARRAY]: Creates new array with with the results return for every element.
		output = output.map((value) => {
			return value.trim();
		});

		// LEARNING: [ARRAY]: Creates a new array with all elements that return true.
		output = output.filter((item, pos, self) => {
			return self.indexOf(item) === pos;
		});

		return output;
	}

	public static getWallTime(isFolderName: boolean): string {
		const now: Date = new Date();
		let nowStr: string = JSON.stringify(now);
		nowStr = nowStr.replace(/"/g, "");
		if (isFolderName) {
			nowStr = nowStr.replace(/:/g, "-");
			nowStr = nowStr.replace(/T/g, "/");
			nowStr = nowStr.replace(/.[0-9]*Z/g, "");
		}
		return nowStr;
	}

	public static logResultsAdd(org: OrgManager, action: ResultOperation, sObj: string, good: number, bad: number): void {
		const orgAlias = org.alias;
		const operation = ResultOperation[action];

		// Check JSObject exists before populating it.
		if (!this.myResults) {
			this.myResults = {};
		}
		if (!this.myResults[operation]) {
			this.myResults[operation] = {};
		}
		if (!this.myResults[operation][orgAlias]) {
			this.myResults[operation][orgAlias] = {};
		}

		// Subtotals per sObject
		if (!this.myResults[operation][orgAlias][sObj]) {
			this.myResults[operation][orgAlias][sObj] = { bad: 0, good: 0 };
		}
		this.myResults[operation][orgAlias][sObj].bad += bad;
		this.myResults[operation][orgAlias][sObj].good += good;

		// Totals for org
		if (!this.myResults[operation]._TOTAL_RECORDS) {
			this.myResults[operation]._TOTAL_RECORDS = { bad: 0, good: 0 };
		}
		this.myResults[operation]._TOTAL_RECORDS.bad += bad;
		this.myResults[operation]._TOTAL_RECORDS.good += good;
	}

	public static getMyResults() {
		return this.myResults;
	}

	public static serialize(thisCaller: any, data: any[], callback: AnyFunction, index: number = 0): Promise<void> {
		return new Promise((resolve, reject) => {
			if (index < data.length) {
				callback
					.apply(thisCaller, [index])
					.then(() => {
						// Util.writeLog(`**** ASCENDING: ${index}`, LogLevel.DEBUG);
						return this.serialize(thisCaller, data, callback, index + 1);
					})
					.then(() => {
						// Util.writeLog(`**** DESCENDING: ${index}`, LogLevel.DEBUG);
						resolve();
					})
					.catch((err) => {
						reject(err);
					});
			} else {
				resolve();
			}
		});
	}

	private static counter: number = 0;
	private static entries: ILogger[] = [];
	private static desiredLogLevel: LogLevel;
	private static myResults: any;

	private static writeLogLine(message: string, timestamp: string, level: LogLevel, lineNumber: string) {
		let messageStr: string;

		// To string...

		try {
			messageStr = JSON.stringify(message);
			if (message.length + 2 === messageStr.length && messageStr[0] === '"' && messageStr[messageStr.length - 1] === '"') {
				messageStr = message;
			}
		} catch (ex) {
			messageStr = message.toString();
		}

		// Counter
		if (this.doesLogOutputsEachStep() && this.counter === 0) {
			// If this is the first line number, add a header
			// tslint:disable-next-line:no-console
			console.log("Timestamp	#	Level	Line Number	Description");
		}
		this.counter++;

		// Show segments
		// LEARNING: (STRING) Break a long string is several segments
		messageStr.match(/.{1,500}/g).forEach((segment, index) => {
			this.writeLogShortLine(segment, timestamp, level, lineNumber, index + 1);
		});
	}

	// tslint:disable-next-line:max-line-length
	private static writeLogShortLine(message: string, timestamp: string, level: LogLevel, lineNumber: string, segmentNumber: number) {
		// Display it on the screen (and possibly on a file if redirection in OS)
		if (this.doesLogOutputsEachStep()) {
			let msg = "";
			msg += timestamp + "	";
			msg += this.counter + (segmentNumber > 1 ? `.${segmentNumber}` : "") + "	";
			msg += LogLevel[level] + "	";
			msg += lineNumber.padEnd(20, " ") + "	";
			msg += message;
			// tslint:disable-next-line:no-console
			console.log(msg);
		}

		// And entry to list
		this.entries.push({
			description: message,
			entryNumber: this.counter + (segmentNumber > 1 ? `.${segmentNumber}` : ""),
			level: LogLevel[level],
			lineNumber: lineNumber.padEnd(20, " "),
			timestamp
		});

		// Add entry to SFDX logger
		Logger.root().then((logger: Logger) => {
			switch (level) {
				case LogLevel.TRACE:
					logger.trace("[" + lineNumber + "][" + timestamp + "]: " + message);
					break;
				case LogLevel.DEBUG:
					logger.trace("[" + lineNumber + "][" + timestamp + "]: " + message);
					break;
				case LogLevel.INFO:
					logger.info("[" + lineNumber + "][" + timestamp + "]: " + message);
					break;
				case LogLevel.WARN:
					logger.warn("[" + lineNumber + "][" + timestamp + "]: " + message);
					break;
				case LogLevel.ERROR:
					logger.error("[" + lineNumber + "][" + timestamp + "]: " + message);
					break;
				case LogLevel.FATAL:
					logger.fatal("[" + lineNumber + "][" + timestamp + "]: " + message);
					break;
				default:
					Util.throwError("ERROR: Level [" + LogLevel[level] + "] not available for logging");
					break;
			}
		});
	}

	private static getLineNumber(stack: string): string {
		let index: number;
		let line = stack.split("\n")[2];
		let separatorOS: string;
		if (line.indexOf("\\") > 0) {
			// Windows
			separatorOS = "\\";
		} else if (line.indexOf("/") > 0) {
			// Mac (Unix)
			separatorOS = "/";
		}

		index = line.lastIndexOf(separatorOS);
		line = line.substr(index + 1, line.length);
		line = line.replace(".ts", "");
		line = line.substr(0, line.lastIndexOf(":"));

		return line;
	}
}
