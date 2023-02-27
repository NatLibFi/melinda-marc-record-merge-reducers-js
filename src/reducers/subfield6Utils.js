import createDebugLogger from 'debug';
import {getSubfield8Index, isValidSubfield8} from './reindexSubfield8';

import {fieldToString, nvdebug, subfieldToString} from './utils';

// import {fieldToString, nvdebug} from './utils';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

// NB! Subfield 6 is non-repeatable and always comes first!
// NB! Index size is always 2 (preceding 0 required for 01..09)
// How to handle non-linking value '00'? How to handle 100+ indexes?
const sf6Regexp = /^[0-9][0-9][0-9]-(?:[0-9][0-9]|[1-9][0-9]+)(?:[^0-9].*)?$/u;


export function isValidSubfield6(subfield) {
  if (subfield.code !== '6') {
    return false;
  }
  return subfield.value.match(sf6Regexp);
}

function fieldHasValidSubfield6(field) {
  return field.subfields && field.subfields.some(sf => isValidSubfield6(sf));
}

export function subfieldGetIndex6(subfield) {
  if (isValidSubfield6(subfield)) {
    // Skip "TAG-" prefix. 2023-02-20: removed 2-digit requirement from here...
    return subfield.value.substring(4).replace(/\D.*$/u, '');
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
  nvdebug(`Set subfield $6 value from ${subfieldToString(subfield)} to ${newValue}`);
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
  nvdebug(`Set subfield $6 value from ${subfieldToString(subfield)} to ${newValue}`);
  subfield.value = newValue; // eslint-disable-line functional/immutable-data
}

/*
export function subfieldGetIndex(subfield) {
  if (!isValidSubfield6(subfield)) {
    return undefined;
  }
  return subfield.value.substring(4, 6);
}
*/

export function fieldGetIndex6(field) {
  if (!field.subfields) {
    return undefined;
  }
  // Subfield $6 should always be the 1st subfield... (not implemented)
  // There should be only one $6, so find is ok.
  const sf6 = field.subfields.find(subfield => isValidSubfield6(subfield));
  if (sf6 === undefined) {
    return undefined;
  }
  return subfieldGetIndex6(sf6);
}


export function isSubfield6Pair(field, otherField) {
  // No need to log this:
  if (!fieldHasValidSubfield6(field) || !fieldHasValidSubfield6(otherField)) {
    return false;
  }

  if (!tagsArePairable6(field.tag, otherField.tag)) {
    //nvdebug(` FAILED. REASON: TAGS NOT PAIRABLE!`);
    return false;
  }

  nvdebug(`LOOK for $6-pair:\n ${fieldToString(field)}\n ${fieldToString(otherField)}`, debug);

  const fieldIndex = fieldGetIndex6(field);
  if (fieldIndex === undefined || fieldIndex === '00') {
    nvdebug(` FAILED. REASON: NO INDEX FOUND`);
    return false;
  }

  const otherFieldIndex = fieldGetIndex6(otherField);
  nvdebug(` INDEXES: ${fieldIndex} vs ${otherFieldIndex}`);
  return fieldIndex === otherFieldIndex;

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

export function fieldGetSubfield6Pair(field, record) {
  const pairedField = record.fields.find(otherField => isSubfield6Pair(field, otherField));
  if (!pairedField) {
    return pairedField;
  }
  nvdebug(`fieldGetSubfield6Pair(): ${fieldToString(field)} => ${fieldToString(pairedField)}`);
  return pairedField;
}

export function isRelevantField6(field) { // ...
  if (!field.subfields || field.tag === '880') {
    return false;
  }
  const sf6s = field.subfields.filter(sf => sf.code === '6' && sf.value.match(sf6Regexp));
  return sf6s.length === 1;
}

export function pairAndStringify6(field, record) {
  const pair6 = fieldGetSubfield6Pair(field, record);
  if (!pair6) {
    return fieldToNormalizedString(field);
  }
  return fieldsToNormalizedString([field, pair6]);
}


export function fieldToNormalizedString(field, currIndex = 0) {
  function subfieldToNormalizedString(sf) {
    if (isValidSubfield6(sf)) {
      // Replace index with XX:
      return `‡${sf.code} ${sf.value.substring(0, 3)}-XX${getSubfield6Tail(sf)}`;
    }
    if (isValidSubfield8(sf)) {
      const index8 = getSubfield8Index(sf);
      if (currIndex === 0 || currIndex === index8) {
        // For $8 we should only XX the index we are looking at...
        const normVal = sf.value.replace(/^[0-9]+/u, 'XX');
        return `‡${sf.code} ${normVal}`;
      }
      return ''; // Other $8 subfields are meaningless in this context
    }
    return `‡${sf.code} ${sf.value}`;
  }

  if ('subfields' in field) {
    return `${field.tag} ${field.ind1}${field.ind2}${formatAndNormalizeSubfields(field)}`;
  }
  return `${field.tag}    ${field.value}`;

  function formatAndNormalizeSubfields(field) {
    return field.subfields.map(sf => `${subfieldToNormalizedString(sf)}`).join('');
  }
}

export function fieldsToNormalizedString(fields, index = 0) {
  const strings = fields.map(field => fieldToNormalizedString(field, index));
  strings.sort(); // eslint-disable-line functional/immutable-data
  return strings.join('\t__SEPARATOR__\t');
}

export function removeField6IfNeeded(field, record, fieldsAsString) {
  const pairField = fieldGetSubfield6Pair(field, record);
  const asString = pairField ? fieldsToNormalizedString([field, pairField]) : fieldToNormalizedString(field);
  nvdebug(`SOURCE: ${asString} -- REALITY: ${fieldToString(field)}`);
  const tmp = pairField ? fieldToString(pairField) : 'HUTI';
  nvdebug(`PAIR: ${tmp}`);
  nvdebug(`BASE:\n ${fieldsAsString.join('\n ')}`);
  if (!fieldsAsString.includes(asString)) {
    return;
  }
  nvdebug(`Duplicate $6 removal: ${fieldToString(field)}`);
  record.removeField(field);

  if (pairField === undefined) {
    return;
  }
  nvdebug(`Duplicate $6 removal (pair): ${fieldToString(pairField)}`);
  record.removeField(pairField);
}
