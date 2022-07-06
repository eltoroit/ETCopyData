import { SfdxCommand } from "@salesforce/command";
import { Result } from "@salesforce/command/lib/sfdxCommand";
import { ETCopyData } from "../../@ELTOROIT/ETCopyData";
import { Settings } from "../../@ELTOROIT/Settings";
import { ResultOperation, Util } from "../../@ELTOROIT/Util";

// TODO: Read the settings, and then override them with any parameters.
export default class Export extends SfdxCommand {
	public static result: Partial<Result> = Util.getLogsTable();
	public static description = "Exports the data from the source org, " +
		"and saves it in the destination folder so that it can be imported at a later time. ";
	//
	//

	protected static flagsConfig = ETCopyData.flagsConfig;

	public async run() {
		Export.result = null;

		ETCopyData.setLogs(this.flags, this.ux, "ETCopyData:Export");
		const s: Settings = ETCopyData.readParameters(this.flags);

		const ETCD = new ETCopyData();
		await ETCD.exportData(s, null);

		return Util.getMyResults()[ResultOperation[ResultOperation.EXPORT]];
	}
}
