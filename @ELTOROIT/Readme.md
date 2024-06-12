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

# Other useful node tools:

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

-   Commands

    -   ETCopyData:compare
    -   ETCopyData:delete
    -   ETCopyData:export
    -   ETCopyData:full
    -   ETCopyData:import

-   `NODE_OPTIONS=--inspect-brk bin/dev ETCopyData:compare -c "/Users/aperez/GitProjects/current/MyScratchOrg/@ELTOROIT/data" --loglevel trace --json`
-   `NODE_OPTIONS=--inspect-brk bin/dev ETCopyData:export -c "/Users/aperez/GitProjects/current/TandC/RelatedCourses/@ELTOROIT/data" --loglevel trace --json`
-   `NODE_OPTIONS=--inspect-brk bin/dev ETCopyData:import --configfolder "/Users/aperez/Git Projects/current/ARC101/2024/SalesforceORG_OData/@ELTOROIT/data" --loglevel trace --json --orgsource "soODataSource" --orgdestination "thODataSource"`

# How to Install Plugin

-   Uninstall the old one first:
    -   `sfdx plugins:uninstall etcopydata`

## Install different versions

-   Link the code without installing it:
    -   `sfdx plugins:link --verbose`
-   Released:
    -   `echo 'y' | sfdx plugins:install etcopydata`
-   Beta:
    -   `echo 'y' | sfdx plugins:install etcopydata@beta`
-   Specific version:
    -   `echo 'y' | sfdx plugins:install etcopydata@0.5.1`

## Validate which version is being used

-   Execute:
    -   `sfdx plugins`
    -   It Should indicate the version like this:
        -   etcopydata 0.5.6 (beta)
        -   etcopydata 0.5.7 (link) /<FULL_PATH>/ETCopyData
        -   etcopydata 0.5.8

# How to publish to npm?

Plugin can be found here: https://www.npmjs.com/package/etcopydata/

-   Update version number in the **package.json** file.
-   No need to comit (yet)
-   Publish a beta package
    -   `npm publish ./ --tag beta`
-   Publish a production package
    -   `npm publish ./`
-   Commit to repo and push to Github

# Compile

-   rm -r node_modules
-   npm install
-   npm run build
-   npm run prepack
-   sfdx plugins:link --verbose

# Proxy (Charles)

-   Setting up charles
    -   Help > SSL Proxying > Install Charles Root Certificate
    -   Proxy > SSL Proxying Settings > SSL Proxying > include
        -   \*.salesforce.com
    -   Proxy > Proxy Settings > HTTP Proxy > Port: 8888
-   Setting the proxy
    -   `HTTP_PROXY=http://127.0.0.1:8888 NODE_TLS_REJECT_UNAUTHORIZED=0 bin/dev ETCopyData:delete -c '/Users/aperez/DO NOT BACKUP/GitProjects/ETCopyData/TesterOrg/@ELTOROIT/data' --loglevel trace --json`
        -   NODE_TLS_REJECT_UNAUTHORIZED=0
            -   Avoids this error: Error: self signed certificate in certificate chain
