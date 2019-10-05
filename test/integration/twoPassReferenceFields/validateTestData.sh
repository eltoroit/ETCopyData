#!/bin/bash

USER=''
SCRIPTDIR=`dirname "$0"`

printHelp () {
    echo "Usage: validateTestData -u <user/alias>"
}

while getopts "h?u:d" opt; do
    case "$opt" in
    h|\?)
        printHelp
        exit 0
        ;;
    u)  USER=$OPTARG
        ;;
    d)  set -x
        ;;
    esac
done

if [ -z "$USER" ]; then
    echo "Parameter -u missing or empty"
    printHelp
    exit 1
fi

sfdx force:apex:execute -u $USER -f $SCRIPTDIR/validateTestData.apex