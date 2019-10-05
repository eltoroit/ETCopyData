This folder contains an integration test for self and circular references

To run the test run the following commands:

cd sfdx-project

# create source org
sfdx force:org:create -v <devhub> -a etcopydata-src -f config/project-scratch-def.json
sfdx force:source:push -u etcopydata-src
sfdx force:user:permset:assign -n Custom_Objects -u etcopydata-src

# create destination org
sfdx force:org:create -v <devhub> -a etcopydata-dest -f config/project-scratch-def.json
sfdx force:source:push -u etcopydata-dest
sfdx force:user:permset:assign -n Custom_Objects -u etcopydata-dest

# create source data
cd ..
./createTestData.sh -u etcopydata-src

# run ETCopyData
sfdx ETCopyData:full -s etcopydata-src -d etcopydata-dest -c .

# validate result
./validateTestData.sh -u etcopydata-dest