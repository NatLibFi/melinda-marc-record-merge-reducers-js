import createDebugLogger from 'debug';
import {fieldsToString} from '@natlibfi/marc-record-validators-melinda/dist/utils';

import {fieldToString, nvdebug, subfieldToString} from './utils';
import {fieldToNormalizedString, fieldsToNormalizedString, isValidSubfield6, subfield6GetOccurrenceNumber} from '@natlibfi/marc-record-validators-melinda/dist/subfield6Utils';
// import {fieldToString, nvdebug} from './utils';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:subfield6Utils');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

// NB! Subfield 6 is non-repeatable and always comes first!
// NB! Index size is always 2 (preceding 0 required for 01..09)
// How to handle non-linking value '00'? (Now accepted.) Support for 100+ was added on 2023-02-27.
const sf6Regexp = /^[0-9][0-9][0-9]-(?:[0-9][0-9]|[1-9][0-9]+)(?:[^0-9].*)?$/u;

function fieldHasValidSubfield6(field) {
  return field.subfields && field.subfields.some(sf => isValidSubfield6(sf));
}

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

function getSubfield6Tail(subfield) {
  if (isValidSubfield6(subfield)) {
    // Skip "TAG-" prefix. 2023-02-20: removed 2-digit requirement from here...
    return subfield.value.replace(/^\d+-\d+/u, '');
  }
  return '';
}

export function resetSubfield6Index(subfield, strindex) {
  if (!isValidSubfield6(subfield)) {
    return;
  }
  const newValue = subfield.value.substring(0, 4) + strindex + getSubfield6Tail(subfield); // eslint-disable-line functional/immutable-data
  nvdebug(`Set subfield $6 value from ${subfieldToString(subfield)} to ${newValue}`, debugDev);
  subfield.value = newValue; // eslint-disable-line functional/immutable-data
}

export function fieldGetIndex6(field) {
  if (!field.subfields) {
    return undefined;
  }
  // Subfield $6 should always be the 1st subfield... (not implemented)
  // There should be only one $6, so find() is ok.
  const sf6 = field.subfields.find(subfield => isValidSubfield6(subfield));
  if (sf6 === undefined) {
    return undefined;
  }
  return subfield6GetOccurrenceNumber(sf6);
}

function fieldGetTag6(field) {
  if (!field.subfields) {
    return undefined;
  }
  // Subfield $6 should always be the 1st subfield... (not implemented)
  // There should be only one $6, so find is ok.
  const sf6 = field.subfields.find(subfield => isValidSubfield6(subfield));
  if (sf6 === undefined) {
    return undefined;
  }
  return subfieldGetTag6(sf6);
}

export function isSubfield6Pair(field, otherField) {
  // No need to log this:
  if (!fieldHasValidSubfield6(field) || !fieldHasValidSubfield6(otherField)) {
    return false;
  }

  if (!tagsArePairable6(field.tag, otherField.tag)) {
    //nvdebug(` FAILED. REASON: TAGS NOT PAIRABLE!`, debugDev);
    return false;
  }

  nvdebug(`LOOK for $6-pair:\n ${fieldToString(field)}\n ${fieldToString(otherField)}`, debugDev);

  const fieldIndex = fieldGetIndex6(field);
  if (fieldIndex === undefined || fieldIndex === '00') {
    nvdebug(` FAILED. REASON: NO INDEX FOUND`, debugDev);
    return false;
  }

  const otherFieldIndex = fieldGetIndex6(otherField);

  if (fieldIndex !== otherFieldIndex) {
    nvdebug(` FAILURE: INDEXES: ${fieldIndex} vs ${otherFieldIndex}`, debugDev);
    return false;
  }

  if (fieldGetTag6(field) !== otherField.tag || field.tag !== fieldGetTag6(otherField)) {
    nvdebug(` FAILURE: TAG vs $6 TAG`, debugDev);
    return false;
  }
  return true;

  function tagsArePairable6(tag1, tag2) {
    // How to do XOR operation in one line? Well, this is probably more readable...
    if (tag1 === '880' && tag2 === '880') {
      return false;
    }
    if (tag1 !== '880' && tag2 !== '880') {
      return false;
    }
    return true;
  }
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
