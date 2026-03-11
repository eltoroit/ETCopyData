# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ETCopyDataSF is a Salesforce CLI (SF) plugin for migrating data between Salesforce orgs with support for related sObjects. It handles complex relationships, circular references, and hierarchical data structures.

**Technology Stack:**
- TypeScript (ES modules)
- SF CLI Plugin Framework (@salesforce/sf-plugins-core)
- Salesforce JSForce for API interactions

## Build and Development Commands

```bash
# Build TypeScript to JavaScript
npm run build

# Run the plugin (after building)
sf ETCopyDataSF <command> -c <config-folder> [options]

# Test with trace logging
sf ETCopyDataSF delete -c ./@ELTOROIT/data --force-production --loglevel trace 2>&1 | tee etLogs/etCopyData.txt

# Run tests
npm test

# Lint code
npm run lint
```

## High-Level Architecture

### Core Data Flow

1. **Settings** (`Settings.ts`) - Loads `ETCopyDataSF.json` configuration
2. **OrgManager** (`OrgManager.ts`) - Manages source/destination org connections
3. **SchemaDiscovery** (`SchemaDiscovery.ts`) - Discovers sObject schemas, validates fields
4. **SchemaOrder** (`SchemaOrder.ts`) - Determines import order based on dependencies
5. **Exporter** (`Exporter.ts`) - Exports data from source org
6. **Importer** (`Importer.ts`) - Imports data to destination org with proper ordering
7. **DataAPI** (`DataAPI.ts`) - Handles Bulk API and REST API operations

### Key Architectural Patterns

**Two-Pass Import Strategy:**
- Some fields create circular dependencies (e.g., Account.ParentId referencing Account)
- These are configured as `twoPassReferenceFields` in the config
- First pass: Import records with circular fields NULL
- Second pass: Update records with correct reference values

**Dependency Resolution:**
- `SchemaOrder.findImportOrder()` uses topological sorting to determine import order
- Objects with no dependencies are imported first
- Deadlock detection identifies circular/self-referencing fields that need `twoPassReferenceFields` configuration

**Metadata vs Data Objects:**
- Metadata sObjects (User, RecordType) are matched by fields like Email or DeveloperName
- Data sObjects are created with new IDs, with ID mapping tracked for relationships

## Key Files and Their Responsibilities

| File | Purpose | Key Methods |
|------|---------|-------------|
| `ETCopyDataSF.ts` | Main orchestrator | `initializeETCopy()`, `exportData()`, `importData()`, `deleteData()` |
| `Settings.ts` | Config file parsing | `getSObjectData()`, `getRequestedSObjectNames()` |
| `SchemaDiscovery.ts` | Schema introspection | `findObjectsAsync()`, `getSObjects()`, validates field accessibility |
| `SchemaOrder.ts` | Dependency resolution | `findImportOrder()` - topological sort, deadlock detection |
| `OrgManager.ts` | Salesforce connection | Wraps JSForce connection, manages org aliases |
| `Importer.ts` | Data import logic | `importAll()`, handles two-pass imports |
| `Exporter.ts` | Data export logic | `exportData()`, `exportMetadata()` |
| `CoreMetadataSObjects.ts` | Metadata object handling | `makeMetadata()`, manages metadata sObject queries |

## Common Issues and Debugging

### Deadlock Errors

**Symptom:** "Deadlock determining import order, most likely caused by circular or self reference"

**Root Cause:** Self-referencing fields (Account.ParentId) or circular references (A→B→A) not configured as `twoPassReferenceFields`

**Debug Steps:**
1. Check INFO log messages showing which fields were rejected as self-references
2. Look for patterns like `Account.ParentId Self-relationships are supported, but require [twoPassReferenceField]`
3. Add those fields to `twoPassReferenceFields` in `ETCopyDataSF.json`

**Code Location:** `SchemaOrder.ts:56-94` (deadlock detection and error message generation)

### Schema Discovery Rejection

**How It Works:** `SchemaDiscovery.ts:300-368` (addField method) validates fields before including them:
- Self-referencing lookup fields are rejected unless in `twoPassReferenceFields`
- Fields must be createable and not calculated/autonumber
- Parent sObjects must exist in the migration set

**Rejection Tracking:** All rejections are stored in `allRejects` map and written to `org.json` files

### Org Comparison

When schemas differ between source/destination:
- `ETCopyDataSF.ts:284-367` (compareSchemaForOrgs) identifies mismatches
- Missing fields are discarded via `SchemaDiscovery.discardFields()`
- Missing sObjects are discarded via `SchemaDiscovery.discardSObject()`
- Warnings are logged but process continues (unless `stopOnErrors: true`)

## Configuration Reference

**File:** `ETCopyDataSF.json`

**Critical Fields:**
- `sObjectsData[].twoPassReferenceFields` - Comma-separated list of fields to handle in second pass
- `copyToProduction: true` - Required when destination is production
- `deleteDestination: true` - Deletes existing data before import
- `useBulkAPI: true/false` - Bulk API (async, 10K batches) vs REST API (sync, 200 records)

## Important Notes for Code Changes

1. **Null Safety:** Many properties initialize as `null` and are populated lazily (e.g., `CoreMetadataSObjects.metadataSobjects`). Always check initialization or call setup methods before accessing.

2. **ES Modules:** This project uses ES modules (type: "module" in package.json). Use `.js` extensions in import statements even though files are `.ts`.

3. **Error Messages:** Use `Util.throwError()` for errors and `Util.writeLog()` for logging with appropriate `LogLevel`.

4. **Production Safety:** Production org operations require both:
   - Config file: `copyToProduction: true`
   - CLI flag: `--force-production` (for non-interactive mode)

5. **Testing Against Real Orgs:** The `@ELTOROIT/data` folder contains test configurations. Authenticate to orgs before testing:
   ```bash
   aws sso login  # If using AWS SSO
   sf org login web -a <org-alias>
   ```

6. **Schema Discovery Timing:** `findObjectsAsync()` is async but many consumers expect synchronous access to the populated map. Ensure discovery completes before calling `getSObjects()`.

## Log Files

- `etLogs/etCopyData.txt` - Detailed trace logs (when using `--loglevel trace`)
- `@ELTOROIT/data/ETCopyData/<org-alias>/org.json` - Schema discovery results, includes rejected fields/objects

## Recent Changes

- Enhanced deadlock error messages to provide actionable configuration guidance
- Error now suggests specific `twoPassReferenceFields` configuration when circular/self-references are detected
