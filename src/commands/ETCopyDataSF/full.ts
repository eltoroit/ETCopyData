import { SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { ETCopyDataSF } from "../../@ELTOROIT/ETCopyDataSF.js";
import { Settings } from "../../@ELTOROIT/Settings.js";
import { Util } from "../../@ELTOROIT/Util.js";

export default class Full extends SfCommand<any> {
	public static summary = "Performs all steps of the data migration";
	public static description =
		"Includes comparing schemas, exporting data from the source, optionally deleting data from the destination, " +
		"and importing the data to the destination org. This may help you when setting up a new process.";

	public static flags = ETCopyDataSF.flagsConfig;

	public async run(): Promise<any> {
		const { flags } = await this.parse(Full);
		const ux = new Ux();
		ETCopyDataSF.setLogs(flags, ux, "ETCopyDataSF:Full", this.config);
		const s: Settings = ETCopyDataSF.readParameters(flags);

		const ETCD = new ETCopyDataSF();
		try {
			await ETCD.processAll(s);
		} catch (ex) {
			throw new Error(ex);
		}

		return Util.getMyResults();
	}
}
