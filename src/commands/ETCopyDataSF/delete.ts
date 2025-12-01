import { SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { ETCopyDataSF } from "../../@ELTOROIT/ETCopyDataSF.js";
import { Settings } from "../../@ELTOROIT/Settings.js";
import { ResultOperation, Util } from "../../@ELTOROIT/Util.js";

export default class Delete extends SfCommand<any> {
	public static summary = "Deletes data from destination org";
	public static description =
		"Prepares for the new data that will be uploaded. " +
		"Note: Deleting optionally happens before loading, " +
		"but if there are some errors this operation can be retried by itself.";

	public static flags = ETCopyDataSF.flagsConfig;

	public async run(): Promise<any> {
		const { flags } = await this.parse(Delete);
		const ux = new Ux();
		ETCopyDataSF.setLogs(flags, ux, "ETCopyDataSF:Delete", this.config);
		const s: Settings = ETCopyDataSF.readParameters(flags);

		const ETCD = new ETCopyDataSF();
		try {
			await ETCD.deleteData(s, null);
		} catch (ex) {
			throw new Error(ex);
		}

		return Util.getMyResults()[ResultOperation[ResultOperation.DELETE]];
	}
}
