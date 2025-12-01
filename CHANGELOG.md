# Changelog

## [3.0.0] - 2025-12-01

### BREAKING CHANGES

- Package renamed from `etcopydata` to `etcopydatasf`
- Commands changed from `sfdx ETCopyData:X` to `sf ETCopyDataSF X`
- Config file changed from `ETCopyData.json` to `ETCopyDataSF.json`
- Default data folder changed from `./ETCopyData` to `./ETCopyDataSF`
- Migrated from SFDX CLI to SF CLI

### Added

- Auto-detection of legacy `ETCopyData.json` with helpful migration message
- Support for SF CLI v2
- USER_MIGRATION_GUIDE.md with detailed migration instructions
- Can coexist with legacy v2.x version

### Changed

- Updated to `@salesforce/core` v8
- Updated to `@oclif/core` v4
- Migrated from `SfdxCommand` to `SfCommand`
- Updated flag patterns to SF style
- Minimum Node.js version now 18.0.0

### Deprecated

- v2.x (etcopydata) is now deprecated and will only receive security fixes

## [2.1.2] - Previous versions

See git history for v2.x changelog
