// This reducer compares base and source and removes identical/paired datafields from source.

import createDebugLogger from 'debug';
import {getSubfield8Index, getSubfield8Value} from './reindexSubfield8';
import {isRelevantField6, pairAndStringify6, removeField6IfNeeded} from './subfield6Utils';
import {fieldToNormalizedString, fieldsToNormalizedString} from '@natlibfi/marc-record-validators-melinda/dist/subfield6Utils';
//import {MarcRecord} from '@natlibfi/marc-record';
import {fieldHasNSubfields, nvdebug} from './utils';

// NB! It this file 'common' means 'normal' not 'identical'
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:removeIdenticalDatafields');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

// const sf8Regexp = /^([1-9][0-9]*)(?:\.[0-9]+)?(?:\\[acprux])?$/u; // eslint-disable-line prefer-named-capture-group


export default () => (base, source) => {
  removeSharedDataFieldsFromSource(base, source);

  return {base, source};
};

function removeSharedDataFieldsFromSource(base, source) {
  removeSharedDatafieldsWithSubfield6FromSource(base, source);
  removeSharedDatafieldsWithSubfield8FromSource(base, source);
  removeCommonSharedDataFieldsFromSource(base, source);
}

function isRelevantField8(field) {
  if (!field.subfields) {
    return false;
  }
  return field.subfields.some(sf => getSubfield8Value(sf) !== undefined);
}

function isUnlinkedDataField(field) {
  return field.tag !== '880' && field.subfields && !isRelevantField6(field) && !isRelevantField8(field);
}


function recordGetAllSubfield8Indexes(record) {
  /* eslint-disable */
  let subfield8Values = [];
  record.fields.forEach(field => {
    if (!field.subfields) {
      return;
    }
    field.subfields.forEach(sf => {
      const index = getSubfield8Index(sf);
      if (index > 0 && !subfield8Values.includes(index)) {
        //nvdebug(`Add subfield \$8 ${index} to seen values list`, debugDev);
        subfield8Values.push(index);
      }
    });
  });

  return subfield8Values;
  /* eslint-enable */
}

function getFieldsWithSubfield8Index(record, index) {
  return record.fields.filter(field => relevant4GFWS8I(field, index));

  function relevant4GFWS8I(field, index) {
    if (!field.subfields) {
      return false;
    }
    return field.subfields.some(sf => index > 0 && getSubfield8Index(sf) === index);
  }
}

function removeFieldOrSubfield8(record, field, index = 0) {
  const n8 = fieldHasNSubfields(field, '8');
  if (n8 === 1) {
    record.removeField(field);
    return;
  }
  if (index === 0) {
    return;
  }
  field.subfields = field.subfields.filter(sf => sf.code !== '8' || getSubfield8Index(sf) !== index); // eslint-disable-line functional/immutable-data

}

function removeSharedDatafieldsWithSubfield8FromSource(base, source) {
  const baseIndexesToInspect = recordGetAllSubfield8Indexes(base);
  if (baseIndexesToInspect.length === 0) {
    return;
  }

  nvdebug(`base elements: ${baseIndexesToInspect.join(' -- ')}`, debugDev);

  const sourceIndexesToInspect = recordGetAllSubfield8Indexes(source);
  if (sourceIndexesToInspect.length === 0) {
    return;
  }

  nvdebug(`source elements: ${sourceIndexesToInspect.join(' -- ')}`, debugDev);

  baseIndexesToInspect.forEach(baseIndex => {
    const baseFields = getFieldsWithSubfield8Index(base, baseIndex);
    const baseFieldsAsString = fieldsToNormalizedString(baseFields, baseIndex, true, true);
    nvdebug(`Results for BASE ${baseIndex}:`, debugDev);
    nvdebug(`${baseFieldsAsString}`, debugDev);
    sourceIndexesToInspect.forEach(sourceIndex => {
      const sourceFields = getFieldsWithSubfield8Index(source, sourceIndex);
      const sourceFieldsAsString = fieldsToNormalizedString(sourceFields, sourceIndex, true, true);
      // If $8 source fields match with base fields, then remove them from source:
      nvdebug(`Compare BASE and SOURCE:`, debugDev);
      nvdebug(`${baseFieldsAsString} vs\n${sourceFieldsAsString}`, debugDev);
      if (sourceFieldsAsString === baseFieldsAsString) {
        nvdebug(`Deletable subfield $8 group found: ${sourceFieldsAsString}`, debugDev);
        // FFS! Mainly theoretical, but what if record has multiple $8 indexes!?!
        // The other 8s might be different. If field has multiple $8s, only relevant $8 subfield
        // should be removed.
        sourceFields.forEach(field => removeFieldOrSubfield8(source, field, sourceIndex));
        return;
      }
    });
  });
}


function removeSharedDatafieldsWithSubfield6FromSource(base, source) {
  const baseFields6 = base.fields.filter(field => isRelevantField6(field)); // Does not get 880 fields
  const baseFieldsAsString = baseFields6.map(field => pairAndStringify6(field, base));

  const sourceFields6 = source.fields.filter(field => isRelevantField6(field)); // Does not get 880 fields

  sourceFields6.forEach(field => removeField6IfNeeded(field, source, baseFieldsAsString));
}

