# ETCopyDataSF - Developer Guide

## Alternative Tool

For more advanced data migration needs, consider [Salesforce Data Move Utility (SFDMU)](https://help.sfdmu.com/) - a feature-rich, actively maintained tool.

# How to Make Changes?

1. **Clone the repo:**
    ```bash
    git clone https://github.com/eltoroit/ETCopyData.git
    cd ETCopyData
    ```

2. **Install dependencies:**
    ```bash
    npm install
    ```

3. **Build the plugin:**
    ```bash
    npm run build
    ```

4. **Fix and review vulnerabilities:**
    ```bash
    npm audit fix
    npm audit
    ```

5. **Create a valid test config file:**
    - Create **@ELTOROIT/data/ETCopyDataSF.json** with your test configuration

# Other useful node tools:

-   `npmvet` - Audit npm packages
-   `ncu` - Check for package updates

# How to Test Changes

## How to Debug Your SF CLI Plug-In

Documentation: [SF CLI Plugin Development](https://developer.salesforce.com/docs/platform/salesforce-cli/overview)

### Testing an installed/linked plugin

```bash
sf ETCopyDataSF export -c "./@ELTOROIT/data" -s SourceOrg
sf ETCopyDataSF import -c "./@ELTOROIT/data" -d DestOrg
```

### Testing without installing (with debugging)

**Available Commands:**
- `ETCopyDataSF compare`
- `ETCopyDataSF delete`
- `ETCopyDataSF export`
- `ETCopyDataSF full`
- `ETCopyDataSF import`

**Debug Examples:**

```bash
# Compare
NODE_OPTIONS=--inspect-brk bin/dev ETCopyDataSF compare -c "/path/to/@ELTOROIT/data"

# Export
NODE_OPTIONS=--inspect-brk bin/dev ETCopyDataSF export -c "/path/to/@ELTOROIT/data" -s SourceOrg

# Import
NODE_OPTIONS=--inspect-brk bin/dev ETCopyDataSF import -c "/path/to/@ELTOROIT/data" -d DestOrg

# Delete
NODE_OPTIONS=--inspect-brk --trace-warnings bin/dev ETCopyDataSF delete -c "/path/to/@ELTOROIT/data" -d DestOrg

# Full migration
NODE_OPTIONS=--inspect-brk bin/dev ETCopyDataSF full -c "/path/to/@ELTOROIT/data" -s SourceOrg -d DestOrg
```

# How to Install Plugin

## Uninstall old versions

```bash
# Uninstall v2.x (SFDX)
npm uninstall -g etcopydata

# Uninstall v3.x (SF)
sf plugins:uninstall etcopydatasf
```

## Install different versions

**Link local code for development:**
```bash
sf plugins:link --verbose
```

**Install released version:**
```bash
sf plugins:install etcopydatasf
```

**Install beta version:**
```bash
sf plugins:install etcopydatasf@beta
```

**Install specific version:**
```bash
sf plugins:install etcopydatasf@3.0.0
```

## Validate which version is being used

```bash
sf plugins
```

You should see output like:
- `etcopydatasf 3.0.0 (beta)`
- `etcopydatasf 3.0.0 (link) /FULL_PATH/ETCopyData`
- `etcopydatasf 3.0.0`

# How to publish to npm?

Plugin can be found here: https://www.npmjs.com/package/etcopydatasf/

1. **Update version number** in `package.json`
2. **Test thoroughly** before publishing
3. **Publish beta version:**
   ```bash
   npm publish ./ --tag beta
   ```
4. **Publish production version:**
   ```bash
   npm publish ./
   ```
5. **Create GitHub release:**
   - Tag: `v3.x.x`
   - Include release notes
6. **Commit and push to GitHub**

# Compile and Link

```bash
# Clean and rebuild
rm -rf node_modules lib
npm install
npm run build

# Generate manifest and README
npm run prepack

# Link for local testing
sf plugins:link --verbose
```

# Proxy (Charles) for Debugging

## Setting up Charles

1. **Install Charles Root Certificate:**
   - Help > SSL Proxying > Install Charles Root Certificate

2. **Configure SSL Proxying:**
   - Proxy > SSL Proxying Settings > SSL Proxying > Include
   - Add: `*.salesforce.com`

3. **Configure Proxy Port:**
   - Proxy > Proxy Settings > HTTP Proxy > Port: 8888

## Using the Proxy

```bash
HTTP_PROXY=http://127.0.0.1:8888 NODE_TLS_REJECT_UNAUTHORIZED=0 \
  bin/dev ETCopyDataSF delete -c '/path/to/@ELTOROIT/data' -d DestOrg
```

**Note:** `NODE_TLS_REJECT_UNAUTHORIZED=0` avoids "self signed certificate in certificate chain" errors.

# Troubleshooting

## ESM Module Warning

If you see warnings about ESM modules when linking:
```
Warning: etcopydatasf is a linked ESM module and cannot be auto-transpiled
```

This is expected and not an error. The plugin will use the compiled source from the `lib` directory.

## Build Errors

If you encounter build errors:
1. Clean everything: `rm -rf node_modules lib`
2. Reinstall: `npm install`
3. Rebuild: `npm run build`

## TypeScript Errors

- Make sure all `.js` extensions are included in relative imports (ESM requirement)
- Check `tsconfig.json` has `"module": "node16"` and `"moduleResolution": "node16"`
