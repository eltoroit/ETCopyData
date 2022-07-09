import { SfdxCommand } from "@salesforce/command";
import { Result } from "@salesforce/command/lib/sfdxCommand";
import { ETCopyData } from "../../@ELTOROIT/ETCopyData";
import { Settings } from "../../@ELTOROIT/Settings";
import { ResultOperation, Util } from "../../@ELTOROIT/Util";

// TODO: Read the settings, and then override them with any parameters.
export default class Delete extends SfdxCommand {
	public static result: Partial<Result> = Util.getLogsTable();
	public static description =
		"Deletes data from destination org, " +
		"preparing for the new data that will be uploaded. " +
		"Note: Deleting optionally happens before loading, " +
		"but if there are some errors this operation can be retried by itself. ";

	protected static flagsConfig = ETCopyData.flagsConfig;

	public async run(): Promise<any> {
		Delete.result = null;

		ETCopyData.setLogs(this.flags, this.ux, "ETCopyData:Delete", this.config);
		const s: Settings = ETCopyData.readParameters(this.flags);

		const ETCD = new ETCopyData();
		await ETCD.deleteData(s, null);

		return Util.getMyResults()[ResultOperation[ResultOperation.DELETE]];
	}
}
