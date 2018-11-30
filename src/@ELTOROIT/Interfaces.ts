// NOTE: Private, used for extending below (not for used in other code)
interface ISchemaBase2 {
	name: string;
	label: string;
	fields: string[];
	describeUrl: string;
	keyPrefix: string;
	orderBy: string;
}

// NOTE: Metadata schema
export interface ISchemaMetadata extends ISchemaBase2 {
	where: string;
}

// NOTE: Structure for the parents in the schema
export interface ISchemaDataParent {
	sObj: string;
	parentId: string;
}

// NOTE: Structure for the children in the schema
export interface ISchemaDataChild extends ISchemaDataParent {
	children: string;
}

// NOTE: Data schema, includes fields in metadata.
export interface ISchemaData extends ISchemaBase2 {
	children: ISchemaDataChild[];
	parents: ISchemaDataParent[];
	parentsRequired: string[];
}

// NOTE: Data and metadata that is exported.
export interface IExportData {
	total: number;
	fetched: number;
	records: any[];
}

// NOTE: Data logged will be used for the command JSON
export interface ILogger {
	description: string;
	entryNumber: number;
	level: string;
	lineNumber: string;
	timestamp: string;
}
