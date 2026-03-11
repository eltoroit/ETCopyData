import { SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { ETCopyDataSF } from "../../@ELTOROIT/ETCopyDataSF.js";
import { Settings } from "../../@ELTOROIT/Settings.js";
import { ResultOperation, Util } from "../../@ELTOROIT/Util.js";

export default class Import extends SfCommand<any> {
	public static summary = "Imports data into destination org";
	public static description =
		"You can control if the data in the destination sObjects should be removed before loading a new data set. " +
		"The data load happens in a specific order (children first, parents last) which has been determined by " +
		"checking the schema in the destination org.";

	public static flags = ETCopyDataSF.flagsConfig;

	public async run(): Promise<any> {
		const { flags } = await this.parse(Import);
		const ux = new Ux();
		ETCopyDataSF.setLogs(flags, ux, "ETCopyDataSF:Import", this.config);
		const s: Settings = ETCopyDataSF.readParameters(flags);

		const ETCD = new ETCopyDataSF();
		try {
			await ETCD.importData(s, null);
		} catch (ex) {
			throw new Error(ex);
		}

		return Util.getMyResults()[ResultOperation[ResultOperation.IMPORT]];
	}
}
