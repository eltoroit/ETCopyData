import { SfdxCommand } from "@salesforce/command";
import { Result } from "@salesforce/command/lib/sfdxCommand";
import { ETCopyData } from "../../@ELTOROIT/ETCopyData";
import { Settings } from "../../@ELTOROIT/Settings";
import { ResultOperation, Util } from "../../@ELTOROIT/Util";

// TODO: Read the settings, and then override them with any parameters
export default class CompareOrgs extends SfdxCommand {
	public static result: Partial<Result> = Util.getLogsTable();
	public static description = "Checks the source and destination org for any differences in the sObject's metadata, " +
		"this helps determine what data can be properly exported/imported.";
	//
	//

	protected static flagsConfig = ETCopyData.flagsConfig;

	public async run() {
		CompareOrgs.result = null;

		ETCopyData.setLogs(this.flags, this.ux, "ETCopyData:Compare");
		const s: Settings = ETCopyData.readParameters(this.flags);

		const ETCD = new ETCopyData();
		await ETCD.compareSchemas(s, null);

		return Util.getMyResults()[ResultOperation[ResultOperation.SCHEMA]];
	}
}
