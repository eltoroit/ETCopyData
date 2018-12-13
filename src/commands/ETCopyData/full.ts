import { SfdxCommand } from "@salesforce/command";
import { Result } from "@salesforce/command/lib/sfdxCommand";
import { ETCopyData } from "../../@ELTOROIT/ETCopyData";
import { LogLevel, Util } from "../../@ELTOROIT/Util";

// TODO: Read the settings, and then override them with any parameters.
export default class Full extends SfdxCommand {
	public static result: Partial<Result> = Util.getLogsTable();
	public static description = "Performs all the steps, including comparing schemas, " +
		"exporting data from the source, optionally deleting data from the destination, " +
		"and importing the data to the destination org. This may help you when setting up a new process";

	public async run() {
		// Set log level based on parameters
		if (!this.flags.loglevel) {
			this.flags.loglevel = "TRACE";
		}
		Util.setLogLevel(this.flags.loglevel);
		Util.writeLog("Log level: " + this.flags.loglevel, LogLevel.TRACE);

		if (Util.doesLogOutputsEachStep()) {
			Util.writeLog("ETCopyData:Full Process Started", LogLevel.INFO);
			Full.result = null;
		} else {
			this.ux.startSpinner("ETCopyData:Full");
		}

		const ETCD = new ETCopyData();
		await ETCD.processAll();

		return Util.getMyResults();
	}
}