function removeCommonSharedDataFieldsFromSource(base, source) {
  const baseFields = base.fields.filter(field => isUnlinkedDataField(field));
  const sourceFields = source.fields.filter(field => isUnlinkedDataField(field));
  const baseFieldsAsString = baseFields.map(field => fieldToNormalizedString(field));

  const deletableSourceFields = sourceFields.filter(field => removableField(field));

  function removableField(field) {
    const fieldAsString = fieldToNormalizedString(field);
    return baseFieldsAsString.includes(fieldAsString);
  }

  deletableSourceFields.forEach(f => source.removeField(f));
}

/*
function numberOfLinkageSubfields(field) {
  const subfields = field.subfields.filter(sf => sf.code === '6' || sf.code === '8');
  return subfields.length;
}
*/

/*
function isComplexChain(fields) {
  return fields.some(field => numberOfLinkageSubfields(field) > 1);
}
*/

/*
function getAllLinkedfields(field, record) {
  const n = numberOfLinkageSubfields(field);
  // We need to implement getting $6- and $8-related fields here. Currently we just ignore them,
  // and handle only normal fields
  if (n > 1) {
    return [];
  }

  if (n === 1 && fieldHasSubfield(field, '6')) {
    const pair = fieldGetSubfield6Pair(field, record);
    if (pair) {
      return [field, pair];
    }
  }


  const fields = [field]; // Uh, quick'n'dirty

  // Press panic button if multiple linkahe subfields are found
  if (isComplexChain(fields)) {
    return [];
  }

  return fields;
}
*/

/*
function getFirstField(record, fields) {
  const fieldsAsStrings = fields.map(field => fieldToString(field));
  record.fields.forEach((field, i) => nvdebug(`${i}:\t${fieldToString(field)}`, debugDev));
  nvdebug(`INCOMING: ${fieldsAsStrings.join('\t')}`, debugDev);
  const i = record.fields.findIndex(field => fieldsAsStrings.includes(fieldToString(field)));
  if (i > -1) {
    const field = record.fields[i];
    nvdebug(`1st F: ${i + 1}/${record.fields.length} ${fieldToString(field)}`, debugDev);
    return field;
  }
  return undefined;
}
*/
/*
function isLoneOrFirstLinkedField(field, record) {
  if (!field.subfields) { // Is not a datafield
    return false;
  }
  const chain = getAllLinkedfields(field, record);
  if (chain.length === 0) {
    return false;
  }
  if (chain.length === 1) {
    return true;
  }
  // Interpretation of first: position of field in
  const firstField = getFirstField(record, chain);
  if (firstField) {
    return fieldToString(field) === fieldToString(firstField);
  }
  return false;

  // Fallback:
  //return fieldToString(field) === fieldToString(chain[0]);
}
*/


//DEPRECATED//export function removeDuplicateDatafields(record) {
//DEPRECATED//  /* eslint-disable */
//DEPRECATED//  let seen = {};
//DEPRECATED//
//DEPRECATED//  record.fields.forEach(field => nvdebug(`DUPL-CHECK ${fieldToString(field)}`, debugDev));
//DEPRECATED//
//DEPRECATED//  const fields = record.fields.filter(field => isLoneOrFirstLinkedField(field, record));
//DEPRECATED//
//DEPRECATED//  fields.forEach(field => removeDuplicateDatafield(field));
//DEPRECATED//
//DEPRECATED//  function removeDuplicateDatafield(field) {
//DEPRECATED//    nvdebug(`removeDuplicateDatafield? ${fieldToString(field)} (and friends)`, debugDev);
//DEPRECATED//    const fields = getAllLinkedfields(field, record);
//DEPRECATED//    if(fields.length === 0) {
//DEPRECATED//      return;
//DEPRECATED//    }
//DEPRECATED//
//DEPRECATED//    const fieldsAsString = fieldsToNormalizedString(fields);
//DEPRECATED//    nvdebug(` step 2 ${fieldsAsString}`, debugDev);
//DEPRECATED//    if (fieldsAsString in seen)  {
//DEPRECATED//      nvdebug(` step 3 ${fieldsAsString}`, debugDev);
//DEPRECATED//      /*
//DEPRECATED//      if (fields.some(currField => numberOfLinkageSubfields(currField) > 0) ) {
//DEPRECATED//        // Fields with multi-$6 should only get the relevant $6 removed.
//DEPRECATED//        // (And then removal will break the cache hit logic)
//DEPRECATED//        return;
//DEPRECATED//      }
//DEPRECATED//      */
//DEPRECATED//      nvdebug(`DOUBLE REMOVAL: REMOVE ${fieldsAsString}`, debugDev);
//DEPRECATED//      fields.forEach(currField => record.removeField(currField));
//DEPRECATED//      return;
//DEPRECATED//    }
//DEPRECATED//    nvdebug(`DOUBLE REMOVAL: ADD2SEEN ${fieldsAsString}`, debugDev);
//DEPRECATED//    seen[fieldsAsString] = 1;
//DEPRECATED//  }
//DEPRECATED//
//DEPRECATED//  /* eslint-enable */
//DEPRECATED//}


