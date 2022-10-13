import clone from 'clone';
import {fieldStripPunctuation} from './punctuation.js';
import {fieldToString, isControlSubfieldCode, nvdebug} from './utils.js';

//import {fieldNormalizeControlNumbers} from './normalizeIdentifier';
import {fieldNormalizeControlNumbers/*, normalizeControlSubfieldValue*/} from '@natlibfi/marc-record-validators-melinda/dist/normalize-identifiers';
//import {getMaxSubfield6, reindexSubfield6s} from './reindexSubfield6.js';
//import {getMaxSubfield8, reindexSubfield8s} from './reindexSubfield8.js';
import createDebugLogger from 'debug';
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:normalize');

function debugFieldComparison(oldField, newField) { // NB: Debug-only function!
  //if (oldField.subfields.length === newField.subfields.length) {
  oldField.subfields.forEach((subfield, index) => {
    const newValue = newField.subfields[index].value;
    if (subfield.value !== newValue) { // eslint-disable-line functional/no-conditional-statement
      nvdebug(`NORMALIZE: '${subfield.value}' => '${newValue}'`);
    }
  });
  //}
  nvdebug(`NORMALIZE: '${fieldToString(oldField)}' => '${fieldToString(newField)}'`);
}

function containsHumanName(tag = '???', subfieldCode = undefined) {
  // NB! This set is for bibs! Auth has 400... What else...
  if (['100', '600', '700', '800'].includes(tag)) {
    if (subfieldCode === undefined || subfieldCode === 'a') {
      return true;
    }
  }
  // Others?
  return false;
}

function containsCorporateName(tag = '???', subfieldCode = undefined) {
  // NB! This set is for bibs! Auth has 400... What else...
  if (['110', '610', '710', '810'].includes(tag)) {
    if (subfieldCode === undefined || subfieldCode === 'a') {
      return true;
    }
  }
  // Others?
  return false;
}

function skipAllSubfieldNormalizations(value, subfieldCode, tag) {
  if (subfieldCode === 'g' && value === 'ENNAKKOTIETO.') {
    return true;
  }

  if (tag === '035' && ['a', 'z'].includes(subfieldCode)) { // A
    return true;
  }

  if (isControlSubfieldCode(subfieldCode)) {
    return true;
  }
  return false;
}

function skipSubfieldLowercase(value, subfieldCode, tag) {
  return skipAllSubfieldNormalizations(value, subfieldCode, tag);
}

function skipAllFieldNormalizations(tag) {
  if (['LOW', 'SID'].includes(tag)) {
    return true;
  }
  return false;
}


function subfieldValueLowercase(value, subfieldCode, tag) {
  if (skipSubfieldLowercase(value, subfieldCode, tag)) {
    return value;
  }

  //return value.toLowerCase();
  const newValue = value.toLowerCase();
  if (newValue !== value) {
    nvdebug(`SVL ${tag} $${subfieldCode} '${value}' =>`);
    nvdebug(`SVL ${tag} $${subfieldCode} '${newValue}'`);
    return newValue;
  }
  return value;
}

function subfieldLowercase(sf, tag) {
  sf.value = subfieldValueLowercase(sf.value, sf.code, tag); // eslint-disable-line functional/immutable-data
}

function fieldLowercase(field) {
  if (skipFieldLowercase(field)) {
    return;
  }

  field.subfields.forEach(sf => subfieldLowercase(sf, field.tag));

  function skipFieldLowercase(field) {
    if (skipAllFieldNormalizations(field.tag)) {
      return true;
    }
    // Skip non-interesting fields
    if (!containsHumanName(field.tag) && !containsCorporateName(field.tag) && !['240', '245', '630'].includes(field.tag)) {
      return true;
    }

    return false;
  }
}

/*
export function lowercaseSubfieldValue(value, tag, subfieldCode) {
  if (isControlSubfieldCode(subfieldCode)) {
    return value;
  }
  if (tag === 'LOW' || tag === 'SID') { // Bit hacky
    return value;
  }
  return value.toLowerCase();
}
*/

function normalizeField(field) {
  //sf.value = removeDecomposedDiacritics(sf.value); // eslint-disable-line functional/immutable-data
  fieldStripPunctuation(field);
  fieldLowercase(field);
  fieldNormalizeControlNumbers(field); // FIN11 vs FI-MELINDA etc.
  return field;
}


function fieldRemoveDecomposedDiacritics(field) {
  // Raison d'être/motivation: "Sirén" and diacriticless "Siren" might refer to a same surname, so this normalization
  // allows us to compare authors and avoid duplicate fields.
  field.subfields.forEach((sf) => {
    sf.value = removeDecomposedDiacritics(sf.value); // eslint-disable-line functional/immutable-data
  });
}

function removeDecomposedDiacritics(value = '') {
  // NB #1: Does nothing to precomposed letters. Do String.normalize('NFD') first, if you want to handle them.
  // NB #2: Finnish letters 'å', 'ä', 'ö', 'Å', Ä', and 'Ö' should be handled (=precomposed) before calling this. (= keep them as is)
  // NB #3: Calling our very own fixComposition() before this function handles both #1 and #2.
  return String(value).replace(/\p{Diacritic}/gu, '');
}


function normalizeSubfieldValue(value, subfieldCode, tag) {
  const intermediateValue1 = subfieldValueLowercase(value, subfieldCode, tag);
  // Not going to do these in the foreseeable future, but keeping them here for discussion:
  // Possible normalizations include but are not limited to:
  // ø => ö? Might be language dependent: 041 $a fin => ö, 041 $a eng => o?
  // Ø => Ö?
  // ß => ss
  // þ => th (NB! Both upper and lower case)
  // ...
  // Probably nots:
  // ü => y (probably not, though this correlates with Finnish letter-to-sound rules)
  // w => v (OK for Finnish sorting in certain cases, but we are not here, are we?)
  // I guess we should use decomposed values in code here. (Not sure what composition my examples above use.)
  return intermediateValue1;
}

export function cloneAndRemovePunctuation(field) {
  const clonedField = clone(field);
  fieldStripPunctuation(clonedField);
  debug('PUNC');
  debugFieldComparison(field, clonedField);

  return clonedField;
}

export function cloneAndNormalizeField(field) {
  // NB! This new field is for comparison purposes only.
  // Some of the normalizations might be considered a bit overkill for other purposes.
  const clonedField = normalizeField(clone(field));
  fieldStripPunctuation(clonedField);
  fieldRemoveDecomposedDiacritics(clonedField);

  clonedField.subfields.forEach((sf) => { // Do this for all fields or some fields?
    sf.value = normalizeSubfieldValue(sf.value, sf.code, field.tag); // eslint-disable-line functional/immutable-data
  });

  debugFieldComparison(field, clonedField); // For debugging purposes only

  return clonedField;
}


