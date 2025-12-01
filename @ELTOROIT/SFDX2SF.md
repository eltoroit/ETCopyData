# Migrate ETCopyData to SF Plugin (ETCopyDataSF)

## Phase 0: Set Up ESLint Auto-Migration (RECOMMENDED)

According to the [official Salesforce migration guide](https://developer.salesforce.com/docs/platform/salesforce-cli-plugin/guide/migrate-sfdx-sf.html), Salesforce provides ESLint rules that can **automatically fix many migration issues**.

### Install ESLint migration tooling:

```bash
# Install Salesforce ESLint plugin
npm install --save-dev @salesforce/eslint-config-sf-plugin @salesforce/dev-scripts

# Or if using dev-scripts already
npm update @salesforce/dev-scripts
```

### Configure .eslintrc:

Create or update `.eslintrc.json` to include SF plugin migration rules:

```json
{
	"extends": ["@salesforce/eslint-config-sf-plugin"],
	"rules": {
		"@salesforce/sf-plugin/migration-v3": "error"
	}
}
```

### Run auto-fix:

```bash
# This will automatically fix many issues
npm run lint -- --fix
```

The ESLint plugin can automatically:

-   Convert `SfdxCommand` → `SfCommand`
-   Update `flags` → `Flags`
-   Update `UX` → `Ux`
-   Remove deprecated properties

**Note:** We still need manual changes for renaming, but this handles much of the boilerplate!

## Phase 1: Rename Project to ETCopyDataSF

### Update [package.json](package.json)

**Update package identity:**

-   `"name"`: `"etcopydata"` → `"etcopydatasf"`
-   `"description"`: Update to mention "SF Plugin" instead of "SFDX Plugin"
-   `"keywords"`: Change `["sfdx-plugin"]` → `["sf-plugin", "salesforce", "data-migration", "etcopydatasf", "etcopydata"]` - Include "etcopydata" for backward search compatibility

**Update command namespace (BREAKING CHANGE):**

```json
"oclif": {
  "bin": "sf",  // change from "sfdx"
  "commands": "./lib/commands",
  "topics": {
    "ETCopyDataSF": {  // CHANGED from "ETCopyData"
      "description": "SF Plugin to populate your orgs with data for multiple related sObjects."
    }
  }
}
```

**Commands will be:**

-   `sf ETCopyDataSF export` (instead of `sfdx ETCopyData:export`)
-   `sf ETCopyDataSF import` (instead of `sfdx ETCopyData:import`)
-   etc.

### Rename internal TypeScript classes and folders

**Files needing class renames (ETCopyData → ETCopyDataSF):**

1.  **[src/@ELTOROIT/ETCopyData.ts](src/@ELTOROIT/ETCopyData.ts)**

                                                - Rename class: `export class ETCopyData` → `export class ETCopyDataSF`
                                                - Rename file to: `ETCopyDataSF.ts`

2.  **Rename command folder:** `src/commands/ETCopyData/` → `src/commands/ETCopyDataSF/`

                                                - This changes the command namespace automatically

3.  **Update imports in all command files:**

                                                - [src/commands/ETCopyDataSF/compare.ts](src/commands/ETCopyData/compare.ts) (after rename)
                                                - [src/commands/ETCopyDataSF/delete.ts](src/commands/ETCopyData/delete.ts) (after rename)
                                                - [src/commands/ETCopyDataSF/export.ts](src/commands/ETCopyData/export.ts) (after rename)
                                                - [src/commands/ETCopyDataSF/full.ts](src/commands/ETCopyData/full.ts) (after rename)
                                                - [src/commands/ETCopyDataSF/import.ts](src/commands/ETCopyData/import.ts) (after rename)

Change: `import { ETCopyData } from "../../@ELTOROIT/ETCopyData";`

To: `import { ETCopyDataSF } from "../../@ELTOROIT/ETCopyDataSF";`

4.  **Update class instantiation in commands:**

                                                - Change: `const ETCD = new ETCopyData();`
                                                - To: `const ETCD = new ETCopyDataSF();`
                                                - Change: `ETCopyData.setLogs()` → `ETCopyDataSF.setLogs()`
                                                - Change: `ETCopyData.readParameters()` → `ETCopyDataSF.readParameters()`
                                                - Change: `ETCopyData.flagsConfig` → `ETCopyDataSF.flagsConfig`
                                                - Change log messages: `"ETCopyData:Export"` → `"ETCopyDataSF:Export"`

5.  **Update [src/@ELTOROIT/Exporter.ts](src/@ELTOROIT/Exporter.ts)** and **[src/@ELTOROIT/Importer.ts](src/@ELTOROIT/Importer.ts)** if they import ETCopyData

6.  **Update [src/index.ts](src/index.ts)** if it exports ETCopyData class

### Rename configuration file and default folder

**Update [src/@ELTOROIT/Settings.ts](src/@ELTOROIT/Settings.ts):**

**Line 261 - Default folder name:**

```typescript
// OLD
if (!readFolder) {
	readFolder = "ETCopyData";
}

// NEW
if (!readFolder) {
	readFolder = "ETCopyDataSF";
}
```

**Line 567 - Config filename:**

```typescript
// OLD
return ConfigFile.create({
	filename: "ETCopyData.json",
	isGlobal: false,
	isState: false,
	rootFolder: this.configfolder
});

// NEW
return ConfigFile.create({
	filename: "ETCopyDataSF.json", // CHANGED
	isGlobal: false,
	isState: false,
	rootFolder: this.configfolder
});
```

### Update spinner/progress messages

**Update [src/@ELTOROIT/ETCopyDataSF.ts](src/@ELTOROIT/ETCopyData.ts) (after rename):**

Find and replace all spinner messages (lines ~82, 106, 136, 175):

```typescript
// OLD
ux.startSpinner("ETCopyData:compare");
ux.startSpinner("ETCopyData:Delete");
ux.startSpinner("ETCopyData:Export");
ux.startSpinner("ETCopyData:Import");

// NEW
ux.startSpinner("ETCopyDataSF:compare");
ux.startSpinner("ETCopyDataSF:Delete");
ux.startSpinner("ETCopyDataSF:Export");
ux.startSpinner("ETCopyDataSF:Import");
```

## Phase 2: Add Auto-Detection of Legacy Config

### Create migration helper in Settings.ts

Add a new method to detect and prompt for old config file:

```typescript
private async detectLegacyConfig(): Promise<void> {
  const legacyConfigPath = `${this.configfolder}/ETCopyData.json`;

  try {
    await fsPromises.access(legacyConfigPath);

    // Legacy config exists!
    Util.writeLog("⚠️  Legacy ETCopyData.json detected!", LogLevel.WARN);
    Util.writeLog("", LogLevel.INFO);
    Util.writeLog("This plugin uses ETCopyDataSF.json (not ETCopyData.json)", LogLevel.INFO);
    Util.writeLog("To migrate, copy your config:", LogLevel.INFO);
    Util.writeLog(`  cp ${legacyConfigPath} ${this.configfolder}/ETCopyDataSF.json`, LogLevel.INFO);
    Util.writeLog("", LogLevel.INFO);
    Util.writeLog("To continue using the legacy version, use: npm install etcopydata@2.1.2", LogLevel.INFO);
    Util.writeLog("", LogLevel.INFO);

    // Optionally prompt to auto-migrate
    // (implementation depends on whether you want interactive prompts)

  } catch (err) {
    // No legacy config found, continue normally
  }
}
```

Call this method early in the initialization process (in `readAll` method around line 66).

## Phase 3: Update Dependencies

### Update [package.json](package.json)

**Remove deprecated packages:**

-   `@salesforce/command` (deprecated, replaced by sf-plugins-core)
-   `sfdx-cli` (no longer needed)

**Update to latest versions:**

-   `@salesforce/core`: `^3` → `^7` (or latest stable)
-   `@oclif/core`: `^1` → `^4` (or latest stable)
-   `@oclif/test`: `^2` → `^3` (or latest stable)

**Add new packages:**

-   `@salesforce/sf-plugins-core`: latest version

**Add dev dependencies for migration:**

-   `@salesforce/eslint-config-sf-plugin`: latest
-   `@salesforce/dev-scripts`: latest (if not already present)

## Phase 4: Migrate Command Files (5 files)

All command files in `src/commands/ETCopyDataSF/` (after rename) need the same pattern of changes:

### Files to update:

1. [src/commands/ETCopyDataSF/compare.ts](src/commands/ETCopyData/compare.ts)
2. [src/commands/ETCopyDataSF/delete.ts](src/commands/ETCopyData/delete.ts)
3. [src/commands/ETCopyDataSF/export.ts](src/commands/ETCopyData/export.ts)
4. [src/commands/ETCopyDataSF/full.ts](src/commands/ETCopyData/full.ts)
5. [src/commands/ETCopyDataSF/import.ts](src/commands/ETCopyData/import.ts)

### Changes for each command file:

**Update imports:**

```typescript
// OLD
import { SfdxCommand, Result } from "@salesforce/command";
import { ETCopyData } from "../../@ELTOROIT/ETCopyData";

// NEW
import { SfCommand } from "@salesforce/sf-plugins-core";
import { Messages } from "@salesforce/core";
import { ETCopyDataSF } from "../../@ELTOROIT/ETCopyDataSF";
```

**Update class declaration:**

```typescript
// OLD
export default class Export extends SfdxCommand {

// NEW
export default class Export extends SfCommand<any> {
```

**Update ETCopyData references to ETCopyDataSF:**

```typescript
// OLD
ETCopyData.setLogs(this.flags, this.ux, "ETCopyData:Export", this.config);
const s: Settings = ETCopyData.readParameters(this.flags);
const ETCD = new ETCopyData();

// NEW
ETCopyDataSF.setLogs(this.flags, this.ux, "ETCopyDataSF:Export", this.config);
const s: Settings = ETCopyDataSF.readParameters(this.flags);
const ETCD = new ETCopyDataSF();
```

**Update flag access:**

```typescript
// OLD
protected static flagsConfig = ETCopyData.flagsConfig;

// NEW
protected static flagsConfig = ETCopyDataSF.flagsConfig;
```

**Handle private `this.ux` in SfCommand:**

Per the [Salesforce migration guide](https://developer.salesforce.com/docs/platform/salesforce-cli-plugin/guide/migrate-sfdx-sf.html), `SfCommand` has a private `ux` property. If you pass `this.ux` to helper functions, create a new Ux instance:

```typescript
// If you pass ux around:
import { Ux } from "@salesforce/sf-plugins-core";

// In your method:
const ux = new Ux();
```

## Phase 5: Update Core Library Files

### Rename and update [src/@ELTOROIT/ETCopyData.ts](src/@ELTOROIT/ETCopyData.ts) → ETCopyDataSF.ts

**Rename file:** `ETCopyData.ts` → `ETCopyDataSF.ts`

**Update class name:**

```typescript
// OLD
export class ETCopyData {

// NEW
export class ETCopyDataSF {
```

**Update imports:**

```typescript
// OLD
import { flags, UX } from "@salesforce/command";

// NEW
import { Flags } from "@salesforce/sf-plugins-core";
import { Ux } from "@salesforce/sf-plugins-core";
```

**Update flagsConfig:**

```typescript
// OLD
public static flagsConfig = {
  configfolder: flags.string({
    char: "c",
    description: "Root folder to find the configuration file",
    helpValue: "PATH"
  }),
  orgdestination: flags.string({
    char: "d",
    description: "SFDX alias or username for the DESTINATION org",
    helpValue: "(alias|username)"
  }),
  orgsource: flags.string({
    char: "s",
    description: "SFDX alias or username for the SOURCE org",
    helpValue: "(alias|username)"
  })
};

// NEW
public static flagsConfig = {
  configfolder: Flags.string({
    char: "c",
    summary: "Root folder to find the configuration file",
    description: "Path to folder containing ETCopyDataSF.json config file"
  }),
  orgdestination: Flags.string({
    char: "d",
    summary: "SF alias or username for the DESTINATION org",
  }),
  orgsource: Flags.string({
    char: "s",
    summary: "SF alias or username for the SOURCE org",
  })
};
```

**Update setLogs method:**

```typescript
// OLD
public static setLogs(params: any, ux: UX, processName: string, config: any): void {

// NEW
public static setLogs(params: any, ux: Ux, processName: string, config: any): void {
```

**Update plugin name reference (line 48):**

```typescript
// OLD
const me: any = config.plugins.filter((plugin) => plugin.name === "etcopydata")[0];

// NEW
const me: any = config.plugins.filter((plugin) => plugin.name === "etcopydatasf")[0];
```

**Update UX.create() calls:**

```typescript
// OLD
UX.create();

// NEW
new Ux();
```

### Update [src/@ELTOROIT/OrgManager.ts](src/@ELTOROIT/OrgManager.ts) (if needed)

Check if there are any references to ETCopyData class that need updating to ETCopyDataSF. The `@salesforce/core` imports should remain compatible with v7.

### Update [src/index.ts](src/index.ts)

**Update exports if ETCopyData is exported:**

```typescript
// Check if file contains:
export { ETCopyData } from "./@ELTOROIT/ETCopyData";

// If so, update to:
export { ETCopyDataSF } from "./@ELTOROIT/ETCopyDataSF";
```

## Phase 6: Handle Breaking Changes in @salesforce/core v7

### Review and update core library usage:

-   Connection API usage (should be compatible)
-   Org API usage (should be compatible)
-   Check for any deprecated methods

### Migration resources:

-   [@salesforce/core v3→v4, v4→v5, v5→v6, v6→v7 migration guides](https://github.com/forcedotcom/sfdx-core)
-   Most Connection/Org APIs remain stable

## Phase 7: Update Tests

### Update test files if they exist:

**[test/commands/hello/org.test.ts](test/commands/hello/org.test.ts):**

-   Update imports from `@salesforce/command/lib/test`
-   Use new testing patterns from `@salesforce/core` v7
-   Per the [migration guide](https://developer.salesforce.com/docs/platform/salesforce-cli-plugin/guide/migrate-sfdx-sf.html), use `TestSetup` for mocking
-   Consider removing if it's just boilerplate

## Phase 8: Install Dependencies and Build

1.  **Clean existing builds:**

    ```bash
    rm -rf node_modules lib
    ```

2.  **Install new dependencies:**

    ```bash
    npm install
    ```

3.  **Run ESLint auto-fix (if configured in Phase 0):**

    ```bash
    npm run lint -- --fix
    ```

4.  **Compile TypeScript:**

    ```bash
    npm run build
    ```

5.  **Fix any TypeScript compilation errors** that arise from:

                                                - Class renames
                                                - Import path changes
                                                - Folder renames
                                                - API changes in dependencies

## Phase 9: Testing

1. **Link the plugin locally:**

    ```bash
    sf plugins link .
    ```

2. **Verify plugin is recognized:**
    ```bash
    sf plugins
    ```

Should show `etcopydatasf` in the list

3.  **Test command help (NEW COMMAND NAMES):**

    ```bash
    sf ETCopyDataSF export --help
    sf ETCopyDataSF import --help
    sf ETCopyDataSF compare --help
    sf ETCopyDataSF delete --help
    sf ETCopyDataSF full --help
    ```

4.  **Test with legacy config detection:**

                                                - Create a test folder with old `ETCopyData.json`
                                                - Run command to verify warning appears
                                                - Rename to `ETCopyDataSF.json` and verify it works

5.  **Test with actual orgs (if available):**

    ```bash
    sf ETCopyDataSF export -c ./@ELTOROIT/data -s MySourceOrg
    sf ETCopyDataSF import -c ./@ELTOROIT/data -d MyDestOrg
    ```

6.  **Verify no conflicts with legacy version** (if both installed)

## Phase 10: Update Documentation

### Update [README.md](README.md)

**Remove deprecation notice at the top** (lines 1-9)

**Update title and badges:**

```markdown
# ETCopyDataSF

SF Plugin (v3.x) for Salesforce data migration - migrate data between Salesforce orgs with support for related sObjects.

[![Version](https://img.shields.io/npm/v/etcopydatasf.svg)](https://npmjs.org/package/etcopydatasf)
[![License](https://img.shields.io/npm/l/etcopydatasf.svg)](https://github.com/ELTOROIT/ETCopyData/blob/master/package.json)
```

**Add migration notice for existing users:**

````markdown
## ⚠️ Migrating from v2.x (SFDX) to v3.x (SF)

**This is a MAJOR breaking change release.** Version 3.x works with the SF CLI and is incompatible with SFDX.

### Breaking Changes:

-   **Package name:** `etcopydata` → `etcopydatasf`
-   **Commands:** `sfdx ETCopyData:export` → `sf ETCopyDataSF export`
-   **Config file:** `ETCopyData.json` → `ETCopyDataSF.json`
-   **Default folder:** `./ETCopyData` → `./ETCopyDataSF`

These changes allow both versions to coexist on the same machine.

### Migration Steps:

1. Install new version: `sf plugins:install etcopydatasf`
2. Copy your config: `cp ETCopyData.json ETCopyDataSF.json`
3. Update config file's `rootFolder` if set to `./ETCopyData` → `./ETCopyDataSF`
4. Update your scripts to use `sf ETCopyDataSF` commands
5. (Optional) Uninstall legacy: `npm uninstall etcopydata`

### Using Both Versions:

The SF version (v3.x) can coexist with the SFDX version (v2.x) since they use different:

-   Command namespaces
-   Config files
-   Default folders

```bash
# Legacy SFDX version (if you need it)
npm install etcopydata@2.1.2
sfdx ETCopyData:export -c ./data

# New SF version
sf plugins:install etcopydatasf
sf ETCopyDataSF export -c ./data
```
````

````

**Update installation instructions:**
```bash
# Install
sf plugins:install etcopydatasf

# Commands use new namespace
sf ETCopyDataSF export -c ./data -s MyOrg
sf ETCopyDataSF import -c ./data -d MyOrg
````

**Update ETCopyData.json section:**

-   Change title: `## ETCopyDataSF.json`
-   Update first line: "This plugin is highly configurable with a JSON file named `ETCopyDataSF.json`"
-   Update all examples showing config file to use `ETCopyDataSF.json`
-   Update `rootFolder` examples from `./ETCopyData` to `./ETCopyDataSF`

**Update all command examples throughout:**

-   Change all `sfdx ETCopyData:` to `sf ETCopyDataSF `
-   Update all `ETCopyData.json` references to `ETCopyDataSF.json`
-   Update default folder examples
-   Change references from "SFDX alias" to "SF alias"

**Update installation section (line ~30):**

````markdown
# Install

## Install as plugin

`sf plugins:install etcopydatasf`

## For SF CLI v2

The plugin works with SF CLI v2. Make sure you have SF CLI installed:

```bash
sf --version
# Should show: @salesforce/cli/2.x.x
```
````

If you need to install or update SF CLI, see: https://developer.salesforce.com/tools/salesforcecli

````

### Create USER_MIGRATION_GUIDE.md

Create a new file with detailed migration instructions:

```markdown
# Migration Guide: ETCopyData v2.x → ETCopyDataSF v3.x

## Overview

Version 3.0.0 represents a complete migration from SFDX CLI to SF CLI. This guide will help you migrate your existing setup.

## Prerequisites

- SF CLI installed (`sf --version`)
- Existing ETCopyData v2.x configuration and data

## Step-by-Step Migration

### 1. Install the New Version

```bash
# Install SF version
sf plugins:install etcopydatasf

# Verify installation
sf plugins
# Should show: etcopydatasf 3.0.0
````

### 2. Migrate Configuration Files

For each project using ETCopyData:

```bash
# Navigate to your project
cd /path/to/your/project

# Copy (don't move!) your config file
cp ETCopyData.json ETCopyDataSF.json

# Edit ETCopyDataSF.json if needed
```

**Update config if using default folder:**

```json
{
	"rootFolder": "./ETCopyDataSF" // Changed from "./ETCopyData"
	// ... rest of config
}
```

**Or keep using your custom folder:**

```json
{
	"rootFolder": "./@ELTOROIT/data" // Custom folders work fine!
	// ... rest of config
}
```

### 3. Migrate Data Folders (Optional)

If you want to keep old data separate:

```bash
# Option A: Keep old data, create new folder
# Old data stays in ./ETCopyData
# New exports go to ./ETCopyDataSF

# Option B: Copy old data to new location
cp -r ./ETCopyData ./ETCopyDataSF

# Option C: Continue using custom folder (recommended)
# If your config uses "./@ELTOROIT/data", no changes needed!
```

### 4. Update Scripts and CI/CD

Update all scripts that call the plugin:

```bash
# OLD (SFDX)
sfdx ETCopyData:export -c ./data -s MyOrg
sfdx ETCopyData:import -c ./data -d MyOrg

# NEW (SF)
sf ETCopyDataSF export -c ./data -s MyOrg
sf ETCopyDataSF import -c ./data -d MyOrg
```

**GitHub Actions example:**

```yaml
# OLD
- name: Export data
  run: sfdx ETCopyData:export -c ./@ELTOROIT/data -s SourceOrg

# NEW
- name: Export data
  run: sf ETCopyDataSF export -c ./@ELTOROIT/data -s SourceOrg
```

### 5. Update Authentication

SF CLI uses the same org authentication as SFDX, but commands differ:

```bash
# OLD (SFDX)
sfdx force:auth:web:login -a MyOrg

# NEW (SF)
sf org login web -a MyOrg

# Your existing authenticated orgs still work!
sf org list
```

### 6. Test the Migration

```bash
# Test with --help first
sf ETCopyDataSF export --help

# Test export (doesn't modify anything)
sf ETCopyDataSF export -c ./@ELTOROIT/data -s MySourceOrg --loglevel trace

# Test import to scratch org first
sf ETCopyDataSF import -c ./@ELTOROIT/data -d MyScratchOrg --loglevel trace
```

### 7. Coexistence (Optional)

Both versions can coexist on the same machine:

```bash
# Keep SFDX version for legacy projects
npm install -g etcopydata@2.1.2

# Use SF version for new/migrated projects
sf plugins:install etcopydatasf

# Use each in their respective projects
cd /old-project && sfdx ETCopyData:export ...
cd /new-project && sf ETCopyDataSF export ...
```

## Troubleshooting

### Config File Not Found

**Error:** `ETCopyDataSF.json not found`

**Solution:** Make sure you renamed/copied your config file:

```bash
cp ETCopyData.json ETCopyDataSF.json
```

### Command Not Found

**Error:** `command ETCopyDataSF not found`

**Solution:** Ensure plugin is installed:

```bash
sf plugins:install etcopydatasf
sf plugins  # verify it's listed
```

### Legacy Config Warning

**Warning:** `⚠️ Legacy ETCopyData.json detected!`

**Solution:** This is informational. The plugin found your old config but is looking for `ETCopyDataSF.json`. Copy it:

```bash
cp ETCopyData.json ETCopyDataSF.json
```

### Org Authentication Issues

**Error:** `No org found with alias X`

**Solution:** Your orgs should still be authenticated, but verify:

```bash
sf org list
# If missing, re-authenticate:
sf org login web -a MyOrg
```

## Rollback Plan

If you need to rollback:

```bash
# Uninstall SF version
sf plugins:uninstall etcopydatasf

# Continue using SFDX version
# (no changes needed if you kept ETCopyData.json)
sfdx ETCopyData:export ...
```

## Benefits of v3.0

-   ✅ Modern SF CLI architecture
-   ✅ Better performance and reliability
-   ✅ Actively maintained
-   ✅ Compatible with latest Salesforce features
-   ✅ Can coexist with v2.x

## Support

-   GitHub Issues: https://github.com/eltoroit/ETCopyData/issues
-   README: https://github.com/eltoroit/ETCopyData

## Version Compatibility

| Feature | v2.x (SFDX) | v3.x (SF) |

|---------|-------------|-----------|

| CLI | sfdx | sf |

| Commands | `ETCopyData:export` | `ETCopyDataSF export` |

| Config | ETCopyData.json | ETCopyDataSF.json |

| Default folder | ./ETCopyData | ./ETCopyDataSF |

| Org auth | `force:auth` | `org login` |

| Can coexist | N/A | ✅ Yes |

````

### Update [@ELTOROIT/Readme.md](@ELTOROIT/Readme.md) (Developer Documentation)

**Remove deprecation notice** (lines 1-9 at the top)

**Update "How to Make Changes" section:**
- Line 22: `@ELTOROIT/data/ETCopyData.json` → `@ELTOROIT/data/ETCopyDataSF.json`

**Update "How to Test Changes" section (lines 36-59):**
- Change all `sfdx` to `sf`
- Change all `ETCopyData:` to `ETCopyDataSF ` (with space, not colon)
- Update examples:
  ```bash
  # OLD
  sfdx ETCopyData:export -c "./@ELTOROIT/data" --loglevel trace --json
  NODE_OPTIONS=--inspect-brk bin/dev ETCopyData:export -c "/path" --loglevel trace --json

  # NEW
  sf ETCopyDataSF export -c "./@ELTOROIT/data" --loglevel trace --json
  NODE_OPTIONS=--inspect-brk bin/dev ETCopyDataSF export -c "/path" --loglevel trace --json
  ```

**Update "How to Install Plugin" section (lines 61-84):**
```bash
# Uninstall old/new versions
sf plugins:uninstall etcopydata
sf plugins:uninstall etcopydatasf

# Link code for development
sf plugins:link --verbose

# Install released/beta/specific versions
sf plugins:install etcopydatasf
sf plugins:install etcopydatasf@beta
sf plugins:install etcopydatasf@3.0.0

# Check installed plugins
sf plugins
````

**Update "How to publish to npm?" section (line 88):**

-   URL: `https://www.npmjs.com/package/etcopydatasf/`

**Update "Compile" section (line 104):**

-   `sfdx plugins:link --verbose` → `sf plugins:link --verbose`

## Phase 11: Post-Migration Cleanup Checklist

### After successful migration and testing:

**Repository updates:**

-   [ ] Update GitHub repository description
-   [ ] Update GitHub repository topics/tags (add: `sf-plugin`, `salesforce-cli`)
-   [ ] Add notice to README about v3.0 being SF-only
-   [ ] Create GitHub release for v3.0.0 with migration notes
-   [ ] Pin a GitHub issue about the migration

**Documentation:**

-   [ ] Add CHANGELOG.md entry for v3.0.0
-   [ ] Add USER_MIGRATION_GUIDE.md to repository
-   [ ] Update any wiki pages
-   [ ] Update examples in documentation

**npm package:**

-   [ ] Verify package.json metadata is correct
-   [ ] Ensure all files are included in npm package
-   [ ] Test installation from npm: `sf plugins:install etcopydatasf`
-   [ ] Verify command help is clear and helpful

**Communication:**

-   [ ] (Optional) Publish a final v2.2.0 of `etcopydata` with deprecation notice
-   [ ] Add deprecation notice to npmjs.com for old package
-   [ ] Update any blog posts or tutorials
-   [ ] Post announcement in Salesforce developer communities

**Legacy version handling:**

-   [ ] Document that v2.x (etcopydata) is frozen/deprecated
-   [ ] Add redirect/notice on old npm package page
-   [ ] Keep v2.x branch available for bug fixes only

**Testing checklist:**

-   [ ] Commands work: export, import, compare, delete, full
-   [ ] Help text is correct (`--help`)
-   [ ] Legacy config detection works
-   [ ] Error messages are helpful
-   [ ] Can coexist with v2.x
-   [ ] Works in CI/CD environments

## Phase 12: Version and Publish

1.  **Update version in package.json:**

    ```json
    {
    	"version": "3.0.0"
    }
    ```

2.  **Create CHANGELOG.md:**

    ```markdown
    # Changelog

    ## [3.0.0] - 2024-XX-XX

    ### BREAKING CHANGES

    -   Package renamed from `etcopydata` to `etcopydatasf`
    -   Commands changed from `sfdx ETCopyData:X` to `sf ETCopyDataSF X`
    -   Config file changed from `ETCopyData.json` to `ETCopyDataSF.json`
    -   Default data folder changed from `./ETCopyData` to `./ETCopyDataSF`
    -   Migrated from SFDX CLI to SF CLI

    ### Added

    -   Auto-detection of legacy `ETCopyData.json` with helpful migration message
    -   Support for SF CLI v2
    -   USER_MIGRATION_GUIDE.md with detailed migration instructions
    -   Can coexist with legacy v2.x version

    ### Changed

    -   Updated to `@salesforce/core` v7
    -   Updated to `@oclif/core` v4
    -   Migrated from `SfdxCommand` to `SfCommand`
    -   Updated flag patterns to SF style

    ### Deprecated

    -   v2.x (etcopydata) is now deprecated and will only receive security fixes

    ## [2.1.2] - Previous versions

    See git history for v2.x changelog
    ```

3.  **Generate manifest:**

    ```bash
    npm run prepack
    ```

4.  **Test packaged version:**

    ```bash
    npm pack
    sf plugins install ./etcopydatasf-3.0.0.tgz
    sf ETCopyDataSF export --help
    ```

5.  **Publish to npm:**

    ```bash
    # First verify you're publishing the right thing
    npm publish --dry-run

    # Then publish
    npm publish
    ```

6.  **Create GitHub release:**

                                                - Tag: `v3.0.0`
                                                - Title: `v3.0.0 - SF CLI Migration`
                                                - Include migration guide summary
                                                - Link to USER_MIGRATION_GUIDE.md

## Summary of Changes

### Files/Folders to Rename:

-   ✏️ `src/@ELTOROIT/ETCopyData.ts` → `ETCopyDataSF.ts`
-   ✏️ `src/commands/ETCopyData/` → `src/commands/ETCopyDataSF/` (entire folder)

### Files to Create:

-   📄 `USER_MIGRATION_GUIDE.md` - Detailed user migration instructions
-   📄 `CHANGELOG.md` - Version history and breaking changes
-   📄 `.eslintrc.json` - ESLint config for auto-migration (optional)

### Files to Modify:

-   ✏️ `package.json` - Name, dependencies, oclif config, version
-   ✏️ `src/@ELTOROIT/Settings.ts` - Config filename (line 567), default folder (line 261), add legacy detection
-   ✏️ `src/@ELTOROIT/ETCopyDataSF.ts` - Class name, imports, flags, UX, spinner messages, plugin name
-   ✏️ `src/commands/ETCopyDataSF/*.ts` (5 files) - Imports, class refs, log messages
-   ✏️ `src/index.ts` - Update exports if needed
-   ✏️ `README.md` - Everything: title, commands, config names, folder names, add migration section
-   ✏️ `@ELTOROIT/Readme.md` - Developer docs, commands, npm URL

### Files Likely Unchanged:

-   ✅ `src/@ELTOROIT/OrgManager.ts` - Connection logic
-   ✅ `src/@ELTOROIT/Exporter.ts` - Core logic
-   ✅ `src/@ELTOROIT/Importer.ts` - Core logic
-   ✅ `src/@ELTOROIT/DataAPI.ts` - API calls
-   ✅ Other business logic files

### New Commands for Users:

```bash
# Installation
sf plugins:install etcopydatasf

# Commands (note the new namespace!)
sf ETCopyDataSF export -c ./data -s MyOrg
sf ETCopyDataSF import -c ./data -d MyOrg
sf ETCopyDataSF compare -c ./data -s MyOrg -d MyOtherOrg
sf ETCopyDataSF delete -c ./data -d MyOrg
sf ETCopyDataSF full -c ./data -s MyOrg -d MyOtherOrg

# Config file is now ETCopyDataSF.json
```

### Migration Impact Summary:

-   ✅ Can coexist with v2.x (different commands, configs, folders)
-   ⚠️ Users must rename config files
-   ⚠️ Users must update all scripts/CI/CD
-   ⚠️ Breaking changes are necessary and intentional
-   ✅ Auto-detection helps users find legacy configs
-   ✅ Comprehensive migration guide provided
