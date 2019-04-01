ETCopyData
==========

SFDX Plugin to populate your scratch org and/or developer sandbox with data extracted from multiple sObjects.

[![Version](https://img.shields.io/npm/v/etcopydata.svg)](https://npmjs.org/package/etcopydata)
[![License](https://img.shields.io/npm/l/etcopydata.svg)](https://github.com/ELTOROIT/ETCopyData/blob/master/package.json)

<!-- ET-AUTO-START: This section is auto-updated... -->
<!-- toc -->
* [Install](#install)
* [Documentation](#documentation)
* [Commands](#commands)
<!-- tocstop -->
<!-- ET-AUTO-STOP: This section is auto-updated... -->

# Install

## Install as plugin

`sfdx plugins:install etcopydata`

You'll be prompted that this, like any plugin, is not officially code-signed by Salesforce.  If that's annoying, you can [whitelist it](https://developer.salesforce.com/blogs/2017/10/salesforce-dx-cli-plugin-update.html)

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
    "now": "2018-11-29T20:11:33.417Z",
    "orgSource": "dhOrg",
    "orgDestination": soTest,
    "sObjectsData": [
		{
			"name": "Account",
			"ignoreFields": "OwnerId",
			"maxRecords": 20,
			"orderBy": "Name",
			"where": "Industry = 'Technology'"
		}
	],
    "sObjectsMetadata": [
		{
			"name": "User",
			"fieldsToExport": "FirstName,LastName,Email,Id",
			"matchBy": "Email"
		}
	],
    "rootFolder": "./ETCopyData",
	"includeAllCustom": true,
	"stopOnErrors": true,
	"ignoreFields": "OwnerId, CreatedBy, CreatedDate, CurrencyIsoCode",
	"maxRecordsEach": null,
	"deleteDestination": true,
	"pollingTimeout": 100000
}
```

### Fields

| Field                             | Data Type          | Description                                                                                                                                          |
| --------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **now**                           | DateTime           | Timestamp that automatically updates every time the plugin is executed.                                                                              |
| **orgSource**                     | String             | SFDX alias given to the org that has the data you want to export.                                                                                    |
| **orgDestination<sup>1</sup>**    | String             | SFDX alias given to the org that receive the data that you import.                                                                                   |
| **sObjectsData<sup>2</sup>**      | sObjectsData[]     | List of custom or standard sObjects where the data is going to be exported from, and where it will be imported to.                                   |
| **sObjectsMetadata<sup>3</sup>**  | sObjectsMetadata[] | Metadata sObjects that will be used for importing your data.                                                                                         |
| **rootFolder**                    | String             | Folder used to store the exported data and where the data will be imported from.                                                                     |
| **includeAllCustom**              | Boolean            | True if you want all the customer sObjects, false if you only want the ones listed in the orgDestination section                                     |
| **stopOnErrors**                  | Boolean            | True if you want to stop on errors deleting data or importing data, false and the errors will be reported back but they will not stop the execution. |
| **ignoreFields<sup>4</sup>**      | String             | List of fields to ignore for every sObject, each field is separated with a comma. Example: "Field1__c, Field2__c, Field__3"                          |
| **maxRecordsEach<sup>5</sup>**    | Integer            | What is the maximum number of records to export for each sObject                                                                                     |
| **deleteDestination<sup>6</sup>** | Boolean            | True if you want to delete the existing records in the destination org before you load the new records.                                              |
| **pollingTimeout<sup>7<sup>**     | Integer            | Timeout in milliseconds that Bulk API operations will timeout.                                                                                       |

## sObjectsData

### Sample: Minimum fields required

You must provide the name of the sObject

````
{
	"name": "Account"
}
````

### Sample: All fields complete 

````
{
	"name": "Location__c",
	"ignoreFields": "OwnerId, IgnoreField__c",
	"maxRecords": 50,
	"orderBy": "City__c",
	"where": "State__c = 'Texas'"
}
````

### Fields

This is the structure for each sObject

| Field        | Default | Data Type | Description                                                                                                     |
| ------------ | ------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| name         | N/A     | String    | Required field. SObject API name rather than the label, which means that custom sObjects end with __c.          |
| ignoreFields | null    | String[]  | List of fields to ignore for every sObject, these list will be combined with the global **ignoreFields** field. |
| maxRecords   | -1      | Integer   | Overrides the global **maxRecordsEach** field.                                                                  |
| orderBy      | null    | String    | For exports, determines the order for the records that are exported.                                            |
| where        | null    | String    | Restrict which records are be exported.                                                                         |

## sObjectsMetadata

### Sample: Minimum fields required

````
{
	"name": "User",
	"fieldsToExport": "FirstName,LastName,Email,Id",
	"matchBy": "Email"
}
````

### Sample: All fields complete 

````
{
	"name": "User",
	"fieldsToExport": "FirstName,LastName,Email,Id",
	"matchBy": "Email",
	"orderBy": "LastName",
	"where": null
}
````

### Fields

This is the structure for each metadata sObject

| Field               | Default | Data Type | Description                                                                     |
| ------------------- | ------- | --------- | ------------------------------------------------------------------------------- |
| name                | N/A     | String    | Required field. SObject API name rather than the label.                         |
| fieldsToExport      | N/A     | String[]  | Required field. List of fields that will be exported for each metadata sObject. |
| matchBy<sup>8</sup> | N/A     | Integer   | Required field. What makes the two metadata sObjects the same?                  |
| orderBy             | null    | String    | For exports, determines the order for the metadata records that are exported.   |
| where               | null    | String    | Restrict which records are be exported.                                         |

## Notes:
1. Because the data in the org gets modified, you are **not** allowed to use a production org. You can only use a scratch org or a sandbox!
2. You must explicitly specify which standard sObjects you want to process because there are way too many standard sObjects and not a good way to determine which ones are useful. But for custom sObjects, you can specify that you want all of them.
3. These records will not be imported but will need to exist in the destination org, so their record ids can be used when loading the data.
4. These are some fields that are a good idea to ignore: OwnerId, CreatedBy, CreatedDate, CurrencyIsoCode.
5. Not exporting all the records could have negative implications, especially if those records are required later. For example, not exporting master records (on a master/detail relationship) for detail records that you do actually export.
6. Not deleting the existing records could end up with tons of records if the operation is run multiple times while testing, or have duplicate records in the destination sObject.
7.  If you are getting timeout errors while records are being deleted, or imported, you could increase the polling timeout.
8.  If you are getting out-of-memory errors, you can increase the amount of memory used by NodeJS (the engine used to run SFDX plugins) by setting the environment variable `NODE_OPTIONS` to `--max-old-space-size=8192` to reserve 8GB memory.
9.  The metadata records in the source org and the destination org will have different IDs, but they should have similar charsteristic that can be used for mapping. For example, for users, you can use the email, for profiles use their names, for record types use their developer name, etc.

# Commands
<!-- ET-AUTO-START: This section is auto-updated... -->
<!-- commands -->
* [`sfdx ETCopyData:compare`](#sfdx-et-copy-datacompare)
* [`sfdx ETCopyData:delete`](#sfdx-et-copy-datadelete)
* [`sfdx ETCopyData:export`](#sfdx-et-copy-dataexport)
* [`sfdx ETCopyData:full`](#sfdx-et-copy-datafull)
* [`sfdx ETCopyData:import`](#sfdx-et-copy-dataimport)

## `sfdx ETCopyData:compare`

Checks the source and destination org for any differences in the sObject's metadata, this helps determine what data can be properly exported/imported.

```
USAGE
  $ sfdx ETCopyData:compare

OPTIONS
  -c, --configfolder=PATH                         Root folder to find the configuration file
  -d, --orgdestination=(alias|username)           SFDX alias or username for the DESTINATION org
  -s, --orgsource=(alias|username)                SFDX alias or username for the SOURCE org
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  logging level for this command invocation
```

_See code: [src/commands/ETCopyData/compare.ts](https://github.com/eltoroit/ETCopyData/blob/v0.4.3/src/commands/ETCopyData/compare.ts)_

## `sfdx ETCopyData:delete`

Deletes data from destination org, preparing for the new data that will be uploaded. Note: Deleting optionally happens before loading, but if there are some errors this operation can be retried by itself.

```
USAGE
  $ sfdx ETCopyData:delete

OPTIONS
  -c, --configfolder=PATH                         Root folder to find the configuration file
  -d, --orgdestination=(alias|username)           SFDX alias or username for the DESTINATION org
  -s, --orgsource=(alias|username)                SFDX alias or username for the SOURCE org
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  logging level for this command invocation
```

_See code: [src/commands/ETCopyData/delete.ts](https://github.com/eltoroit/ETCopyData/blob/v0.4.3/src/commands/ETCopyData/delete.ts)_

## `sfdx ETCopyData:export`

Exports the data from the source org, and saves it in the destination folder so that it can be imported at a later time.

```
USAGE
  $ sfdx ETCopyData:export

OPTIONS
  -c, --configfolder=PATH                         Root folder to find the configuration file
  -d, --orgdestination=(alias|username)           SFDX alias or username for the DESTINATION org
  -s, --orgsource=(alias|username)                SFDX alias or username for the SOURCE org
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  logging level for this command invocation
```

_See code: [src/commands/ETCopyData/export.ts](https://github.com/eltoroit/ETCopyData/blob/v0.4.3/src/commands/ETCopyData/export.ts)_

## `sfdx ETCopyData:full`

Performs all the steps, including comparing schemas, exporting data from the source, optionally deleting data from the destination, and importing the data to the destination org. This may help you when setting up a new process

```
USAGE
  $ sfdx ETCopyData:full

OPTIONS
  -c, --configfolder=PATH                         Root folder to find the configuration file
  -d, --orgdestination=(alias|username)           SFDX alias or username for the DESTINATION org
  -s, --orgsource=(alias|username)                SFDX alias or username for the SOURCE org
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  logging level for this command invocation
```

_See code: [src/commands/ETCopyData/full.ts](https://github.com/eltoroit/ETCopyData/blob/v0.4.3/src/commands/ETCopyData/full.ts)_

## `sfdx ETCopyData:import`

Imports data into destination org, you can control if the data in the destination sObjects should be removed before loading a new data set. The data load happens in a specific order (children first, parents last) which has been determined by checking the schema in the destination org.

```
USAGE
  $ sfdx ETCopyData:import

OPTIONS
  -c, --configfolder=PATH                         Root folder to find the configuration file
  -d, --orgdestination=(alias|username)           SFDX alias or username for the DESTINATION org
  -s, --orgsource=(alias|username)                SFDX alias or username for the SOURCE org
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  logging level for this command invocation
```

_See code: [src/commands/ETCopyData/import.ts](https://github.com/eltoroit/ETCopyData/blob/v0.4.3/src/commands/ETCopyData/import.ts)_
<!-- commandsstop -->
<!-- ET-AUTO-STOP: This section is auto-updated... -->
