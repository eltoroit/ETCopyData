# How to Make Changes?

1. Clone the repo
    - `git clone https://github.com/eltoroit/ETCopyData.git`
2. Open Terminal window
3. Intall the dependency modules
    - `npm install`
4. Fix vulnerabilities
    - `npm audit fix`
5. Review vulnerabilities
    - `npm audit`
6. Create a valid **@ELTOROIT/data/ETCopyData.json** file

Other useful node tools:

-   npmvet
-   ncu

# How to Test Changes

## How to Debug Your Salesforce CLI Plug-In

Documentation page explaining process:
https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_plugins.meta/sfdx_cli_plugins/cli_plugins_debug.htm

### Testing an installed plugin

-   `sfdx ETCopyData:export -c "./@ELTOROIT/data" --loglevel trace --json --dev-suspend`
-   `sfdx ETCopyData:import -c "./@ELTOROIT/data" --loglevel trace --json --dev-suspend`

### Testing without installing it

-   `NODE_OPTIONS=--inspect-brk bin/run ETCopyData:export -c "./@ELTOROIT/data" --loglevel trace --json`
-   `NODE_OPTIONS=--inspect-brk bin/run ETCopyData:import -c "./@ELTOROIT/data" --loglevel trace --json`
-   `NODE_OPTIONS=--inspect-brk bin/run ETCopyData:export -c "/Users/aperez/DO NOT BACKUP/GitProjects/Content Recommendation/COE2/@ELTOROIT/data" --loglevel trace --json`

# How to Install Plugin

-   Uninstall the old one first:
    -   `sfdx plugins:uninstall etcopydata`

## Install different versions

-   Link the code without installing it:
    -   `sfdx plugins:link -v`
-   Released:
    -   `echo 'y' | sfdx plugins:install etcopydata`
-   Beta:
    -   `echo 'y' | sfdx plugins:install etcopydata@beta`
-   Specific version:
    -   `echo 'y' | sfdx plugins:install etcopydata@0.5.1`

## Validate which version is being used

-   Execute:
    -   `sfdx plugins`

Should indicate the version like this:

-   etcopydata 0.5.6 (beta)
-   etcopydata 0.5.7 (link) /<FULL_PATH>/ETCopyData
-   etcopydata 0.5.8

# How to publish to npm?

Plugin can be found here: https://www.npmjs.com/package/etcopydata/

-   Update version number in the **package.json** file.
-   Commit to repo and puh to Github
-   Publish a beta package
    -   `npm publish ./ --tag beta`
-   Publish a production package
    -   `npm publish ./`

# Compile

-   npm install
-   clear && rm -r node_modules && npm install
-   clear && npm run prepare && yarn run prepare
-   clear && sfdx plugins:link -v
-   clear && npm publish ./ --tag beta
