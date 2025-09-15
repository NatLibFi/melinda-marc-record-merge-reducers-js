// This reducer compares base and source and removes identical/paired datafields from source.
import createDebugLogger from 'debug';
import {getSubfield8LinkingNumber, isValidSubfield8, recordGetAllSubfield8LinkingNumbers, recordGetFieldsWithSubfield8LinkingNumber} from '@natlibfi/marc-record-validators-melinda/dist/subfield8Utils.js';
import {isRelevantField6, pairAndStringify6, removeField6IfNeeded} from './subfield6Utils.js';
import {fieldToNormalizedString, fieldsToNormalizedString} from '@natlibfi/marc-record-validators-melinda/dist/subfield6Utils.js';
import {fieldHasNSubfields, nvdebug} from './utils.js';

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

function getSubfield8Value(subfield) {
  if (!isValidSubfield8(subfield)) {
    return undefined;
  }
  return subfield.value;
}

function isUnlinkedDataField(field) {
  return field.tag !== '880' && field.subfields && !isRelevantField6(field) && !isRelevantField8(field);
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
  field.subfields = field.subfields.filter(sf => sf.code !== '8' || getSubfield8LinkingNumber(sf) !== index);

}

function removeSharedDatafieldsWithSubfield8FromSource(base, source) {
  const baseIndexesToInspect = recordGetAllSubfield8LinkingNumbers(base);
  if (baseIndexesToInspect.length === 0) {
    return;
  }

  nvdebug(`base elements: ${baseIndexesToInspect.join(' -- ')}`, debugDev);

  const sourceIndexesToInspect = recordGetAllSubfield8LinkingNumbers(source);
  if (sourceIndexesToInspect.length === 0) {
    return;
  }

  nvdebug(`source elements: ${sourceIndexesToInspect.join(' -- ')}`, debugDev);

  baseIndexesToInspect.forEach(baseIndex => {
    const baseFields = recordGetFieldsWithSubfield8LinkingNumber(base, baseIndex);
    const baseFieldsAsString = fieldsToNormalizedString(baseFields, baseIndex, true, true);
    nvdebug(`Results for BASE ${baseIndex}:`, debugDev);
    nvdebug(`${baseFieldsAsString}`, debugDev);
    sourceIndexesToInspect.forEach(sourceIndex => {
      const sourceFields = recordGetFieldsWithSubfield8LinkingNumber(source, sourceIndex);
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
