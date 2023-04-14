/*
  Note that this file contains very powerful normalizations and spells that are:
  - meant for comparing mergability of two fields (clone, normalize, compare),
  - and NOT for modifying the actual data!
*/
import clone from 'clone';
import {fieldStripPunctuation} from '@natlibfi/marc-record-validators-melinda/dist/punctuation2';
import {fieldToString, isControlSubfieldCode} from './utils.js';

//import {fieldNormalizeControlNumbers} from './normalizeIdentifier';
import {fieldNormalizeControlNumbers/*, normalizeControlSubfieldValue*/} from '@natlibfi/marc-record-validators-melinda/dist/normalize-identifiers';
import createDebugLogger from 'debug';
import {normalizePartData, subfieldContainsPartData} from './normalizePart.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:normalize');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

function debugFieldComparison(oldField, newField) { // NB: Debug-only function!
  /*
  // We may drop certain subfields:
  if (oldField.subfields.length === newField.subfields.length) { // eslint-disable-line functional/no-conditional-statement
    oldField.subfields.forEach((subfield, index) => {
      const newValue = newField.subfields[index].value;
      if (subfield.value !== newValue) { // eslint-disable-line functional/no-conditional-statement
        nvdebug(`NORMALIZE SUBFIELD: '${subfield.value}' => '${newValue}'`, debugDev);
      }
    });
  }
  */
  const oldString = fieldToString(oldField);
  const newString = fieldToString(newField);
  if (oldString === newString) {
    return;
  }
  //nvdebug(`NORMALIZE FIELD:\n '${fieldToString(oldField)}' =>\n '${fieldToString(newField)}'`, debugDev);
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
  // These may contain Roman Numerals...
  if (subfieldContainsPartData(tag, subfieldCode)) {
    return true;
  }

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
    //nvdebug(`SVL ${tag} $${subfieldCode} '${value}' =>`, debugDev);
    //nvdebug(`SVL ${tag} $${subfieldCode} '${newValue}'`, debugDev);
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


function hack490SubfieldA(field) {
  if (field.tag !== '490') {
    return;
  }
  field.subfields.forEach(sf => removeSarja(sf));

  // NB! This won't work, if the punctuation has not been stripped beforehand!
  function removeSarja(subfield) {
    if (subfield.code !== 'a') {
      return;
    }
    const tmp = subfield.value.replace(/ ?-(?:[a-z]|ä|ö)*sarja$/u, '');
    if (tmp.length > 0) {
      subfield.value = tmp; // eslint-disable-line functional/immutable-data
      return;
    }
  }
}


function subfieldRemoveHyphens(subfield, tag) {
  // Remove hyphens for comparison purposes from various ISBN subfields:
  if (subfield.code === 'z' && ['765', '767', '770', '772', '773', '774', '776', '777', '780', '785', '786', '787'].includes(tag)) {
    subfield.value = subfield.value.replace(/-/ug, ''); // eslint-disable-line functional/immutable-data
    return;
  }
}

function fieldRemoveHyphens(field) {
  field.subfields?.forEach(sf => subfieldRemoveHyphens(sf, field.tag));
}

function normalizeISBN(field) {
  if (!field.subfields || field.tag !== '020') {
    return;
  }

  //nvdebug(`ISBN-field? ${fieldToString(field)}`);
  field.subfields.forEach(sf => normalizeIsbnSubfield(sf));

  function normalizeIsbnSubfield(sf) {
    //nvdebug(` ISBN-subfield? ${subfieldToString(sf)}`);
    if (sf.code !== 'a') {
      return;
    }
    if (!sf.value.match(/^(?:[0-9]-?){9}(?:[0-9]-?[0-9]-?[0-9]-?)?[0-9Xx]$/u)) {
      return;
    }
    sf.value = sf.value.replace(/-/ug, ''); // eslint-disable-line functional/immutable-data
    sf.value = sf.value.replace(/x/u, 'X'); // eslint-disable-line functional/immutable-data
  }

}

function fieldSpecificHacks(field) {
  normalizeISBN(field); // 020$a, not $z!
  hack490SubfieldA(field);
  fieldRemoveHyphens(field);
}

export function fieldTrimSubfieldValues(field) {
  field.subfields?.forEach((sf) => {
    sf.value = sf.value.replace(/^[ \t\n]+/u, ''); // eslint-disable-line functional/immutable-data
    sf.value = sf.value.replace(/[ \t\n]+$/u, ''); // eslint-disable-line functional/immutable-data
    sf.value = sf.value.replace(/[ \t\n]+/gu, ' '); // eslint-disable-line functional/immutable-data
  });
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


export function normalizeSubfieldValue(value, subfieldCode, tag) {
  // NB! For comparison of values only
  /* eslint-disable */
  value = subfieldValueLowercase(value, subfieldCode, tag);

  // Normalize: s. = sivut = pp.
  value = normalizePartData(value, subfieldCode, tag);
  value = value.replace(/^\[([^[\]]+)\]/gu, '$1'); // eslint-disable-line functional/immutable-data, prefer-named-capture-group
  /* eslint-enable */

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
  return value;
}

export function cloneAndRemovePunctuation(field) {
  const clonedField = clone(field);
  if (fieldSkipNormalization(field)) {
    return clonedField;
  }
  fieldStripPunctuation(clonedField);
  fieldTrimSubfieldValues(clonedField);
  debugDev('PUNC');
  debugFieldComparison(field, clonedField);

  return clonedField;
}

function removeCharsThatDontCarryMeaning(value, tag) {
  if (tag === '080') {
    return value;
  }
  /* eslint-disable */
  // 3" refers to inches, but as this is for comparison only we don't mind...
  value = value.replace(/['"]/gu, '');
  /* eslint-enable */
  return value;
}


export function cloneAndNormalizeFieldForComparison(field) {
  // NB! This new field is for comparison purposes only.
  // Some of the normalizations might be considered a bit overkill for other purposes.
  const clonedField = normalizeField(clone(field));
  if (fieldSkipNormalization(field)) {
    return clonedField;
  }
  fieldStripPunctuation(clonedField);
  fieldRemoveDecomposedDiacritics(clonedField);
  fieldSpecificHacks(clonedField);
  fieldTrimSubfieldValues(clonedField);
  clonedField.subfields.forEach((sf) => { // Do this for all fields or some fields?
    sf.value = normalizeSubfieldValue(sf.value, sf.code, field.tag); // eslint-disable-line functional/immutable-data
    sf.value = removeCharsThatDontCarryMeaning(sf.value, field.tag);// eslint-disable-line functional/immutable-data

  });

  debugFieldComparison(field, clonedField); // For debugging purposes only

  return clonedField;
}

function fieldSkipNormalization(field) {
  if (['018', '066', '080', '083'].includes(field.tag)) {
    return true;
  }
  return false;
}
