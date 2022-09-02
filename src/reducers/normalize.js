import clone from 'clone';
import {fieldStripPunctuation} from './punctuation.js';
import {/*fieldToString,*/ isControlSubfieldCode} from './utils.js';

import {fieldNormalizeControlNumbers} from './normalizeIdentifier';
import {fieldPreprocess} from './hardcodedPreprocessor.js';
//import {getMaxSubfield6, reindexSubfield6s} from './reindexSubfield6.js';
//import {getMaxSubfield8, reindexSubfield8s} from './reindexSubfield8.js';
import createDebugLogger from 'debug';
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:normalize');

/*
// We might want something like this as:
function normalizationExceptions(value = "") {
  // This is just a placeholder for now.
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
*/

/*
function dontLowercase(tag, subfieldCode) {
  if (isControlSubfieldCode(subfieldCode)) {
    return true;
  }
  // (Used mostly when merging subfields (as if normalized version exists, adding new subfield is skipped.)
  return false;
}
*/

function fieldLowercase(field) {
  // Skip non-interesting fields
  if (!['100', '110', '240', '245', '600', '610', '630', '700', '710', '800', '810'].includes(field.tag)) {
    return;
  }
  field.subfields.forEach(sf => {
    if (isControlSubfieldCode(sf.code)) {
      return;
    }
    sf.value = sf.value.toLowerCase(); // eslint-disable-line functional/immutable-data
  });
}


function normalizeField(field) {
  fieldPreprocess(field); // spacing, composition, diacritics, remap wrong utf-8 characters (eg. various - characters)
  //sf.value = removeDecomposedDiacritics(sf.value); // eslint-disable-line functional/immutable-data
  fieldStripPunctuation(field);
  fieldLowercase(field);
  fieldNormalizeControlNumbers(field); // FIN11 vs FI-MELINDA etc.
  return field;
}

function fieldComparison(oldField, newField) { // NB: Debug-only function!
  //if (oldField.subfields.length === newField.subfields.length) {
  oldField.subfields.forEach((subfield, index) => {
    const newValue = newField.subfields[index].value;
    if (subfield.value !== newValue) { // eslint-disable-line functional/no-conditional-statement
      debug(`NORMALIZE: '${subfield.value}' => '${newValue}'`);
    }
  });
  return;
  //}
  //debug(`NORMALIZE: '${fieldToString(oldField)}' => '${fieldToString(newField)}'`);
}

export function cloneAndRemovePunctuation(field) {
  const clonedField = clone(field);
  fieldPreprocess(clonedField);
  fieldStripPunctuation(clonedField);
  debug('PUNC');
  fieldComparison(field, clonedField);

  return clonedField;
}

export function cloneAndNormalizeField(field) {
  const clonedField = normalizeField(clone(field));
  fieldRemoveDecomposedDiacritics(clonedField);
  fieldComparison(field, clonedField);

  return clonedField;
}


function fieldRemoveDecomposedDiacritics(field) {
  // Raison d'être/motivation: "Sirén" and diacriticless "Siren" might refer to a same surname, so this normalization
  // allows us to compare authors and avoid duplicate fields.
  field.subfields.forEach((sf) => {
    sf.value = removeDecomposedDiacritics(sf.value); // eslint-disable-line functional/immutable-data
  });

  function removeDecomposedDiacritics(value = '') {
    // NB #1: Does nothing to precomposed letters. Do String.normalize('NFD') first, if you want to handle them.
    // NB #2: Finnish letters 'å', 'ä', 'ö', 'Å', Ä', and 'Ö' should be handled (=precomposed) before calling this. (= keep them as is)
    // NB #3: Calling our very own fixComposition() before this function handles both #1 and #2.
    return String(value).replace(/\p{Diacritic}/gu, '');
  }
}

