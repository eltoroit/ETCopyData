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
```

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
  "rootFolder": "./ETCopyDataSF",  // Changed from "./ETCopyData"
  // ... rest of config
}
```

**Or keep using your custom folder:**
```json
{
  "rootFolder": "./@ELTOROIT/data",  // Custom folders work fine!
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

- ✅ Modern SF CLI architecture
- ✅ Better performance and reliability
- ✅ Actively maintained
- ✅ Compatible with latest Salesforce features
- ✅ Can coexist with v2.x

## Support

- GitHub Issues: https://github.com/eltoroit/ETCopyData/issues
- README: https://github.com/eltoroit/ETCopyData

## Version Compatibility

| Feature | v2.x (SFDX) | v3.x (SF) |
|---------|-------------|-----------|
| CLI | sfdx | sf |
| Commands | `ETCopyData:export` | `ETCopyDataSF export` |
| Config | ETCopyData.json | ETCopyDataSF.json |
| Default folder | ./ETCopyData | ./ETCopyDataSF |
| Org auth | `force:auth` | `org login` |
| Can coexist | N/A | ✅ Yes |

