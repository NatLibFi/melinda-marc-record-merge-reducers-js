import createDebugLogger from 'debug';
import {fieldsToString} from '@natlibfi/marc-record-validators-melinda/dist/utils';

import {fieldToString, nvdebug} from './utils';
import {fieldGetOccurrenceNumberPairs, fieldsToNormalizedString, isValidSubfield6} from '@natlibfi/marc-record-validators-melinda/dist/subfield6Utils';
// import {fieldToString, nvdebug} from './utils';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:subfield6Utils');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

// Validators' corresponding function should be exportable...
export function subfieldGetTag6(subfield) {
  if (isValidSubfield6(subfield)) {
    return subfield.value.substring(0, 3);
  }
  return undefined;
}

export function isRelevantField6(field) { // ...
  if (!field.subfields || field.tag === '880') {
    return false;
  }
  const sf6s = field.subfields.filter(sf => isValidSubfield6(sf));
  return sf6s.length === 1;
}

export function pairAndStringify6(field, record) {
  const pairs6 = fieldGetOccurrenceNumberPairs(field, record.fields);
  return fieldsToNormalizedString([field, ...pairs6], 0, true);
}


export function removeField6IfNeeded(field, record, fieldsAsString) {
  const pairFields = fieldGetOccurrenceNumberPairs(field, record.fields);
  const asString = fieldsToNormalizedString([field, ...pairFields], 0, true);
  nvdebug(`SOURCE: '${asString}' -- REALITY: ${fieldToString(field)}`, debugDev);
  //fieldsAsString.forEach(str => nvdebug(`TARGET: '${str}'`, debugDev));
  const tmp = pairFields.length ? fieldsToString(pairFields) : 'HUTI';
  nvdebug(`PAIR: ${tmp}`, debugDev);
  nvdebug(`BASE:\n ${fieldsAsString.join(' ')}`, debugDev);
  if (!fieldsAsString.includes(asString)) {
    return;
  }
  nvdebug(`Duplicate $6 removal: ${fieldToString(field)}`, debugDev);
  record.removeField(field);

  if (pairFields.length === 0) {
    return;
  }
  nvdebug(`Duplicate $6 removal (pair): ${fieldsToString(pairFields)}`, debugDev);
  pairFields.forEach(pairField => record.removeField(pairField));
}

