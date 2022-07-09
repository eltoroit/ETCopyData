import { SfdxCommand } from "@salesforce/command";
import { Result } from "@salesforce/command/lib/sfdxCommand";
import { ETCopyData } from "../../@ELTOROIT/ETCopyData";
import { Settings } from "../../@ELTOROIT/Settings";
import { ResultOperation, Util } from "../../@ELTOROIT/Util";

// TODO: Read the settings, and then override them with any parameters.
export default class Import extends SfdxCommand {
	public static result: Partial<Result> = Util.getLogsTable();
	public static description =
		"Imports data into destination org, " +
		"you can control if the data in the destination sObjects should be removed before loading a new data set. " +
		"The data load happens in a specific order (children first, parents last) which has been determined by " +
		"checking the schema in the destination org. ";

	protected static flagsConfig = ETCopyData.flagsConfig;

	public async run(): Promise<any> {
		Import.result = null;

		ETCopyData.setLogs(this.flags, this.ux, "ETCopyData:Import", this.config);
		const s: Settings = ETCopyData.readParameters(this.flags);

		const ETCD = new ETCopyData();
		await ETCD.importData(s, null);

		return Util.getMyResults()[ResultOperation[ResultOperation.IMPORT]];
	}
}
