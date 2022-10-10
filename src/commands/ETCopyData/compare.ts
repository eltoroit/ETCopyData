import { SfdxCommand, Result } from '@salesforce/command';
import { ETCopyData } from "../../@ELTOROIT/ETCopyData";
import { Settings } from "../../@ELTOROIT/Settings";
import { ResultOperation, Util } from "../../@ELTOROIT/Util";

export default class CompareOrgs extends SfdxCommand {
	public static result: Partial<Result> = Util.getLogsTable();
	public static description = "Checks the source and destination org for any differences in the sObject's metadata, this helps determine what data can be properly exported/imported.";
	protected static flagsConfig = ETCopyData.flagsConfig;

	public async run(): Promise<any> {
		CompareOrgs.result = null;

		ETCopyData.setLogs(this.flags, this.ux, "ETCopyData:compare", this.config);
		const s: Settings = ETCopyData.readParameters(this.flags);

		const ETCD = new ETCopyData();
		try {
			await ETCD.compareSchemas(s, null);
		} catch (ex) {
			throw new Error(ex);
		}

		return Util.getMyResults()[ResultOperation[ResultOperation.SCHEMA]];
	}
}