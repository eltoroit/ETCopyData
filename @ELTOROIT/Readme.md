# How to Debug Your Salesforce CLI Plug-In

https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_plugins.meta/sfdx_cli_plugins/cli_plugins_debug.htm

sfdx ETCopyData:export -c "./@ELTOROIT/data" --loglevel trace --json --dev-suspend
sfdx ETCopyData:import -c "./@ELTOROIT/data" --loglevel trace --json --dev-suspend

NODE_OPTIONS=--inspect-brk bin/run ETCopyData:export -c "./@ELTOROIT/data" --loglevel trace --json
NODE_OPTIONS=--inspect-brk bin/run ETCopyData:import -c "./@ELTOROIT/data" --loglevel trace --json

# How to Make Changes?

1. Clone the repo `git clone https://github.com/eltoroit/ETCopyData.git`
2. Open Terminal window
3. Intall the dependency modules `npm install`
4. Fix vulnerabilities `npm audit fix`
5. Review vulnerabilities `npm audit`
6. Create a valid `@ELTOROIT/data/ETCopyData.json` file
