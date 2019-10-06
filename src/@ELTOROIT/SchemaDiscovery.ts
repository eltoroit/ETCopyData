import { DescribeGlobalSObjectResult } from "jsforce";
import { ISchemaData } from "./Interfaces";
import { OrgManager } from "./OrgManager";
import { LogLevel, Util } from "./Util";

enum RejectType {
  ADD_SOBJECT,
  ADD_FIELD,
  ADD_CHILD,
  SOBJ_MISMATCH,
  FIELD_MISMATCH
}

export class SchemaDiscovery {
  private allRejects = {};
  private orgManager: OrgManager;
  private allFields: Map<string, string[]> = null;
  private privSObjects: Map<string, ISchemaData> = null;

  constructor(orgManager: OrgManager) {
    this.orgManager = orgManager;
  }

  // FIXME: V2.0 - This should be called async and work with a promise, but a lot of code could break :-)
  public getSObjects(): Map<string, ISchemaData> {
    if (this.privSObjects === null) {
      let msg = "";
      msg += "CODE ERROR (sorry). ";
      msg += "The map of objects needs to be initialized before this was called";
      Util.writeLog(msg, LogLevel.FATAL);
      Util.throwError(msg);
    }

    return this.privSObjects;
  }

  // FIXME: V2.0 - This should be called async and work with a promise, but a lot of code could break :-)
  public getFields(sObjName: string): string[] {
    if (this.privSObjects === null) {
      let msg = "";
      msg += "CODE ERROR (sorry). ";
      msg += "The map of objects needs to be initialized before this was called";
      Util.writeLog(msg, LogLevel.FATAL);
      Util.throwError(msg);
    }

    return this.privSObjects.get(sObjName).fields;
  }

  public findObjectsAsync(): Promise<Map<string, ISchemaData>> {
    return new Promise((resolve, reject) => {
      if (this.privSObjects !== null) {
        resolve();
      }

      this.privSObjects = new Map<string, ISchemaData>();
      this.orgManager.conn
        .describeGlobal()
        .then((value: any) => {
          // Clean the data
          this.resetData();
          const allSObjectNames: string[] = [];

          // find objects and select the ones we are working with
          value.sobjects.forEach((sObj: DescribeGlobalSObjectResult) => {
            this.allFields.set(sObj.name, []);
            allSObjectNames.push(sObj.name);
            this.addSObject(sObj);
          });

          // Report on any sObject requested which is not in the Org.
          this.orgManager.settings.getRequestedSObjectNames(false).forEach((requestedObject: string) => {
            if (!allSObjectNames.includes(requestedObject)) {
              reject("Requested sObject [" + requestedObject + "] was not found in the Org");
            }
          });

          // Get addtional information about each valid object (in parallel)
          const promises = [];

          this.privSObjects.forEach(sObj => {
            promises.push(this.processSObjectValues(sObj.name));
          });

          Promise.all(promises)
            .then(() => {
              resolve(this.privSObjects);
            })
            .catch(err => {
              Util.throwError(err);
            });
        })
        .catch(err => {
          Util.throwError(err);
        });
    });
  }

  public discardSObject(sObjName: string) {
    if (this.privSObjects.has(sObjName)) {
      this.privSObjects.delete(sObjName);
      const msg = `[${this.orgManager.alias}] SObject [${sObjName}] ignored because Org mismatch`;
      this.allRejects[RejectType[RejectType.SOBJ_MISMATCH]][sObjName] = msg;
      Util.writeLog(msg, LogLevel.INFO);
    }
  }

  public discardFields(sObjName: string, fieldNamesToRemove: string[]) {
    if (this.privSObjects.has(sObjName)) {
      const sObj: ISchemaData = this.privSObjects.get(sObjName);

      const msgs = [];
      sObj.fields = sObj.fields.filter((fieldName: string) => {
        const isGood = !fieldNamesToRemove.includes(fieldName);
        if (!isGood) {
          let msg = "";
          msg = `[${this.orgManager.alias}] Field [${sObjName + "." + fieldName}] ignored because Org mismatch`;
          msgs.push(msg);
          Util.writeLog(msg, LogLevel.TRACE);
        }
        return isGood;
      });
      this.allRejects[RejectType[RejectType.FIELD_MISMATCH]][sObjName] = msgs;
    }
  }

