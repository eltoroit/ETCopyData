# ETCopyData

SFDX Plugin to populate your scratch org and/or developer sandbox with data extracted from multiple sObjects.

[![Version](https://img.shields.io/npm/v/etcopydata.svg)](https://npmjs.org/package/etcopydata) [![License](https://img.shields.io/npm/l/etcopydata.svg)](https://github.com/ELTOROIT/ETCopyData/blob/master/package.json)

<!-- ET-AUTO-START: This section is auto-updated... -->
<!-- toc -->

-   [ETCopyData](#etcopydata)
-   [Install](#install)
-   [Documentation](#documentation)
-   [Commands](#commands)
    <!-- tocstop -->
        <!-- ET-AUTO-STOP: This section is auto-updated... -->

# Install

## Install as plugin

`sfdx plugins:install etcopydata`

You'll be prompted that this, like any plugin, is not officially code-signed by Salesforce. If that's annoying, you can [whitelist it](https://developer.salesforce.com/blogs/2017/10/salesforce-dx-cli-plugin-update.html)

## Install from source

1. Install the SDFX CLI.
2. Clone the repository: `git clone https://github.com/eltoroit/ETCopyData.git`
3. Change directory `cd ETCopyData`
4. Install npm modules: `npm install --production`
5. Link the plugin: `sfdx plugins:link .`

# Documentation

This plugin is highly configurable with a JSON file named `ETCopyData.json` located on the current folder you are using when running this plugin. If the file does not exist, the plugin creates the file before erroring out, this allows you to get the bare bones of the file and modify it.

## ETCopyData.json

### Sample

```
{
	"orgSource": "dhOrg",
	"orgDestination": soTest,
	"sObjectsData": [
		{
			"name": "Account",
			"ignoreFields": "OwnerId",
			"externalIdField": "LegacyId__c",
			"twoPassReferenceFields": "Field1__c,Field2__c",
			"where": "Industry = 'Technology'",
			"orderBy": "Name"
		}
	],
	"sObjectsMetadata": [
		{
			"name": "User",
			"matchBy": "Email",
			"fieldsToExport": "FirstName,LastName,Email,Id",
			"where": null,
			"orderBy": null
		}
	],
	"rootFolder": "./ETCopyData",
	"includeAllCustom": true,
	"customObjectsToIgnore": null,
	"stopOnErrors": true,
	"ignoreFields": "OwnerId, CreatedBy, CreatedDate, CurrencyIsoCode",
	"copyToProduction": false,
	"twoPassReferenceFields": "LinkedA__c,LinkedB__c,LinkedC__c",
	"deleteDestination": true,
  "useBulkAPI": true,
	"bulkPollingTimeout": 1800000
}
```

### Fields

| Field                                  | Default | Data Type          | Description                                                                                                                                              |
| -------------------------------------- | ------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **orgSource**                          | null    | String             | SFDX alias given to the org (production, sandbox or scratch org) that has the data you want to export.                                                   |
| **orgDestination<sup>~~1~~</sup>**     | null    | String             | SFDX alias given to the org (production, sandbox or scratch org) that receives the data that you import.                                                 |
| **sObjectsData<sup>2</sup>**           | []      | sObjectsData[]     | List of custom or standard sObjects where the data is going to be exported from, and where it will be imported to.                                       |
| **sObjectsMetadata<sup>3</sup>**       | []      | sObjectsMetadata[] | Metadata sObjects that will be used for importing your data.                                                                                             |
| **rootFolder**                         | null    | String             | Folder used to store the exported data and where the data will be imported from.                                                                         |
| **includeAllCustom**                   | false   | Boolean            | True if you want all the customer sObjects, false if you only want the ones listed in the orgDestination section                                         |
| **customObjectsToIgnore**              | null    | String             | If you have a large list of custom sObjects and you want to import most of them, it may be easier to include all custom sObjects and exclude few of them |
| **stopOnErrors**                       | true    | Boolean            | True if you want to stop on errors deleting data or importing data, false and the errors will be reported back but they will not stop the execution.     |
| **ignoreFields<sup>4</sup>**           | null    | String             | List of fields to ignore for every sObject, each field is separated with a comma. Example: "Field1\_\_c, Field2\_\_c, Field\_\_3"                        |
| **copyToProduction<sup>5</sup>**       | false   | Boolean            | True if you want to load data to a production org, false to load into sandboxes and scratch orgs                                                         |
| **twoPassReferenceFields<sup>6</sup>** | null    | String             | List of fields that need to be updated in a second pass                                                                                                  |
| **deleteDestination<sup>7</sup>**      | false   | Boolean            | True if you want to delete the existing records in the destination org before you load the new records.                                                  |
| **useBulkAPI**                         | false   | Boolean            | True if you prefer to use Bulk API (large data loads), false if you prefer to use Soap API (small data loads). Minimizes the number of API calls.        |
| **bulkPollingTimeout<sup>8<sup>**      | 1800000 | Integer            | Timeout in milliseconds that Bulk API operations will timeout.                                                                                           |

## sObjectsData

### Sample: Minimum fields required

You must provide the name of the sObject

```
{
	"name": "Account"
}
```

### Sample: All fields complete

```
{
	"name": "Location__c",
	"ignoreFields": "OwnerId, IgnoreField__c",
	"externalIdField": "External_Id_Field__c"
	"twoPassReferenceFields": "LinkedA__c,LinkedB__c,LinkedC__c",
	"where": "State__c = 'Texas'",
	"orderBy": "City__c",
}
```

### Fields

This is the structure for each sObject

| Field                                   | Default | Data Type | Description                                                                                                                |
| --------------------------------------- | ------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| **name**                                | N/A     | String    | Required field. SObject API name rather than the label, which means that custom sObjects end with \_\_c.                   |
| **ignoreFields**                        | null    | String[]  | List of fields to ignore for every sObject, these list will be combined with the global **ignoreFields** field.            |
| **externalIdField**                     | null    | String    | API name of external ID field to be used if an upsert operation is desired.                                                |
| **twoPassReferenceFields<sup>10</sup>** | null    | String[]  | For imports, lists the fields that need to be set using a separate update as they refer an SObject that is not loaded yet. |
| **where**                               | null    | String    | Restrict which records are be exported.                                                                                    |
| **orderBy**                             | null    | String    | For exports, determines the order for the records that are exported.                                                       |

## sObjectsMetadata

### Sample: Minimum fields required

```
{
	"name": "User",
	"matchBy": "Email"
}
```

### Sample: All fields complete

```
{
	"name": "User",
	"matchBy": "Email",
	"fieldsToExport": "FirstName,LastName,Email,Id",
	"where": null,
	"orderBy": "LastName"
}
```

### Fields

This is the structure for each metadata sObject

| Field                   | Default | Data Type | Description                                                                   |
| ----------------------- | ------- | --------- | ----------------------------------------------------------------------------- |
| **name**                | N/A     | String    | Required field. SObject API name rather than the label.                       |
| **matchBy<sup>9</sup>** | N/A     | STring    | Required field. What makes the two metadata sObjects the same?                |
| **fieldsToExport**      | N/A     | String[]  | List of fields that will be exported for each metadata sObject.               |
| **where**               | null    | String    | Restrict which records are be exported.                                       |
| **orderBy**             | null    | String    | For exports, determines the order for the metadata records that are exported. |

## References

ETCopyData fully supports importing references between SObjects, both Lookup and master/detail relationships.

ETCopyData determines automatically an import order, based on the Lookup and master/detail relationships that are exported and not flagged as twoPassReferenceFields. It sorts the list of SObjects using the following algorithm:

1. SObjects that have no relationships to any other SObjects
2. SObjects that only have relationships to group 1
3. SObjects that have relationships to groups 1, 2
4. SObjects that have relationships to groups 1, 2, 3
5. SObjects that have relationships to groups 1, 2, 3, 4
6. etc.

ETCopyData imports the data for the SObjects in that order, keeping track of the mapping between Ids in the source set and their equivalent Ids the target system. When importing a reference field, it can immediately set the correct Id in the target system.

If your data model is tree-like, no additional configuration is needed to automatically import all references. If your data model contains cyclic references or self references, additional configuration using the 'twoPassReferenceField' setting is required. An example cyclic reference is SObject A having a lookup field for SObject B and SObject B having a lookup field for SObject A. An example self reference is SObject A having a lookup field for SObject A.

If your data model contains one of these types of references, you will get the following error during import:

> Deadlock determining import order, most likely caused by circular or self reference, configure those fields as twoPassReferenceFields

Configuring twoPassReferenceFields is a manual process. In general, if you have two SObjects that reference each other through a single Lookup relationship in each SObject, you only need to flag one of those fields as a twoPassReferenceField.

As an example, assume you have the following SObject and fields:

-   SObject A\_\_c: field RefB\_\_c of type Lookup(B\_\_c)
-   SObject B\_\_c: field RefA\_\_c of type Lookup(A\_\_c)

If your dataset contains 1000 A\_\_c records and 10 B\_\_c records, the optimal configuration is to configure B\_\_c.RefA\_\_c as twoPassReferenceField. On import, ETCopyData will execute the following steps:

1. import all records for SObject B\_\_c (keeping the RefA\_\_c field null), keeping track of the mapping between Id in the source set and the Id in the target system
2. import all records for SObject A\_\_c, setting the RefB\_\_c field correctly using the mapping, keeping track of the mapping the record Ids
3. revisit all SObject B\_\_c records that have a value for RefA\_\_c, and set the RefA\_\_c field to the mapped Id

## Copying to production

Since the idea of this tool is to copy data between orgs, it could be possible to load data into production. But this can be a very dangerous situation, for that reason when you copy data to a production org, there are two security protections:

1. You must type in an auto-generted random number. This hopefully makes you aware to the fact that you are copying data to production.
2. It's not possible to delete data, on the same way you can do when copying to a sandbox or scrath org.

## Notes:

1. ~~Because the data in the org gets modified, you are **not** allowed to use a production org. You can only use a scratch org or a sandbox!~~ It's possible to load data to production, but read section on copying to production to understand this better.
2. You must explicitly specify which **standard** sObjects you want to process because there are way too many standard sObjects and not a good way to determine which ones are useful. But for custom sObjects, you can specify that you want all of them.
3. These records will not be imported but will need to exist in the destination org, so their record IDs can be used when loading the data.
4. These are some fields that are a good idea to ignore: OwnerId, CreatedBy, CreatedDate, CurrencyIsoCode.
5. See **Copying to production** section above.
6. See **References** section above.
7. Not deleting the existing records could end up with tons of records (possibly duplicate errors) if the import is run multiple times.
8. If you are getting timeout errors while records are being deleted, or imported, you could increase the polling timeout. A good value is `1800000` milliseconds which corresponds to 30 minutes.
9. If you are getting out-of-memory errors, you can increase the amount of memory used by NodeJS (the engine used to run SFDX plugins) by setting the environment variable `NODE_OPTIONS` to `--max-old-space-size=8192` to reserve 8GB memory.
10. The metadata records in the source org and the destination org will have different IDs, but they should have similar characteristic that can be used for mapping. For example, for users, you can use the email, for profiles use their names, for record types use their developer name, etc. When dealing with Recordtypes that have same DeveloperName for different sObjects, the matchBy entry can be set as "SobjectType, DeveloperName".

# Commands

<!-- ET-AUTO-START: This section is auto-updated... -->
<!-- commands -->

-   [`sfdx ETCopyData:Compare [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-etcopydatacompare--c-string--d-string--s-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
-   [`sfdx ETCopyData:delete [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-etcopydatadelete--c-string--d-string--s-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
-   [`sfdx ETCopyData:export [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-etcopydataexport--c-string--d-string--s-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
-   [`sfdx ETCopyData:full [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-etcopydatafull--c-string--d-string--s-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
-   [`sfdx ETCopyData:import [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-etcopydataimport--c-string--d-string--s-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx ETCopyData:Compare [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Checks the source and destination org for any differences in the sObject's metadata, this helps determine what data can be properly exported/imported.

```
USAGE
  $ sfdx ETCopyData:Compare [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --configfolder=PATH                                                           Root folder to find the
                                                                                    configuration file

  -d, --orgdestination=(alias|username)                                             SFDX alias or username for the
                                                                                    DESTINATION org

  -s, --orgsource=(alias|username)                                                  SFDX alias or username for the
                                                                                    SOURCE org

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/ETCopyData/Compare.ts](https://github.com/eltoroit/ETCopyData/blob/v2.0.1-Beta/src/commands/ETCopyData/Compare.ts)_

## `sfdx ETCopyData:delete [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Deletes data from destination org, preparing for the new data that will be uploaded. Note: Deleting optionally happens before loading, but if there are some errors this operation can be retried by itself.

```
USAGE
  $ sfdx ETCopyData:delete [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --configfolder=PATH                                                           Root folder to find the
                                                                                    configuration file

  -d, --orgdestination=(alias|username)                                             SFDX alias or username for the
                                                                                    DESTINATION org

  -s, --orgsource=(alias|username)                                                  SFDX alias or username for the
                                                                                    SOURCE org

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/ETCopyData/delete.ts](https://github.com/eltoroit/ETCopyData/blob/v2.0.1-Beta/src/commands/ETCopyData/delete.ts)_

## `sfdx ETCopyData:export [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Exports the data from the source org, and saves it in the destination folder so that it can be imported at a later time.

```
USAGE
  $ sfdx ETCopyData:export [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --configfolder=PATH                                                           Root folder to find the
                                                                                    configuration file

  -d, --orgdestination=(alias|username)                                             SFDX alias or username for the
                                                                                    DESTINATION org

  -s, --orgsource=(alias|username)                                                  SFDX alias or username for the
                                                                                    SOURCE org

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/ETCopyData/export.ts](https://github.com/eltoroit/ETCopyData/blob/v2.0.1-Beta/src/commands/ETCopyData/export.ts)_

## `sfdx ETCopyData:full [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Performs all the steps, including comparing schemas, exporting data from the source, optionally deleting data from the destination, and importing the data to the destination org. This may help you when setting up a new process

```
USAGE
  $ sfdx ETCopyData:full [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --configfolder=PATH                                                           Root folder to find the
                                                                                    configuration file

  -d, --orgdestination=(alias|username)                                             SFDX alias or username for the
                                                                                    DESTINATION org

  -s, --orgsource=(alias|username)                                                  SFDX alias or username for the
                                                                                    SOURCE org

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/ETCopyData/full.ts](https://github.com/eltoroit/ETCopyData/blob/v2.0.1-Beta/src/commands/ETCopyData/full.ts)_

## `sfdx ETCopyData:import [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Imports data into destination org, you can control if the data in the destination sObjects should be removed before loading a new data set. The data load happens in a specific order (children first, parents last) which has been determined by checking the schema in the destination org.

```
USAGE
  $ sfdx ETCopyData:import [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --configfolder=PATH                                                           Root folder to find the
                                                                                    configuration file

  -d, --orgdestination=(alias|username)                                             SFDX alias or username for the
                                                                                    DESTINATION org

  -s, --orgsource=(alias|username)                                                  SFDX alias or username for the
                                                                                    SOURCE org

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/ETCopyData/import.ts](https://github.com/eltoroit/ETCopyData/blob/v2.0.1-Beta/src/commands/ETCopyData/import.ts)_

<!-- commandsstop -->
<!-- ET-AUTO-STOP: This section is auto-updated... -->
