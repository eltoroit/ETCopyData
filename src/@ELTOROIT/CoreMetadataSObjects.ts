import { ISchemaMetadata } from "./Interfaces";
import { ISettingsSObjectMetatada, Settings } from "./Settings";

export class CoreMetadataSObjects {
	private settings: Settings;
	private metadataSobjects: Map<string, ISchemaMetadata> = null;

	public constructor(settings: Settings) {
		this.settings = settings;
	}

	public get sObjects(): string[] {
		const output: string[] = [];

		this.metadataSobjects.forEach((value, key) => {
			output.push(key);
		});

		return output;
	}

	public makeSOQL(sObjName: string): string {
		let soql = "";
		const sObj = this.metadataSobjects.get(sObjName);

		soql += "SELECT " + sObj.fields + " ";
		soql += "FROM " + sObjName + " ";
		if (sObj.where != null) {
			soql += "WHERE " + sObj.where + " ";
		}
		if (sObj.orderBy != null) {
			soql += "ORDER BY " + sObj.orderBy + " ";
		}

		return soql;
	}

	public getBySObjName(sObjName: string): ISchemaMetadata {
		this.makeMetadata();
		return this.metadataSobjects.get(sObjName);
	}

	public getByKeyPrefix(keyPrefix: string): ISchemaMetadata {
		this.makeMetadata();

		this.metadataSobjects.forEach((md: ISchemaMetadata) => {
			if (md.keyPrefix === keyPrefix) {
				return md;
			}
		});

		return null;
	}

	public setValues(sObj: any): void {
		this.makeMetadata();

		this.metadataSobjects.get(sObj.name).label = sObj.label;
		this.metadataSobjects.get(sObj.name).keyPrefix = sObj.keyPrefix;
		this.metadataSobjects.get(sObj.name).describeUrl = sObj.urls.describe;
		this.metadataSobjects.get(sObj.name).where = this.settings.getSObjectMetadata(sObj.name).where;
	}

	public isMD(sObjName: string): boolean {
		this.makeMetadata();
		return this.metadataSobjects.has(sObjName);
	}

	public forPrint(): object {
		const output = {};

		this.metadataSobjects.forEach((value: ISchemaMetadata, key: string) => {
			output[key] = {};
			output[key].Name = value.name;
			output[key].label = value.label;
			output[key].keyPrefix = value.keyPrefix;
			output[key].fields = value.fields;
			output[key].describeUrl = value.describeUrl;
		});
		return output;
	}

	private makeMetadata(): void {
		if (this.metadataSobjects == null) {
			this.metadataSobjects = new Map<string, ISchemaMetadata>();
			this.settings.getRequestedSObjectNames(true).forEach((sObjName: string) => {
				const sObj: ISettingsSObjectMetatada = this.settings.getSObjectMetadata(sObjName);
				const fieldList: string[] = sObj.fieldsToExport as string[];

				this.metadataSobjects.set(sObjName, {
					describeUrl: null,
					fields: fieldList,
					keyPrefix: null,
					label: null,
					name: sObjName,
					orderBy: sObj.orderBy,
					where: null
				});
			});
		}
	}
}