  public writeInfo(): Promise<void> {
    const output: any = {};

    // VERBOSE:  Timestamp for testing
    output.now = new Date();

    // Which Org?
    output.alias = this.orgManager.alias;

    // Import order
    output.importOrder = this.orgManager.order.findImportOrder();

    // Metadata
    output.metadata = this.orgManager.coreMD.forPrint();

    // SObjects
    output.sObjects = {};
    this.privSObjects.forEach((sObj, key) => {
      sObj.fields.sort();
      // LEARNING: [ARRAY]: Sorting by a field in an object.
      sObj.parents.sort((a, b) => {
        const x = a.sObj;
        const y = b.sObj;
        return x < y ? -1 : x > y ? 1 : 0;
      });
      sObj.children.sort((a, b) => {
        const x = a.sObj + "." + a.parentId;
        const y = b.sObj + "." + b.parentId;
        return x < y ? -1 : x > y ? 1 : 0;
      });
      output.sObjects[key] = sObj;
    });

    // VERBOSE: Output all sObject/fields
    output.allFields = {};
    this.allFields.forEach((value, key) => {
      value.sort();
      output.allFields[key] = value;
    });

    // VERBOSE: Output rejected reasons
    output.rejected = this.allRejects;

    // Write the output
    return this.orgManager.settings.writeToFile(this.orgManager.alias, "org.json", output);
  }

  private resetData(): void {
    this.allFields = new Map<string, string[]>();
    this.privSObjects = new Map<string, ISchemaData>();

    this.allRejects = {};
    this.allRejects[RejectType[RejectType.ADD_FIELD]] = {};
    this.allRejects[RejectType[RejectType.ADD_CHILD]] = {};
    this.allRejects[RejectType[RejectType.ADD_SOBJECT]] = {};
    this.allRejects[RejectType[RejectType.SOBJ_MISMATCH]] = {};
    this.allRejects[RejectType[RejectType.FIELD_MISMATCH]] = {};
  }

  private processSObjectValues(sObjName: string): Promise<object> {
    return new Promise((resolve, reject) => {
      const url = this.privSObjects.get(sObjName).describeUrl;
      this.orgManager.conn
        .request(url)
        .then(res => {
          this.processFields(res, sObjName);
          this.processChildren(res, sObjName);
          resolve(res);
        })
        .catch(err => {
          Util.throwError(err);
        });
    });
  }

  private processFields(res, sObjName: string) {
    const sObj: ISchemaData = this.privSObjects.get(sObjName);

    sObj.fields = [];
    res.fields.forEach(field => {
      this.allFields.get(sObj.name).push(field.name);

      this.addField(sObj, sObjName, field);
    });
  }

  private processChildren(res, sObjName: string) {
    const sObj: ISchemaData = this.privSObjects.get(sObjName);
    sObj.children = [];
    res.childRelationships.forEach(child => {
      this.addChild(sObj, sObjName, child);
    });
  }

  private addSObject(sObj: DescribeGlobalSObjectResult): void {
    if (this.orgManager.coreMD.isMD(sObj.name)) {
      this.orgManager.coreMD.setValues(sObj);
    } else {
      //   // Helps find the desired sObject
      //   console.log(sObj.name);
      //   if (sObj.name === "PricebookEntry") {
      //     debugger;
      //   }

      const localRejects: string[] = [];

      // Can't be
      if (sObj.customSetting) {
        localRejects.push("Can't be Custom setting");
      }
      if (sObj.deprecatedAndHidden) {
        localRejects.push("Can't be Deprecated and hidden");
      }

      // Must be
      if (!sObj.createable) {
        localRejects.push("Must be createable");
      }
      if (!sObj.deletable) {
        localRejects.push("Must be deletable");
      }
      if (!sObj.queryable) {
        localRejects.push("Must be queryable");
      }
      if (!sObj.replicateable) {
        localRejects.push("Must be replicateable");
      }
      if (!sObj.retrieveable) {
        localRejects.push("Must be retrieveable");
      }
      // if (!sObj.searchable) {
      // 	localRejects.push("Must be searchable");
      // }
      // if (!sObj.undeletable) {
      //   localRejects.push("Must be undeletable");
      // }
      if (!sObj.updateable) {
        localRejects.push("Must be updateable");
      }
      if (!this.orgManager.settings.getRequestedSObjectNames(false).includes(sObj.name)) {
        localRejects.push("Was Not requested");
      }

      if (this.overrideIncludeSobject(sObj) || localRejects.length === 0) {
        this.privSObjects.set(sObj.name, {
          children: [],
          describeUrl: sObj.urls.describe,
          fields: [],
          keyPrefix: sObj.keyPrefix,
          label: sObj.label,
          name: sObj.name,
          orderBy: null,
          parents: [],
          twoPassParents: [],
          parentsRequired: []
        });
        Util.writeLog(`[${this.orgManager.alias}] Found sObject [${sObj.name}].`, LogLevel.TRACE);
      } else {
        this.allRejects[RejectType[RejectType.ADD_SOBJECT]][sObj.name] = localRejects;
      }
    }
  }

