import createDebugLogger from 'debug';
import clone from 'clone';
import {fieldStripPunctuation} from './punctuation.js';
import {fieldToString, isControlSubfieldCode} from './utils.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

function precomposeFinnishLetters(value) {
  return value.
    replace(/å/gu, 'å').
    replace(/ä/gu, 'ä').
    replace(/ö/gu, 'ö').
    replace(/Å/gu, 'Å').
    replace(/Ä/gu, 'Ä').
    replace(/Ö/gu, 'Ö');
}

/*
function normalizationExceptions(value) {
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
function removeDecomposedDiacritics(value) {
  // NB #1: Does nothing to precomposed letters. String.normalize('NFD') can handle them.
  // NB #2: Finnish letters 'å', 'ä', 'ö', 'Å', Ä', and 'Ö' should be handled before this.
  // NB #3: Calling our very own fixComposition() before this function handles both #1 and #2.
  return String(value).replace(/\p{Diacritic}/gu, '');
}

function fixComposition(value) {
  // Target: Diacritics use Melinda internal notation.
  // General solution: Decompose everything and then compose 'å', 'ä', 'ö', 'Å', 'Ä' and 'Ö'.
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
  // Bug/Feature: the generic normalize() function also normalizes non-latin encodings as well.    // Exception: Input contains non-Latin script letters: don't decompose:
  if (value.match(/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u)) {
    // Problem with this approach: mixed language content (eg. cyrillic + latin) won't get normalized.
    // Hack/Damage control: we might add decomposition rules for most common diacritis here (eg. ü, é...).
    // OR we could split input to words and handle them separately?
    // NB! Hack not implemented yet. The main source of problematic case would probably be greek characters
    // within texts, that are written with latin alphabet.
    return precomposeFinnishLetters(value);
  }
  return precomposeFinnishLetters(String(value).normalize('NFD'));
}

// NB! These are defined also in mergeSubfield.js. Do something...
const notYear = /^\([1-9][0-9]*\)[,.]?$/u;

function fieldRemoveDatesAssociatedWithName(field) {
  // Skip irrelevant fields:
  if (!field.tag.match(/^[1678]00$/u)) {
    return field;
  }
  field.subfields = field.subfields.filter(sf => !isIndexNotDate(sf)); // eslint-disable-line functional/immutable-data
  return field;

  function isIndexNotDate(subfield) {
    if (subfield.code !== 'd') {
      return false;
    }
    debug(`INSPECT $d '${subfield.value}'`);
    if (!notYear.test(subfield.value)) {
      return false;
    }
    debug(`MATCH $d '${subfield.value}`);
    return true;
  }
}

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

function fieldRemoveDecomposedDiacritics(field) {
  field.subfields.forEach((sf) => {
    sf.value = removeDecomposedDiacritics(sf.value); // eslint-disable-line functional/immutable-data
  });
}

function fieldPreprocess(field) {
  //// 1. Fix composition
  // I don't want to use normalizeSync(). "åäö" => "aao". Utter crap! NB: Use something else later on!
  fieldFixComposition(field);
  //// 2. Fix other shit
  // - remove crappy 100$d subfields:
  fieldRemoveDatesAssociatedWithName(field); // eg. "100$d (1)"
  field.subfields.forEach(sf => {
    // Things to do:
    // 2. Fix other shit
    // - normalize non-breaking space etc whitespace characters
    // - normalize various '-' letters?
    // - normalize various copyright signs
    // - FIN01 vs (FI-MELINDA)...
    // - remove 020$c? This one is a bit tricky, since it often contains non-price information...
    // 3. Trim
    sf.value.replace(/\s+/gu, ' ').trim(); // eslint-disable-line functional/immutable-data
  });
  return field;
}


function normalizeField(field) {
  fieldPreprocess(field); // spacing, composition, diacritics, remap wrong utf-8 characters (eg. various - characters)
  //sf.value = removeDecomposedDiacritics(sf.value); // eslint-disable-line functional/immutable-data
  fieldStripPunctuation(field);
  fieldLowercase(field);
  return field;
}

function fieldComparison(oldField, newField) {
  if (oldField.subfields.length === newField.subfields.length) {
    oldField.subfields.forEach((subfield, index) => {
      const newValue = newField.subfields[index].value;
      if (subfield.value !== newValue) { // eslint-disable-line functional/no-conditional-statement
        debug(`NORMALIZE: '${subfield.value}' => '${newValue}'`);
      }
    });
    return;
  }
  debug(`NORMALIZE: '${fieldToString(oldField)}' => '${fieldToString(newField)}'`);
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
  debug('NORM');
  fieldComparison(field, clonedField);

  return clonedField;
}

export function fieldFixComposition(field) {
  if (!field.subfields) {
    return field;
  }
  const originalValue = fieldToString(field);
  field.subfields.forEach((subfield, index) => {
    field.subfields[index].value = fixComposition(subfield.value); // eslint-disable-line functional/immutable-data
  });
  const newValue = fieldToString(field);
  if (originalValue !== newValue) { // eslint-disable-line functional/no-conditional-statement
    debug(`FIXCOMP: '${originalValue}' => '${newValue}'`);
  }
  return field;
}

export function recordFixComposition(record) {
  if (!record.fields) {
    return record;
  }
  record.fields.forEach((field, index) => {
    record.fields[index] = fieldFixComposition(field); // eslint-disable-line functional/immutable-data
  });
  return record;
}

export function recordPreprocess(record) {
  if (!record.fields) {
    return record;
  }
  record.fields.forEach(field => fieldPreprocess(field));
  return record;
}


function normalizeFIN01(value) {
  if ((/^\(FI-MELINDA\)[0-9]{9}$/u).test(value)) {
    return `(FIN01)${value.substring(12)}`; // eslint-disable-line functional/immutable-data
  }
  if ((/^FCC[0-9]{9}$/u).test(value)) {
    return `(FIN01)${value.substring(3)}`; // eslint-disable-line functional/immutable-data
  }
  return value;
}

function normalizeFIN11(value) {
  if ((/^\(FI-ASTERI-N\)[0-9]{9}$/u).test(value)) {
    return `(FIN11)${value.substring(13)}`; // eslint-disable-line functional/immutable-data
  }
  if ((/^https?:\/\/urn\.fi\/URN:NBN:fi:au:finaf:[0-9]{9}$/u).test(value)) {
    return `(FIN11)${value.slice(-9)}`;
  }
  return value;
}

export function normalizeSubfield0Value(value) {
  const fin01 = normalizeFIN01(value);
  if (fin01 !== value) {
    return fin01;
  }
  if ((/^\(FI-MELINDA\)[0-9]{9}$/u).test(value)) {
    return `(FIN01)${value.substring(12)}`;
  }
  if ((/^\(FI-ASTERI-S\)[0-9]{9}$/u).test(value)) {
    return `(FIN10)${value.substring(13)}`;
  }
  const fin11 = normalizeFIN11(value);
  if (fin11 !== value) {
    return fin11;
  }
  if ((/^\(FI-ASTERI-A\)[0-9]{9}$/u).test(value)) {
    return `(FIN12)${value.substring(13)}`;
  }
  if ((/^\(FI-ASTERI-W\)[0-9]{9}$/u).test(value)) {
    return `(FIN13)${value.substring(13)}`;
  }
  // NB! we could/should normalize isni to uri...
  return value;
}
