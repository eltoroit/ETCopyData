import { SfdxCommand, Result } from '@salesforce/command';
import { ETCopyData } from "../../@ELTOROIT/ETCopyData";
import { Settings } from "../../@ELTOROIT/Settings";
import { ResultOperation, Util } from "../../@ELTOROIT/Util";

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
		try {
			await ETCD.deleteData(s, null);
		} catch (ex) {
			throw new Error(ex);
		}

		return Util.getMyResults()[ResultOperation[ResultOperation.DELETE]];
	}
}
