# ETCopyDataSF

SF Plugin (v3.x) for Salesforce data migration - migrate data between Salesforce orgs with support for related sObjects.

[![Version](https://img.shields.io/npm/v/etcopydatasf.svg)](https://npmjs.org/package/etcopydatasf) [![License](https://img.shields.io/npm/l/etcopydatasf.svg)](https://github.com/ELTOROIT/ETCopyData/blob/master/package.json)

> **⚠️ Version 3.0 Breaking Changes**: This version migrates from SFDX CLI to SF CLI. If you're using v2.x, see the [Migration Guide](#migrating-from-v2x-sfdx-to-v3x-sf) below.

> **Alternative Tool**: For more advanced data migration needs, consider [Salesforce Data Move Utility (SFDMU)](https://help.sfdmu.com/) - a feature-rich, actively maintained tool by the Salesforce community.

<!-- ET-AUTO-START: This section is auto-updated... -->
<!-- toc -->
* [ETCopyDataSF](#etcopydatasf)
* [Install](#install)
* [Migrating from v2.x (SFDX) to v3.x (SF)](#migrating-from-v2x-sfdx-to-v3x-sf)
* [Quick Start](#quick-start)
* [Documentation](#documentation)
* [Commands](#commands)
<!-- tocstop -->
    <!-- ET-AUTO-STOP: This section is auto-updated... -->

# Install

## Prerequisites

-   SF CLI v2.x or higher: `sf --version`
-   If you need to install SF CLI, see: [Salesforce CLI Installation](https://developer.salesforce.com/tools/salesforcecli)

## Install as Plugin

```bash
sf plugins:install etcopydatasf
```

You'll be prompted that this, like any plugin, is not officially code-signed by Salesforce. If that's annoying, you can [whitelist it](https://developer.salesforce.com/blogs/2017/10/salesforce-dx-cli-plugin-update.html)

## Install from Source (for development)

1. Install the SF CLI
2. Clone the repository: `git clone https://github.com/eltoroit/ETCopyData.git`
3. Change directory: `cd ETCopyData`
4. Install npm modules: `npm install`
5. Build the plugin: `npm run build`
6. Link the plugin: `sf plugins:link .`

# Migrating from v2.x (SFDX) to v3.x (SF)

**This is a MAJOR breaking change release.** Version 3.x works with the SF CLI and uses different command names and config files.

## Key Changes

| Aspect | v2.x (SFDX) | v3.x (SF) |
|--------|-------------|-----------|
| Package | `etcopydata` | `etcopydatasf` |
| CLI | `sfdx` | `sf` |
| Commands | `sfdx ETCopyData:export` | `sf ETCopyDataSF export` |
| Config File | `ETCopyData.json` | `ETCopyDataSF.json` |
| Default Folder | `./ETCopyData` | `./ETCopyDataSF` |

## Migration Steps

1. **Install new version:**
   ```bash
   sf plugins:install etcopydatasf
   ```

2. **Copy your config file:**
   ```bash
   cp ETCopyData.json ETCopyDataSF.json
   ```

3. **Update config file (if using default folder):**
   Edit `ETCopyDataSF.json` and change `"rootFolder": "./ETCopyData"` to `"rootFolder": "./ETCopyDataSF"` (or keep using your custom folder path).

4. **Update your scripts:**
   ```bash
   # Old (v2.x)
   sfdx ETCopyData:export -c ./data -s MyOrg
   
   # New (v3.x)
   sf ETCopyDataSF export -c ./data -s MyOrg
   ```

5. **(Optional) Uninstall legacy version:**
   ```bash
   npm uninstall -g etcopydata
   ```

**Note:** Both versions can coexist on the same machine since they use different command namespaces, config files, and default folders.

For detailed migration instructions, see [USER_MIGRATION_GUIDE.md](USER_MIGRATION_GUIDE.md).

# Quick Start

1. **Authenticate to your orgs:**
   ```bash
   sf org login web -a SourceOrg
   sf org login web -a DestOrg
   ```

2. **Create a config file:**
   The plugin will create a sample `ETCopyDataSF.json` if it doesn't exist:
   ```bash
   sf ETCopyDataSF export -c ./mydata -s SourceOrg
   ```

3. **Edit the config file** to specify which sObjects and fields to copy

4. **Export, import, and enjoy:**
   ```bash
   sf ETCopyDataSF export -c ./mydata -s SourceOrg
   sf ETCopyDataSF import -c ./mydata -d DestOrg
   ```

# Documentation

This plugin is highly configurable with a JSON file named `ETCopyDataSF.json` located in the folder you specify with the `-c` flag. If the file does not exist, the plugin creates a sample file before erroring out, allowing you to get started quickly.

> **Legacy Config Detection:** If you have an old `ETCopyData.json` file, the plugin will warn you and suggest migrating it to `ETCopyDataSF.json`.

## ETCopyDataSF.json

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
      "name": "RecordType",
      "matchBy": "SobjectType,DeveloperName",
      "fieldsToExport": "Id,SobjectType,NamespacePrefix,DeveloperName",
      "where": null,
      "orderBy": "DeveloperName"
    },
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
| **useBulkAPI<sup>11</sup>**            | false   | Boolean            | True if you prefer to use Bulk API, false if you prefer to use REST API. API.                                                                            |
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
11. Using Bulk API is better for large data loads because it minimizes the number of API calls, Salesforce has a limit of calls per 24 hours. Also doing the Bulk API the batches are 10K records rather than just 200, that's why there are more calls for Rest API. But Bulk API is asynchronous, Salesforce may be busy and take more than to process those requests than synchronous calls.

# Commands

<!-- ET-AUTO-START: This section is auto-updated... -->
<!-- commands -->
* [`sf ETCopyDataSF:compare`](#sf-etcopydatasfcompare)
* [`sf ETCopyDataSF:delete`](#sf-etcopydatasfdelete)
* [`sf ETCopyDataSF:export`](#sf-etcopydatasfexport)
* [`sf ETCopyDataSF:full`](#sf-etcopydatasffull)
* [`sf ETCopyDataSF:import`](#sf-etcopydatasfimport)

## `sf ETCopyDataSF:compare`

Checks the source and destination org for any differences in the sObject's metadata

```
USAGE
  $ sf ETCopyDataSF:compare [--json] [--flags-dir <value>] [-c <value>] [-d <value>] [-s <value>] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -c, --configfolder=<value>    Root folder to find the configuration file
  -d, --orgdestination=<value>  SF alias or username for the DESTINATION org
  -s, --orgsource=<value>       SF alias or username for the SOURCE org
      --loglevel=<option>       [default: warn] Logging level for this command invocation
                                <options: trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Checks the source and destination org for any differences in the sObject's metadata

  This helps determine what data can be properly exported/imported.

FLAG DESCRIPTIONS
  -c, --configfolder=<value>  Root folder to find the configuration file

    Path to folder containing ETCopyDataSF.json config file
```

_See code: [src/commands/ETCopyDataSF/compare.ts](https://github.com/eltoroit/ETCopyData/blob/v3.0.0/src/commands/ETCopyDataSF/compare.ts)_

## `sf ETCopyDataSF:delete`

Deletes data from destination org

```
USAGE
  $ sf ETCopyDataSF:delete [--json] [--flags-dir <value>] [-c <value>] [-d <value>] [-s <value>] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -c, --configfolder=<value>    Root folder to find the configuration file
  -d, --orgdestination=<value>  SF alias or username for the DESTINATION org
  -s, --orgsource=<value>       SF alias or username for the SOURCE org
      --loglevel=<option>       [default: warn] Logging level for this command invocation
                                <options: trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Deletes data from destination org

  Prepares for the new data that will be uploaded. Note: Deleting optionally happens before loading, but if there are
  some errors this operation can be retried by itself.

FLAG DESCRIPTIONS
  -c, --configfolder=<value>  Root folder to find the configuration file

    Path to folder containing ETCopyDataSF.json config file
```

_See code: [src/commands/ETCopyDataSF/delete.ts](https://github.com/eltoroit/ETCopyData/blob/v3.0.0/src/commands/ETCopyDataSF/delete.ts)_

## `sf ETCopyDataSF:export`

Exports the data from the source org

```
USAGE
  $ sf ETCopyDataSF:export [--json] [--flags-dir <value>] [-c <value>] [-d <value>] [-s <value>] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -c, --configfolder=<value>    Root folder to find the configuration file
  -d, --orgdestination=<value>  SF alias or username for the DESTINATION org
  -s, --orgsource=<value>       SF alias or username for the SOURCE org
      --loglevel=<option>       [default: warn] Logging level for this command invocation
                                <options: trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Exports the data from the source org

  Saves the data in the destination folder so that it can be imported at a later time.

FLAG DESCRIPTIONS
  -c, --configfolder=<value>  Root folder to find the configuration file

    Path to folder containing ETCopyDataSF.json config file
```

_See code: [src/commands/ETCopyDataSF/export.ts](https://github.com/eltoroit/ETCopyData/blob/v3.0.0/src/commands/ETCopyDataSF/export.ts)_

## `sf ETCopyDataSF:full`

Performs all steps of the data migration

```
USAGE
  $ sf ETCopyDataSF:full [--json] [--flags-dir <value>] [-c <value>] [-d <value>] [-s <value>] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -c, --configfolder=<value>    Root folder to find the configuration file
  -d, --orgdestination=<value>  SF alias or username for the DESTINATION org
  -s, --orgsource=<value>       SF alias or username for the SOURCE org
      --loglevel=<option>       [default: warn] Logging level for this command invocation
                                <options: trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Performs all steps of the data migration

  Includes comparing schemas, exporting data from the source, optionally deleting data from the destination, and
  importing the data to the destination org. This may help you when setting up a new process.

FLAG DESCRIPTIONS
  -c, --configfolder=<value>  Root folder to find the configuration file

    Path to folder containing ETCopyDataSF.json config file
```

_See code: [src/commands/ETCopyDataSF/full.ts](https://github.com/eltoroit/ETCopyData/blob/v3.0.0/src/commands/ETCopyDataSF/full.ts)_

## `sf ETCopyDataSF:import`

Imports data into destination org

```
USAGE
  $ sf ETCopyDataSF:import [--json] [--flags-dir <value>] [-c <value>] [-d <value>] [-s <value>] [--loglevel
    trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -c, --configfolder=<value>    Root folder to find the configuration file
  -d, --orgdestination=<value>  SF alias or username for the DESTINATION org
  -s, --orgsource=<value>       SF alias or username for the SOURCE org
      --loglevel=<option>       [default: warn] Logging level for this command invocation
                                <options: trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Imports data into destination org

  You can control if the data in the destination sObjects should be removed before loading a new data set. The data load
  happens in a specific order (children first, parents last) which has been determined by checking the schema in the
  destination org.

FLAG DESCRIPTIONS
  -c, --configfolder=<value>  Root folder to find the configuration file

    Path to folder containing ETCopyDataSF.json config file
```

_See code: [src/commands/ETCopyDataSF/import.ts](https://github.com/eltoroit/ETCopyData/blob/v3.0.0/src/commands/ETCopyDataSF/import.ts)_
<!-- commandsstop -->
<!-- ET-AUTO-STOP: This section is auto-updated... -->
