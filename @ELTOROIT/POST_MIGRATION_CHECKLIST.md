# Post-Migration Checklist for ETCopyDataSF v3.0.0

## ✅ Completed Tasks

### Code Migration
- [x] Updated package name from `etcopydata` to `etcopydatasf`
- [x] Renamed all classes from `ETCopyData` to `ETCopyDataSF`
- [x] Updated command namespace from `ETCopyData:` to `ETCopyDataSF `
- [x] Changed config file from `ETCopyData.json` to `ETCopyDataSF.json`
- [x] Changed default folder from `./ETCopyData` to `./ETCopyDataSF`
- [x] Migrated from `@salesforce/command` to `@salesforce/sf-plugins-core`
- [x] Updated dependencies to latest versions (@salesforce/core v8, @oclif/core v4)
- [x] Converted project to ESM with proper .js extensions
- [x] Fixed all TypeScript compilation errors
- [x] Successfully built and linked plugin

### Documentation
- [x] Created `USER_MIGRATION_GUIDE.md` for end users
- [x] Updated `CHANGELOG.md` with v3.0.0 changes
- [x] Updated `README.md` with new commands and migration info
- [x] Removed deprecation notice from README
- [x] Updated `@ELTOROIT/Readme.md` for developers
- [x] Added legacy config detection with helpful warnings

### Testing
- [x] Plugin builds without errors
- [x] Plugin links successfully to SF CLI
- [x] All commands show correct help text
- [x] Commands are properly namespaced as `sf ETCopyDataSF <command>`

## 📋 Before Publishing

### Testing (Recommended)
- [ ] Test actual data export from a source org
- [ ] Test actual data import to a destination org
- [ ] Test the compare command with two orgs
- [ ] Test the delete command
- [ ] Test the full migration workflow
- [ ] Verify legacy config detection works correctly
- [ ] Test on different operating systems (macOS, Linux, Windows)

### Quality Assurance
- [ ] Run linter: `npm run lint`
- [ ] Fix any linting issues
- [ ] Run tests if available: `npm test`
- [ ] Check for security vulnerabilities: `npm audit`

### Version Management
- [ ] Verify version in `package.json` is set to `3.0.0`
- [ ] Ensure `CHANGELOG.md` has complete v3.0.0 entry
- [ ] Tag commit in git: `git tag v3.0.0`

### Documentation Review
- [ ] Review README.md for accuracy
- [ ] Review USER_MIGRATION_GUIDE.md for completeness
- [ ] Ensure all command examples work
- [ ] Check that all file paths are correct

## 🚀 Publishing Steps

### 1. Prepare for Release
```bash
# Ensure everything is committed
git status

# Clean and rebuild
rm -rf node_modules lib
npm install
npm run build
npm run prepack

# Test locally
sf plugins:link --verbose
sf ETCopyDataSF --help
```

### 2. Publish to npm
```bash
# Publish beta first (recommended for major version)
npm publish ./ --tag beta

# Install and test beta
sf plugins:install etcopydatasf@beta
sf ETCopyDataSF export --help

# If beta works, publish production
npm publish ./
```

### 3. Create GitHub Release
- [ ] Go to https://github.com/eltoroit/ETCopyData/releases
- [ ] Click "Create a new release"
- [ ] Tag: `v3.0.0`
- [ ] Title: `v3.0.0 - SF CLI Migration`
- [ ] Description: Include highlights from CHANGELOG.md
- [ ] Attach `USER_MIGRATION_GUIDE.md` link
- [ ] Publish release

### 4. Commit and Push
```bash
git add .
git commit -m "Release v3.0.0 - SF CLI migration"
git push origin main
git push origin v3.0.0
```

### 5. Update Repository Settings
- [ ] Update GitHub repository description to mention SF CLI
- [ ] Update repository topics: add `sf-plugin`, `salesforce-cli`
- [ ] Update any pinned issues or discussions

### 6. Announce Release (Optional)
- [ ] Post in Salesforce Developer Forums
- [ ] Update any blog posts or tutorials
- [ ] Notify users through GitHub Discussions

## 🔧 Known TODOs for Future

These items were marked as TODOs in the code for future enhancement:

1. **Spinner Implementation**: Update spinner usage for SF CLI
   - Files: `src/@ELTOROIT/ETCopyDataSF.ts`
   - Current: Simple log messages
   - Future: Use `ux.spinner` for better UX

2. **User Prompts**: Implement proper user confirmation prompts
   - Files: `src/@ELTOROIT/ETCopyDataSF.ts` (PromptUserYN method)
   - Current: Auto-rejects with error
   - Future: Use SF CLI prompt API

3. **Bulk API**: Verify bulk API compatibility
   - Files: `src/@ELTOROIT/DataAPI.ts`
   - Current: Cast to `any` to bypass type errors
   - Future: Update to proper bulk API v2 if needed

4. **ConfigFile.write()**: Check ConfigFile write signature
   - Files: `src/@ELTOROIT/Settings.ts`
   - Current: Workaround with Object.assign
   - Future: Use proper API once confirmed

5. **Table Display**: Update log table display
   - Files: `src/@ELTOROIT/Util.ts`
   - Current: JSON.stringify
   - Future: Use `ux.table()` for better formatting

## 📝 Notes

- **ESM Warning**: The "ESM module cannot be auto-transpiled" warning when linking is expected and not an error
- **Coexistence**: v2.x and v3.x can coexist on the same machine
- **Breaking Changes**: This is a major version (v3.0.0) with intentional breaking changes
- **Alternative Tool**: SFDMU is recommended for users needing more advanced features

## ✅ Migration Complete!

Once all the "Before Publishing" items are checked, the plugin is ready for release. The core migration work is complete and functional.