  private addField(sObj: ISchemaData, sObjName, field): void {
    const localRejects: string[] = [];
    const sObjectData = this.orgManager.settings.getSObjectData(sObjName);

    // Can't be
    if (field.autoNumber) {
      localRejects.push("Can't be autoNumber");
    }
    if (field.calculated) {
      localRejects.push("Can't be calculated");
    }
    if (field.deprecatedAndHidden) {
      localRejects.push("Can't be deprecatedAndHidden");
    }
    if (sObjectData.ignoreFields.includes(field.name)) {
      localRejects.push("User asked for this field to be excluded");
    }

    // Must be
    if (!field.createable) {
      localRejects.push("Must be createable");
    }
    // if (!field.updateable)
    // 	localRejects.push('Not updateable')

    // Check reference
    if (field.type === "reference") {
      if (field.referenceTo.length === 1) {
        if (this.privSObjects.has(field.referenceTo[0]) || this.orgManager.coreMD.isMD(field.referenceTo[0])) {
          // Include it...
        } else {
          localRejects.push("Parent sObject [" + field.referenceTo[0] + "] is not processed");
        }
        if (sObjName === field.referenceTo[0] && !sObjectData.twoPassReferenceFields.includes(field.name)) {
          localRejects.push("Recursive parenting for field references is supported, but requires the field to be configured as twoPassReferenceField");
        }
      } else {
        let msg: string = "Reference, but it points to 0 or more than 1 sObject: | ";
        field.referenceTo.forEach(element => {
          msg += element + " | ";
        });
        localRejects.push(msg);
      }
    } else {
      if (sObjectData.twoPassReferenceFields.includes(field.name)) {
        localRejects.push("Field [" + field.referenceTo[0] + "] is configured as twoPassReferenceField but is not a reference");
      }
    }

    if (this.overrideIncludeField(field.name) || localRejects.length === 0) {
      if (field.type === "reference") {
        if (sObjectData.twoPassReferenceFields.includes(field.name)) {
          sObj.twoPassParents.push({
            parentId: field.name,
            sObj: field.referenceTo[0]
          });
        } else {
          sObj.parents.push({
            parentId: field.name,
            sObj: field.referenceTo[0]
          });
        }
      }
      sObj.fields.push(field.name);
    } else {
      this.allRejects[RejectType[RejectType.ADD_FIELD]][sObjName + "." + field.name] = localRejects;
    }
  }

  private addChild(sObj: ISchemaData, sObjName, child): void {
    const localRejects: string[] = [];

    // Can't be
    if (child.deprecatedAndHidden) {
      localRejects.push("Can't be deprecatedAndHidden");
    }
    if (sObjName === child.childSObject) {
      localRejects.push("Current version does not allow recursive parenting for parent-child relations");
    }

    // Must be
    if (!this.privSObjects.has(child.childSObject)) {
      localRejects.push("Child sObject [" + child.childSObject + "] is not processed");
    }

    if (this.overrideIncludeChild(child.childSObject) || localRejects.length === 0) {
      sObj.children.push({
        children: child.relationshipName,
        parentId: child.field,
        sObj: child.childSObject
      });
    } else {
      this.allRejects[RejectType[RejectType.ADD_CHILD]][sObjName + "." + child.relationshipName + " => " + child.childSObject] = localRejects;
    }
  }

  private overrideIncludeSobject(sObj: DescribeGlobalSObjectResult): boolean {
    if (this.orgManager.settings.includeAllCustom && sObj.custom) {
      return true;
    }
    return false;
  }

  private overrideIncludeField(fieldName: string): boolean {
    const alwaysFields: string[] = ["Id"];
    if (alwaysFields.includes(fieldName)) {
      return true;
    }
    return false;
  }

  private overrideIncludeChild(sObjName: string): boolean {
    return false;
  }
}
