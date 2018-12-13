import { SfdxCommand } from "@salesforce/command";
import { Result } from "@salesforce/command/lib/sfdxCommand";
import { ETCopyData } from "../../@ELTOROIT/ETCopyData";
import { LogLevel, ResultOperation, Util } from "../../@ELTOROIT/Util";

// TODO: Read the settings, and then override them with any parameters.
export default class Export extends SfdxCommand {
	public static result: Partial<Result> = Util.getLogsTable();
	public static description = "Exports the data from the source org, " +
		"and saves it in the destination folder so that it can be imported at a later time. ";

	public async run() {
		// Set log level based on parameters
		if (!this.flags.loglevel) {
			this.flags.loglevel = "TRACE";
		}
		Util.setLogLevel(this.flags.loglevel);
		Util.writeLog("Log level: " + this.flags.loglevel, LogLevel.TRACE);

		if (Util.doesLogOutputsEachStep()) {
			Util.writeLog("ETCopyData:Export Process Started", LogLevel.INFO);
			Export.result = null;
		} else {
			this.ux.startSpinner("ETCopyData:Export");
		}

		const ETCD = new ETCopyData();
		await ETCD.exportData();

		return Util.getMyResults()[ResultOperation[ResultOperation.EXPORT]];
	}
}
