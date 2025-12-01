import { Connection, Org } from "@salesforce/core";
import { CoreMetadataSObjects } from "./CoreMetadataSObjects.js";
import { SchemaDiscovery } from "./SchemaDiscovery.js";
import { SchemaOrder } from "./SchemaOrder.js";
import { Settings } from "./Settings.js";
import { LogLevel, Util } from "./Util.js";

export enum WhichOrg { SOURCE = "orgSource", DESTINATION = "orgDestination" }

export class OrgManager {

	public alias: string;
	public conn: Connection;
	public order: SchemaOrder;
	public settings: Settings;
	public discovery: SchemaDiscovery;
	public coreMD: CoreMetadataSObjects;

	constructor(settings: Settings, coreMD: CoreMetadataSObjects) {
		this.resetValues(null);
		this.coreMD = coreMD;
		this.settings = settings;
	}

	public setAlias(alias: string): Promise<OrgManager> {
		return new Promise((resolve, reject) => {
			try {
				this.alias = alias;
				Org.create({ aliasOrUsername: alias })
					.then((resOrg: Org) => {
						this.conn = resOrg.getConnection();
						// LEARNING: How to generate the URL that sfdx force:org:open generates?
						// this.conn.instanceUrl + "/secur/frontdoor.jsp\?sid\=" + this.conn.accessToken
						Util.writeLog(`[${this.alias}] Alias for username: [${resOrg.getUsername()}]`, LogLevel.INFO);
						this.order = new SchemaOrder(this);
						this.discovery = new SchemaDiscovery(this);
						resolve(this);
					})
					.catch((err) => { reject(err); });
			} catch (ex) {
				this.resetValues(this.alias);
				const msg = "Alias [" + this.alias + "] does not reference a valid org";
				reject(msg);
			}
		});
	}

	private resetValues(alias: string): void {
		this.alias = alias;
		this.conn = null;
		this.order = null;
		this.settings = null;
		this.discovery = null;
	}
}
