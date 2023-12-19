#!/usr/bin/env node

const { validateOpenRPCDocument, dereferenceDocument } = require("@open-rpc/schema-utils-js");
const fs = require('fs-extra');

async function runValidation() {
    try {
        // Combine schemas and validate with open-rpc tools
        const fullSchema = await build();

        // Validate fullSchema dereference
        const dereffedDocument = await dereferenceDocument(fullSchema);
        console.log('dereference ok');

        const errors = validateOpenRPCDocument(fullSchema);
        if (errors === true) {
            console.log("Ok!")
        } else {
            console.error(errors.name)
            console.error(errors.message)
        }

    }
    catch (exn) {
        console.error(exn && exn.message)
    }
}

let globCombiner;
var deep_value = function(obj, path){
    for (var i=0, path=path.split('/'), len=path.length; i<len; i++){
        obj = obj[path[i]];
    };
    return obj;
};
const getObjectValueOfKey = (obj, key, path, parent, cnt) => {
    const keys = Object.keys(obj);
    for (let currKey of keys) {
      if (typeof obj[currKey] === "object") {
        if(path && path.split('/').length > 40){
            throw Error(`Infinite loop inside schema - PATH: ${path}`);
        }
        getObjectValueOfKey(obj[currKey], key, path ? `${path}/${currKey}`:`${currKey}`, obj, cnt);
      }
      if (currKey === key) {
        ++cnt.count;
        // Found $ref, substitute for definition
        const substitute = deep_value(globCombiner, (obj.$ref).replace('#/',''))
        parent[path.split('/').pop()] = substitute;
      }
    }

    return cnt.count;
  };

async function build() {
    let docToParse1 = await fileContentAsJSON('api/starknet_api_openrpc.json')
    let docToParse2 = await fileContentAsJSON('api/starknet_write_api.json')
    let docToParse3 = await fileContentAsJSON('api/starknet_trace_api_openrpc.json')

    const combined = globCombiner ={... docToParse1};

    combined.methods = [...docToParse3.methods, ...docToParse2.methods, ...docToParse1.methods];
    combined.components.errors = { ...docToParse3.components.errors, ...docToParse2.components.errors, ...docToParse1.components.errors};
    combined.components.schemas = {...docToParse3.components.schemas, ...docToParse2.components.schemas, ...docToParse1.components.schemas}

    let reps = 0;
    while(getObjectValueOfKey(combined, "$ref", undefined, undefined, { count: 0}) > 0 && reps < 20){ ++reps; }

    return combined;
}

/**
 * Given a filename, read, parse and return the JSON content of the file.
 * @param {String} filename The filename to read the JSON from
 * @returns The parsed JS object.
 */
async function fileContentAsJSON(filename) {
    let json = await fs.readJson(filename)
    return json
}

runValidation()