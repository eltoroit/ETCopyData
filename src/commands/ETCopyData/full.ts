import { SfdxCommand } from "@salesforce/command";
import { Result } from "@salesforce/command/lib/sfdxCommand";
import { ETCopyData } from "../../@ELTOROIT/ETCopyData";
import { Settings } from "../../@ELTOROIT/Settings";
import { Util } from "../../@ELTOROIT/Util";

// TODO: Read the settings, and then override them with any parameters.
export default class Full extends SfdxCommand {
	public static result: Partial<Result> = Util.getLogsTable();
	public static description =
		"Performs all the steps, including comparing schemas, " +
		"exporting data from the source, optionally deleting data from the destination, " +
		"and importing the data to the destination org. This may help you when setting up a new process";
	//

	protected static flagsConfig = ETCopyData.flagsConfig;

	public async run(): Promise<any> {
		Full.result = null;

		ETCopyData.setLogs(this.flags, this.ux, "ETCopyData:Full", this.config);
		const s: Settings = ETCopyData.readParameters(this.flags);

		const ETCD = new ETCopyData();
		try {
			await ETCD.processAll(s);
		} catch (ex) {
			throw new Error(ex);
		}

		return Util.getMyResults();
	}
}
