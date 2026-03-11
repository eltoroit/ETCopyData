import { SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { ETCopyDataSF } from "../../@ELTOROIT/ETCopyDataSF.js";
import { Settings } from "../../@ELTOROIT/Settings.js";
import { ResultOperation, Util } from "../../@ELTOROIT/Util.js";

export default class CompareOrgs extends SfCommand<any> {
	public static summary = "Checks the source and destination org for any differences in the sObject's metadata";
	public static description = "This helps determine what data can be properly exported/imported.";
	public static flags = ETCopyDataSF.flagsConfig;

	public async run(): Promise<any> {
		const { flags } = await this.parse(CompareOrgs);
		const ux = new Ux();
		ETCopyDataSF.setLogs(flags, ux, "ETCopyDataSF:compare", this.config);
		const s: Settings = ETCopyDataSF.readParameters(flags);

		const ETCD = new ETCopyDataSF();
		try {
			await ETCD.compareSchemas(s, null);
		} catch (ex) {
			throw new Error(ex);
		}

		return Util.getMyResults()[ResultOperation[ResultOperation.SCHEMA]];
	}
}