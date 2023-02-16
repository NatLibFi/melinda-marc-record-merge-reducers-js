import createDebugLogger from 'debug';
import {getSubfield8Index, getSubfield8Value} from './reindexSubfield8';
import {fieldsToNormalizedString, fieldToNormalizedString, isRelevantField6, pairAndStringify6, removeField6IfNeeded} from './subfield6Utils';
//import {MarcRecord} from '@natlibfi/marc-record';
import {fieldHasNSubfields, fieldToString, nvdebug} from './utils';

// NB! It this file 'common' means 'normal' not 'identical'
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
//const debugData = debug.extend('data');
//const sf6Regexp = /^[0-9][0-9][0-9]-[0-9][0-9]/u;

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

function isRelevantCommonDataField(field) {
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
        //nvdebug(`Add subfield \$8 ${index} to seen values list`, debug);
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

  nvdebug(`base elements: ${baseIndexesToInspect.join(' -- ')}`, debug);

  const sourceIndexesToInspect = recordGetAllSubfield8Indexes(source);
  if (sourceIndexesToInspect.length === 0) {
    return;
  }

  nvdebug(`source elements: ${sourceIndexesToInspect.join(' -- ')}`, debug);

  baseIndexesToInspect.forEach(baseIndex => {
    const baseFields = getFieldsWithSubfield8Index(base, baseIndex);
    const baseFieldsAsString = fieldsToNormalizedString(baseFields, baseIndex);
    nvdebug(`Results for BASE ${baseIndex}:`, debug);
    nvdebug(`${baseFieldsAsString}`, debug);
    sourceIndexesToInspect.forEach(sourceIndex => {
      const sourceFields = getFieldsWithSubfield8Index(source, sourceIndex);
      const sourceFieldsAsString = fieldsToNormalizedString(sourceFields, sourceIndex);
      // If $8 source fields match with base fields, then remove them from source:
      nvdebug(`Compare BASE and SOURCE:`, debug);
      nvdebug(`${baseFieldsAsString} vs\n${sourceFieldsAsString}`, debug);
      if (sourceFieldsAsString === baseFieldsAsString) {
        nvdebug(`Deletable subfield $8 group found: ${sourceFieldsAsString}`);
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
  const baseFields = base.fields.filter(field => isRelevantCommonDataField(field));
  const sourceFields = source.fields.filter(field => isRelevantCommonDataField(field));
  const baseFieldsAsString = baseFields.map(field => fieldToNormalizedString(field));

  sourceFields.forEach(field => removeCommonDataFieldIfNeeded(field));

  function removeCommonDataFieldIfNeeded(field) {
    const fieldAsString = fieldToNormalizedString(field);
    nvdebug(`Looking for '${fieldAsString}' in '${baseFieldsAsString.join('\', \'')}'`, debug);
    if (!baseFieldsAsString.includes(fieldAsString)) {
      return;
    }
    nvdebug(`rCSDFFS(): Remove ${fieldAsString}`, debug);
    source.removeField(field);
  }
}


function numberOfLinkageSubfields(field) {
  const subfields = field.subfields.filter(sf => sf.code === '6' || sf.code === '8');
  return subfields.length;
}

function isComplexChain(fields) {
  return fields.some(field => numberOfLinkageSubfields(field) > 1);
}

function getAllLinkedfields(field) {
  // We need to implement getting $6- and $8-related fields here. Currently we just ignore them,
  // and handle only normal fields
  if (numberOfLinkageSubfields(field) > 0) {
    return [];
  }

  const fields = [field]; // Uh, quick'n'dirty

  // Press panic button if multiple linkahe subfields are found
  if (isComplexChain(fields)) {
    return [];
  }

  return fields;
}

function isLoneOrFirstLinkedField(field) {
  if (!field.subfields) { // Is not a datafield
    return false;
  }
  const chain = getAllLinkedfields(field);
  if (chain.length === 0) {
    return false;
  }
  return fieldToString(field) === fieldToString(chain[0]);
}


export function removeDuplicateDatafields(record) {
  /* eslint-disable */
  let seen = {};

  record.fields.forEach(field => nvdebug(`CHECK ${fieldToString(field)}`));
  
  const fields = record.fields.filter(field => isLoneOrFirstLinkedField(field));
  
  fields.forEach(field => removeDuplicateDatafield(field));

  function removeDuplicateDatafield(field) {
    const fields = getAllLinkedfields(field);
    if(fields.length === 0) {
      return;
    }
    const fieldsAsString = fieldsToNormalizedString(fields);
    if (fieldsAsString in seen)  {
      if (fields.some(currField => numberOfLinkageSubfields(currField) > 0) ) {
        // Fields with multi-$6 should only get the relevant $6 removed.
        // (And then removal will break the cache hit logic)
        return;
      }
      nvdebug(`REMOVE? ${fieldsAsString}`, debug);
      fields.forEach(currField => record.removeField(currField));
      return;
    }
    nvdebug(`ADD2SEEN ${fieldsAsString}`, debug);
    seen[fieldsAsString] = 1;
  }

  /* eslint-enable */
}


