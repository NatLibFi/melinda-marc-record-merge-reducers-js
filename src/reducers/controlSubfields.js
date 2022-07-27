import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {
  fieldHasSubfield,
  fieldToString,
  nvdebug
} from './utils.js';

import {normalizeControlSubfieldValue} from './normalizeIdentifier';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
const debugData = debug.extend('data');

function subfieldsAreEqual(field1, field2, subfieldCode) {
  // Check OK if neither one has given subfield.
  // Check fails if one field has given subfield and the other one does not
  if (!fieldHasSubfield(field1, subfieldCode)) {
    return !fieldHasSubfield(field2, subfieldCode);
  }
  if (!fieldHasSubfield(field2, subfieldCode)) {
    return false;
  }
  // Compare $3 subfields. If everything matches, OK, else FAIL:
  const sfSet1 = field1.subfields.filter(subfield => subfield.code === subfieldCode);
  const sfSet2 = field2.subfields.filter(subfield => subfield.code === subfieldCode);
  return MarcRecord.isEqual(sfSet1, sfSet2);
}

function subfieldsAreEmpty(field1, field2, subfieldCode) {
  if (!fieldHasSubfield(field1, subfieldCode) && !fieldHasSubfield(field2, subfieldCode)) {
    return true;
  }
  return false;
}

function fieldsAreEqualAfterRemovingSubfield(field1, field2, code) {
  const strippedField1 = field1.subfields.filter(subfield => subfield.code !== code);
  const strippedField2 = field2.subfields.filter(subfield => subfield.code !== code);
  return MarcRecord.isEqual(strippedField1, strippedField2);
}

function controlSubfield6PermitsMerge(field1, field2) {
  if (subfieldsAreEmpty(field1, field2, '6')) {
    return true;
  }

  if (!fieldHasSubfield(field1, '6') && fieldHasSubfield(field2, '6') && fieldsAreEqualAfterRemovingSubfield(field1, field2, '6')) {
    return true;
  }
  if (!fieldHasSubfield(field2, '6') && fieldHasSubfield(field1, '6') && fieldsAreEqualAfterRemovingSubfield(field1, field2, '6')) {
    return true;
  }

  // There are two (plus) fields involved (Field XXX (one) and field 880 (one plus).
  // Thus this generic solution can't handle them. Use postprocess instead.
  debug(`  controlSubfield6PermitsMerge() fails always on generic part (feature).`);
  return false;
}

function controlSubfield5PermitsMerge(field1, field2) {
  // field1.$5 XOR field2.$5 means false, NEITHER and BOTH mean true, regardless of value
  if (!fieldHasSubfield(field1, '5')) {
    if (!fieldHasSubfield(field2, '5')) {
      return true; // If neither one has $5, it's ok to merge
    }
    return false;
  }
  if (!fieldHasSubfield(field2, '5')) {
    return false;
  }
  return true;
}

function controlSubfield9PermitsMerge(field1, field2) {
  if (subfieldsAreEmpty(field1, field2, '9')) {
    return true;
  }
  // NB! We ignote $9s that aren't keeps or drops.
  // NB: If we have "whatever" and "whatever + DROP", the result should be "whatever + DROP"?
  // What should we check here anyway? Never merge FOO<KEEP> and FOO<DROP>?
  const sf9lessField1 = field1.subfields.filter(subfield => subfield.code !== '9' || !(/(?:<KEEP>|<DROP>)/u).test(subfield.value));
  const sf9lessField2 = field2.subfields.filter(subfield => subfield.code !== '9' || !(/(?:<KEEP>|<DROP>)/u).test(subfield.value));
  const result = MarcRecord.isEqual(sf9lessField1, sf9lessField2); // NB! Do we need to sort them subfields?
  if (!result) {
    debug(` control subfield 9 disallows merge`);
    return false;
  }
  return true;
}

function getPrefix(value) {
  const normalizedValue = normalizeControlSubfieldValue(value);

  if (normalizedValue.match(/^\([^)]+\)[0-9]+$/u)) {
    return normalizedValue.substr(0, normalizedValue.indexOf(')') + 1);
  }

  if (value.match(/^https?:\/\//u)) {
    return normalizedValue.substr(0, normalizedValue.lastIndexOf('/') + 1);
  }

  return '';
}

function isMatchAfterNormalization(currSubfield, otherField) {
  // NB! Add implement isni normalizations (to normalize.js) and apply here:
  const normalizedCurrSubfieldValue = normalizeControlSubfieldValue(currSubfield.value);
  const prefix = getPrefix(normalizedCurrSubfieldValue);

  //debug(`FFS-PREFIX '${prefix}'`);
  // Look for same prefix + different identifier
  const hits = otherField.subfields.filter(sf2 => sf2.code === currSubfield.code && normalizeControlSubfieldValue(sf2.value).indexOf(prefix) === 0);
  if (hits.length === 0 || // <-- Nothing found, so it can't be a mismatch
      // Every opposing subfields match:
      hits.every(sf2 => normalizedCurrSubfieldValue === normalizeControlSubfieldValue(sf2.value))) {
    debug(`Subfield ‡${currSubfield.code} check OK: No opposing ${prefix} prefixes found.`);
    return true;
  }

  debug(`Subfield ‡${currSubfield.code} check FAILED: ‡${currSubfield.code} '${currSubfield.value}' vs ‡${currSubfield.code} '${hits[0].value}'.`);
  return false;
}

