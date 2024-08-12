import createDebugLogger from 'debug';
import {fieldsToString} from '@natlibfi/marc-record-validators-melinda/dist/utils';

import {fieldToString, nvdebug, subfieldToString} from './utils';
import {fieldToNormalizedString, fieldsToNormalizedString, isSubfield6Pair, isValidSubfield6, subfield6GetOccurrenceNumber} from '@natlibfi/marc-record-validators-melinda/dist/subfield6Utils';
// import {fieldToString, nvdebug} from './utils';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:subfield6Utils');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

// NB! Subfield 6 is non-repeatable and always comes first!
// NB! Index size is always 2 (preceding 0 required for 01..09)
// How to handle non-linking value '00'? (Now accepted.) Support for 100+ was added on 2023-02-27.
const sf6Regexp = /^[0-9][0-9][0-9]-(?:[0-9][0-9]|[1-9][0-9]+)(?:[^0-9].*)?$/u;

/*
function fieldHasValidSubfield6(field) {
  return field.subfields && field.subfields.some(sf => isValidSubfield6(sf));
}
  */

// Validators' corresponding function should be exportable...
export function subfieldGetTag6(subfield) {
  if (isValidSubfield6(subfield)) {
    return subfield.value.substring(0, 3);
  }
  return undefined;
}

export function intToTwoDigitString(i) {
  return i < 10 ? `0${i}` : `${i}`;
}

export function resetSubfield6Tag(subfield, tag) {
  if (!isValidSubfield6(subfield)) {
    return;
  }
  // NB! mainly for 1XX<->7XX transfers
  const newValue = `${tag}-${subfield.value.substring(4)}`;
  nvdebug(`Set subfield $6 value from ${subfieldToString(subfield)} to ${newValue}`, debugDev);
  subfield.value = newValue; // eslint-disable-line functional/immutable-data
}


export function fieldGetSubfield6Pairs(field, record) {
  return record.fields.filter(otherField => isSubfield6Pair(field, otherField));
}

export function isRelevantField6(field) { // ...
  if (!field.subfields || field.tag === '880') {
    return false;
  }
  const sf6s = field.subfields.filter(sf => sf.code === '6' && sf.value.match(sf6Regexp));
  return sf6s.length === 1;
}

export function pairAndStringify6(field, record) {
  const pairs6 = fieldGetSubfield6Pairs(field, record);
  if (!pairs6.length) {
    return fieldToNormalizedString(field);
  }
  return fieldsToNormalizedString([field].concat(pairs6), 0, true);
}


export function removeField6IfNeeded(field, record, fieldsAsString) {
  const pairFields = fieldGetSubfield6Pairs(field, record);
  const asString = pairFields ? fieldsToNormalizedString([field, ...pairFields], 0, true) : fieldToNormalizedString(field, 0, true);
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


export function getFieldsWithSubfield6Index(record, index) {
  return record.fields.filter(field => fieldHasIndex(field, index));

  function fieldHasIndex(field, index) {
    if (!field.subfields) {
      return false;
    }
    return field.subfields.find(sf => isValidSubfield6(sf) && subfield6GetOccurrenceNumber(sf) === index);
  }
}
