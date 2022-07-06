# ETCopyData

SFDX Plugin to populate your scratch org and/or developer sandbox with data for multiple related sObjects.

[![Version](https://img.shields.io/npm/v/ETCopyData.svg)](https://npmjs.org/package/ETCopyData)
[![CircleCI](https://circleci.com/gh/eltoroit/ETCopyData/tree/master.svg?style=shield)](https://circleci.com/gh/eltoroit/ETCopyData/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/eltoroit/ETCopyData?branch=master&svg=true)](https://ci.appveyor.com/project/heroku/ETCopyData/branch/master)
[![Greenkeeper](https://badges.greenkeeper.io/eltoroit/ETCopyData.svg)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/eltoroit/ETCopyData/badge.svg)](https://snyk.io/test/github/eltoroit/ETCopyData)
[![Downloads/week](https://img.shields.io/npm/dw/ETCopyData.svg)](https://npmjs.org/package/ETCopyData)
[![License](https://img.shields.io/npm/l/ETCopyData.svg)](https://github.com/eltoroit/ETCopyData/blob/master/package.json)

<!-- toc -->
* [ETCopyData](#etcopydata)
* [Debugging your plugin](#debugging-your-plugin)
<!-- tocstop -->
  <!-- install -->
  <!-- usage -->
```sh-session
$ npm install -g etcopydata
$ sfdx COMMAND
running command...
$ sfdx (-v|--version|version)
etcopydata/0.7.0-Beta darwin-x64 node-v16.15.1
$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
...
```
<!-- usagestop -->
<!-- commands -->
* [`sfdx ETCopyData:Compare [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-etcopydatacompare--c-string--d-string--s-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx ETCopyData:delete [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-etcopydatadelete--c-string--d-string--s-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx ETCopyData:export [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-etcopydataexport--c-string--d-string--s-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx ETCopyData:full [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-etcopydatafull--c-string--d-string--s-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx ETCopyData:import [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-etcopydataimport--c-string--d-string--s-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx ETCopyData:Compare [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Checks the source and destination org for any differences in the sObject's metadata, this helps determine what data can be properly exported/imported.

```
USAGE
  $ sfdx ETCopyData:Compare [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --configfolder=PATH                                                           Root folder to find the
                                                                                    configuration file

  -d, --orgdestination=(alias|username)                                             SFDX alias or username for the
                                                                                    DESTINATION org

  -s, --orgsource=(alias|username)                                                  SFDX alias or username for the
                                                                                    SOURCE org

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/ETCopyData/Compare.ts](https://github.com/eltoroit/ETCopyData/blob/v0.7.0-Beta/src/commands/ETCopyData/Compare.ts)_

## `sfdx ETCopyData:delete [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Deletes data from destination org, preparing for the new data that will be uploaded. Note: Deleting optionally happens before loading, but if there are some errors this operation can be retried by itself.

```
USAGE
  $ sfdx ETCopyData:delete [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --configfolder=PATH                                                           Root folder to find the
                                                                                    configuration file

  -d, --orgdestination=(alias|username)                                             SFDX alias or username for the
                                                                                    DESTINATION org

  -s, --orgsource=(alias|username)                                                  SFDX alias or username for the
                                                                                    SOURCE org

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/ETCopyData/delete.ts](https://github.com/eltoroit/ETCopyData/blob/v0.7.0-Beta/src/commands/ETCopyData/delete.ts)_

## `sfdx ETCopyData:export [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Exports the data from the source org, and saves it in the destination folder so that it can be imported at a later time.

```
USAGE
  $ sfdx ETCopyData:export [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --configfolder=PATH                                                           Root folder to find the
                                                                                    configuration file

  -d, --orgdestination=(alias|username)                                             SFDX alias or username for the
                                                                                    DESTINATION org

  -s, --orgsource=(alias|username)                                                  SFDX alias or username for the
                                                                                    SOURCE org

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/ETCopyData/export.ts](https://github.com/eltoroit/ETCopyData/blob/v0.7.0-Beta/src/commands/ETCopyData/export.ts)_

## `sfdx ETCopyData:full [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Performs all the steps, including comparing schemas, exporting data from the source, optionally deleting data from the destination, and importing the data to the destination org. This may help you when setting up a new process

```
USAGE
  $ sfdx ETCopyData:full [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --configfolder=PATH                                                           Root folder to find the
                                                                                    configuration file

  -d, --orgdestination=(alias|username)                                             SFDX alias or username for the
                                                                                    DESTINATION org

  -s, --orgsource=(alias|username)                                                  SFDX alias or username for the
                                                                                    SOURCE org

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/ETCopyData/full.ts](https://github.com/eltoroit/ETCopyData/blob/v0.7.0-Beta/src/commands/ETCopyData/full.ts)_

## `sfdx ETCopyData:import [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Imports data into destination org, you can control if the data in the destination sObjects should be removed before loading a new data set. The data load happens in a specific order (children first, parents last) which has been determined by checking the schema in the destination org.

```
USAGE
  $ sfdx ETCopyData:import [-c <string>] [-d <string>] [-s <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --configfolder=PATH                                                           Root folder to find the
                                                                                    configuration file

  -d, --orgdestination=(alias|username)                                             SFDX alias or username for the
                                                                                    DESTINATION org

  -s, --orgsource=(alias|username)                                                  SFDX alias or username for the
                                                                                    SOURCE org

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/ETCopyData/import.ts](https://github.com/eltoroit/ETCopyData/blob/v0.7.0-Beta/src/commands/ETCopyData/import.ts)_
<!-- commandsstop -->
<!-- debugging-your-plugin -->

# Debugging your plugin

We recommend using the Visual Studio Code (VS Code) IDE for your plugin development. Included in the `.vscode` directory of this plugin is a `launch.json` config file, which allows you to attach a debugger to the node process when running your commands.

To debug the `hello:org` command:

1. Start the inspector

If you linked your plugin to the sfdx cli, call your command with the `dev-suspend` switch:

```sh-session
$ sfdx hello:org -u myOrg@example.com --dev-suspend
```

Alternatively, to call your command using the `bin/run` script, set the `NODE_OPTIONS` environment variable to `--inspect-brk` when starting the debugger:

```sh-session
$ NODE_OPTIONS=--inspect-brk bin/run hello:org -u myOrg@example.com
```

2. Set some breakpoints in your command code
3. Click on the Debug icon in the Activity Bar on the side of VS Code to open up the Debug view.
4. In the upper left hand corner of VS Code, verify that the "Attach to Remote" launch configuration has been chosen.
5. Hit the green play button to the left of the "Attach to Remote" launch configuration window. The debugger should now be suspended on the first line of the program.
6. Hit the green play button at the top middle of VS Code (this play button will be to the right of the play button that you clicked in step #5).
   <br><img src=".images/vscodeScreenshot.png" width="480" height="278"><br>
   Congrats, you are debugging!
