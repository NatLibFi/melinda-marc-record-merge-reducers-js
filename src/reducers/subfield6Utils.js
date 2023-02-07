// import createDebugLogger from 'debug';

import {fieldToString, nvdebug, subfieldToString} from './utils';

// import {fieldToString, nvdebug} from './utils';

// const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

// NB! Subfield 6 is non-repeatable and always comes first!

const sf6Regexp = /^[0-9][0-9][0-9]-[0-9][0-9](?:\/.+)?$/u;


export function isValidSubfield6(subfield) {
  if (subfield.code !== '6') {
    return false;
  }
  return subfield.value.match(sf6Regexp);
}


export function subfieldGetIndex6(subfield) {
  if (isValidSubfield6(subfield)) {
    // Skip "TAG-" prefix
    return subfield.value.substring(4, 6);
  }
  return undefined;
}

export function resetSubfield6Tag(subfield, tag) {
  if (!isValidSubfield6(subfield)) {
    return;
  }
  // NB! This
  const newValue = `${tag}-${subfield.value.substring(4)}`;
  nvdebug(`Set subfield $6 value from ${subfieldToString(subfield)} to ${newValue}`);
  subfield.value = newValue; // eslint-disable-line functional/immutable-data
}

export function fieldGetIndex6(field) {
  if (!field.subfields) {
    return undefined;
  }
  // Subfield $6 should always be the 1st subfield... (not implemented)
  // There should be only one $6, so find is ok.
  const sf6 = field.subfields.find(subfield => isValidSubfield6(subfield));
  if (sf6 === undefined) {
    return sf6;
  }
  return sf6.value.substring(4, 6);
}


export function isSubfield6Pair(field, otherField) {
  // nvdebug(`Look for $6-pair:\n ${fieldToString(field)}\n ${fieldToString(otherField)}`, debug);
  if (!tagsArePairable6(field.tag, otherField.tag)) {
    return false;
  }

  const fieldIndex = fieldGetIndex6(field);
  if (fieldIndex === undefined) {
    return false;
  }

  const otherFieldIndex = fieldGetIndex6(otherField);

  return fieldIndex === otherFieldIndex;

  function tagsArePairable6(tag1, tag2) {
    if (tag1 === '880' && tag2 === '880') {
      return false;
    }
    if (tag1 !== '880' && tag2 !== '880') {
      return false;
    }
    return true;
  }
}

export function fieldGetSubfield6Pair(field, record) {
  const pairedField = record.fields.find(otherField => isSubfield6Pair(field, otherField));
  if (!pairedField) {
    return pairedField;
  }
  nvdebug(`fieldGetSubfield6Pair(): ${fieldToString(field)} => ${fieldToString(pairedField)}`);
  return pairedField;
}