function controlSubfieldContainingIdentifierPermitsMerge(field1, field2, subfieldCode) {
  if (!fieldHasSubfield(field1, subfieldCode, null) || !fieldHasSubfield(field2, subfieldCode, null)) {
    return true;
  }

  const result = field1.subfields.every(subfield => {
    if (subfield.code !== subfieldCode) {
      return true;
    }

    debug(`Compare ‡${subfieldCode} '${subfield.value}' with '${fieldToString(field2)}'.`);
    if (fieldHasSubfield(field2, field1.code, field1.value)) {
      return true;
    }

    return isMatchAfterNormalization(subfield, field2, subfieldCode);
  });

  if (!result) {
    debug(`Control subfield '${subfieldCode}' check failed.`);
    return false;
  }
  return true;
}

const controlSubfieldsContainingIdentifier = ['w', '0', '1', '2']; // 2 ain't identifier, but the logic can be applied here as well

export function controlSubfieldsPermitMerge(field1, field2) {
  if (!controlSubfieldsContainingIdentifier.every(subfieldCode => controlSubfieldContainingIdentifierPermitsMerge(field1, field2, subfieldCode))) {
    //debug(' control subfields with identifiers failed');
    return false;
  }

  if (!subfieldsAreEqual(field1, field2, '3')) {
    //debug(' similar control subfield fails');
    return false;
  }

  if (!controlSubfield5PermitsMerge(field1, field2) || !controlSubfield6PermitsMerge(field1, field2) || !controlSubfield9PermitsMerge(field1, field2)) {
    return false;
  }
  // We don't handle $8 subfields here at all, as they affect multiple fields! Also these would get screwed:
  // 38211 |8 3\u |a kuoro |2 seko
  // 38211 |8 6\u |a kuoro |2 seko |9 VIOLA<KEEP>
  if (!subfieldsAreEmpty(field1, field2, '8')) {

    //debug(' csf8 failed');
    return false;
  }

  return true;
}


const sf6Regexp = /^[0-9][0-9][0-9]-[0-9][0-9]/u;

function subfield6Index(subfield) {
  if (!subfield.value.match(sf6Regexp)) {
    return 0;
  }
  const tailPart = subfield.value.substring(4, 6); // 4 is for "TAG-"
  const result = parseInt(tailPart, 10);
  debug(`SF6: ${subfield.value} => ${tailPart} => ${result}`);
  return result;
}

const sf8Regexp = /^([1-9][0-9]*)(?:\.[0-9]+)?(?:\\[acprux])?$/u; // eslint-disable-line prefer-named-capture-group

function subfield8Index(subfield) {
  const match = subfield.value.match(sf8Regexp);
  if (match.length === 0) {
    return 0;
  }
  return parseInt(match[0], 10);
}

/*
function updateSubfield6(field, index) {
  const sf6s = field.subfields.filter(subfield => subfield.code === '6');
  const strindex = index < 10 ? `0${index}` : `${index}`;
  sf6s[0].value.replace(sf6s[0].substring(4, 6), strindex);
}
*/


export function getMaxSubfield6(record) {
  // Should we cache the value here?
  const vals = record.fields.map((field) => fieldSubfield6Index(field));
  return Math.max(...vals);

  function fieldSubfield6Index(field) {
    debugData(`Checking subfields $6 from ${JSON.stringify(field)}`);
    const sf6s = field.subfields ? field.subfields.filter(subfield => subfield.code === '6') : [];
    if (sf6s.length === 0) {
      return 0;
    }
    const vals = sf6s.map(sf => subfield6Index(sf));
    return Math.max(...vals);
  }
}

export function getMaxSubfield8(record) {
  // Should we cache the value here?
  const vals = record.fields.map((field) => fieldSubfield8Index(field));
  return Math.max(...vals);
  function fieldSubfield8Index(field) {
    debugData(`Checking subfields $8 from ${JSON.stringify(field)}`);
    const sf8s = field.subfields ? field.subfields.filter(subfield => subfield.code === '8') : [];
    if (sf8s.length === 0) {
      return 0;
    }
    const vals = sf8s.map(sf => subfield8Index(sf));
    return Math.max(...vals);
  }
}


export function reindexSubfield6s(record, baseMax) {
  if (baseMax === 0) { // No action required
    return record;
  }

  debug(`MAX SF6 is ${baseMax}`);

  record.fields.forEach(field => fieldUpdateSubfield6s(field, baseMax));

  function fieldUpdateSubfield6s(field, max) {
    if (!field.subfields) {
      return;
    }
    field.subfields.forEach(sf => updateSubfield6(sf, max));
  }

  function updateSubfield6(sf, max) {
    if (sf.code === '6') { // eslint-disable-line functional/no-conditional-statement
      const index = subfield6Index(sf) + max;
      const strindex = index < 10 ? `0${index}` : `${index}`;
      sf.value = sf.value.substring(0, 4) + strindex + sf.value.substring(6); // eslint-disable-line functional/immutable-data
      debug(`SF6 is now ${sf.value}`);
    }
  }
}


export function reindexSubfield8s(record, baseMax) {
  nvdebug(`MAX SF8 is ${baseMax}`, debug);

  if (baseMax === 0) { // No action required
    return record;
  }

  record.fields.forEach(field => fieldUpdateSubfield8s(field, baseMax));

  function fieldUpdateSubfield8s(field, max) {
    if (!field.subfields) {
      return;
    }
    field.subfields.forEach(sf => updateSubfield8(sf, max));
  }

  function updateSubfield8(sf, max) {
    if (sf.code === '8') { // eslint-disable-line functional/no-conditional-statement
      const oldIndex = subfield8Index(sf);
      if (oldIndex < 1) { // Unexpected crap
        return;
      }
      const index = oldIndex + max;
      const strindex = `${index}`;
      sf.value = sf.value.replace(`${oldIndex}`, strindex); // eslint-disable-line functional/immutable-data
      debug(`SF8 is now ${sf.value}`);
    }
  }
}
