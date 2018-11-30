import { SfdxCommand } from "@salesforce/command";
import { Result } from "@salesforce/command/dist/lib/sfdxCommand";
import { ETCopyData } from "../../@ELTOROIT/ETCopyData";
import { LogLevel, ResultOperation, Util } from "../../@ELTOROIT/Util";

// TODO: Read the settings, and then override them with any parameters.
export default class CompareOrgs extends SfdxCommand {
	public static result: Partial<Result> = Util.getLogsTable();
	public static description = "Checks the source and destination org for any differences in the sObject's metadata, " +
		"this helps determine what data can be properly exported/imported.";

	public async run() {
		// Set log level based on parameters
		if (!this.flags.loglevel) {
			this.flags.loglevel = "TRACE";
		}
		Util.setLogLevel(this.flags.loglevel);
		Util.writeLog("Log level: " + this.flags.loglevel, LogLevel.TRACE);
		if (Util.doesLogOutputsEachStep()) {
			Util.writeLog("ETCopyData:Compare Process Started", LogLevel.INFO);
			CompareOrgs.result = null;
		} else {
			this.ux.startSpinner("ETCopyData:Compare");
		}

		const ETCD = new ETCopyData();
		await ETCD.compareSchemas();

		return Util.getMyResults()[ResultOperation[ResultOperation.SCHEMA]];
	}
}
