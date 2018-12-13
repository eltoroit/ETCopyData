import { SfdxCommand } from "@salesforce/command";
import { Result } from "@salesforce/command/lib/sfdxCommand";
import { ETCopyData } from "../../@ELTOROIT/ETCopyData";
import { LogLevel, ResultOperation, Util } from "../../@ELTOROIT/Util";

// TODO: Read the settings, and then override them with any parameters.
export default class Import extends SfdxCommand {
	public static result: Partial<Result> = Util.getLogsTable();
	public static description = "Imports data into destination org, " +
		"you can control if the data in the destination sObjects should be removed before loading a new data set. " +
		"The data load happens in a specific order (children first, parents last) which has been determined by " +
		"checking the schema in the destination org. ";

	public async run() {
		// Set log level based on parameters
		if (!this.flags.loglevel) {
			this.flags.loglevel = "TRACE";
		}
		Util.setLogLevel(this.flags.loglevel);
		Util.writeLog("Log level: " + this.flags.loglevel, LogLevel.TRACE);

		if (Util.doesLogOutputsEachStep()) {
			Util.writeLog("ETCopyData:Import Process Started", LogLevel.INFO);
			Import.result = null;
		} else {
			this.ux.startSpinner("ETCopyData:Import");
		}

		const ETCD = new ETCopyData();
		await ETCD.importData();

		return Util.getMyResults()[ResultOperation[ResultOperation.IMPORT]];
	}
}
