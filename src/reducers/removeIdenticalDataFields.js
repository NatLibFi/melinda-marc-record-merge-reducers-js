import createDebugLogger from 'debug';
//import {MarcRecord} from '@natlibfi/marc-record';
import {/*fieldToString,*/ fieldToString, nvdebug} from './utils';

// NB! It this file 'common' means 'normal' not 'identical'
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
//const debugData = debug.extend('data');


//const sf6Regexp = /^[0-9][0-9][0-9]-[0-9][0-9]/u;

export default () => (base, source) => {
  // NV: Not actually sure why this is done...
  //const baseRecord = new MarcRecord(base, {subfieldValues: false});
  //const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  //const baseMax = getMaxSubfield6(baseRecord);

  removeSharedDataFieldsFromSource(base, source);

  return {base, source};
};

function removeSharedDataFieldsFromSource(base, source) {
  //removeIdenticalDatafieldsWithSubfield6FromSource(base, source);
  //removeIdenticalDatafieldsWithSubfield8FromSource(base, source);
  removeCommonSharedDataFieldsFromSource(base, source);
}

function isRelevantField6(field) {
  if (!field.subfields || field.tag === '880') {
    return false;
  }
  const sf6s = field.subfields.filter(sf => sf.code === '6');
  return sf6s.length === 1;
}

function isRelevantField8(field) {
  if (!field.subfields) {
    return false;
  }
  const sf8s = field.subfields.filter(sf => sf.code === '8');
  return sf8s.length === 1;
}

function isRelevantCommonDataField(field) {
  return field.tag !== '880' && field.subfields && !isRelevantField6(field) && !isRelevantField8(field);
}


function removeCommonSharedDataFieldsFromSource(base, source) {
  const baseFields = base.fields.filter(field => isRelevantCommonDataField(field));
  const sourceFields = source.fields.filter(field => isRelevantCommonDataField(field));
  const baseFieldsAsString = baseFields.map(field => fieldToString(field));

  sourceFields.forEach(field => removeCommonDataFieldIfNeeded(field));

  function removeCommonDataFieldIfNeeded(field) {
    const fieldAsString = fieldToString(field);
    if (!baseFieldsAsString.includes(fieldAsString)) {
      return;
    }
    nvdebug(`Remove ${fieldAsString}`, debug);
    source.removeField(field);
  }
}

