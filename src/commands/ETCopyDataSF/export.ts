import { SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { ETCopyDataSF } from "../../@ELTOROIT/ETCopyDataSF.js";
import { Settings } from "../../@ELTOROIT/Settings.js";
import { ResultOperation, Util } from "../../@ELTOROIT/Util.js";

export default class Export extends SfCommand<any> {
	public static summary = "Exports the data from the source org";
	public static description = "Saves the data in the destination folder so that it can be imported at a later time.";

	public static flags = ETCopyDataSF.flagsConfig;

	public async run(): Promise<any> {
		const { flags } = await this.parse(Export);
		const ux = new Ux();
		ETCopyDataSF.setLogs(flags, ux, "ETCopyDataSF:Export", this.config);
		const s: Settings = ETCopyDataSF.readParameters(flags);

		const ETCD = new ETCopyDataSF();
		try {
			await ETCD.exportData(s, null);
		} catch (ex) {
			throw new Error(ex);
		}

		return Util.getMyResults()[ResultOperation[ResultOperation.EXPORT]];
	}
}
