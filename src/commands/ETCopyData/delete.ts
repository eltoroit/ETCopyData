import { SfdxCommand } from "@salesforce/command";
import { Result } from "@salesforce/command/dist/lib/sfdxCommand";
import { ETCopyData } from "../../@ELTOROIT/ETCopyData";
import { LogLevel, ResultOperation, Util } from "../../@ELTOROIT/Util";

// TODO: Read the settings, and then override them with any parameters.
export default class Delete extends SfdxCommand {
	public static result: Partial<Result> = Util.getLogsTable();
	public static description = "Deletes data from destination org, " +
		"preparing for the new data that will be uploaded. " +
		"Note: Deleting optionally happens before loading, " +
		"but if there are some errors this operation can be retired by itself. ";

	public async run() {
		// Set log level based on parameters
		if (!this.flags.loglevel) {
			this.flags.loglevel = "TRACE";
		}
		Util.setLogLevel(this.flags.loglevel);
		Util.writeLog("Log level: " + this.flags.loglevel, LogLevel.TRACE);

		if (Util.doesLogOutputsEachStep()) {
			Util.writeLog("ETCopyData:Delete Process Started", LogLevel.INFO);
			Delete.result = null;
		} else {
			this.ux.startSpinner("ETCopyData:Delete");
		}

		const ETCD = new ETCopyData();
		await ETCD.deleteData();

		return Util.getMyResults()[ResultOperation[ResultOperation.DELETE]];
	}
}
