import {normalizeSync} from 'normalize-diacritics';
import createDebugLogger from 'debug';
import clone from 'clone';
import { fieldStripPunctuation } from './punctuation.js';
import { fieldToString, isControlSubfieldCode, subfieldsAreIdentical } from './utils.js';

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

function fixComposition(value) {
    // Target: Diacritics use Melinda internal notation.
    // General solution: Decompose everything and then compose 'å', 'ä', 'ö', 'Å', 'Ä' and 'Ö'.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
    // Bug/Feature: the generic normalize() function also normalizes non-latin encodings as well.
    // Exception: Input contains non-Latin script letters: don't decompose:
    if ( value.match(/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u) ) {
        // Problem with this approach: mixed language content (eg. cyrillic + latin) won't get normalized. 
        // Hack/Damage control: we might add decomposition rules for most common diacritis here (eg. ü, é...)-
        // NB! Hack not implemented yet.
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
      if ( subfield.code !== 'd' ) { return false; }
      debug(`INSPECT \$d '${subfield.value}'`);
      if ( !notYear.test(subfield.value) ) {
        return false;
      }
      debug(`MATCH \$d '${subfield.value}`);
      return true;
  }
}

function dontLowercase(tag, subfieldCode) {
    if ( isControlSubfieldCode(subfieldCode) ) { return true; }
    // (Used mostly when merging subfields (as if normalized version exists, adding new subfield is skipped.)
    return false;
}

function fieldLowercase(field) {
    // Skip non-interesting fields
    if ( !['100', '110', '240', '245', '600', '610', '630', '700', '710', '800', '810'].includes(field.tag) ) {
        return;
    }
    field.subfields.forEach(sf => {
        if ( isControlSubfieldCode(sf.code)) { return; }
        sf.value = sf.value.toLowerCase(); // eslint-disable-line functional/immutable-data
    });
}

function fieldPreprocess(field) {
    //// 1. Fix composition
    // I don't want to use normalizeSync(). "åäö" => "aao". Utter crap! NB: Use something else later on!
    fieldFixComposition(field);
    //// 2. Fix other shit
    // - remove crappy 100$d subfields:
    fieldRemoveDatesAssociatedWithName(field); // eg. "100$d (1)"
    field.subfields.forEach((sf, i) => {
        // TODO
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
    fieldPreprocess(field); // spacing, composition, remap wrong utf-8 characters
    fieldStripPunctuation(field);
    fieldLowercase(field);
    return field;
}

function fieldComparison(oldField, newField) {
    if ( oldField.subfields.length == newField.subfields.length ) {
        oldField.subfields.forEach((subfield, index) => {
            const newValue = newField.subfields[index].value;
            if ( subfield.value !== newValue ) {
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

    fieldComparison(field, clonedField);

    return clonedField;
}


export function cloneAndNormalizeField(field) {
    const clonedField = normalizeField(clone(field));

    fieldComparison(field, clonedField);

    return clonedField;
}

export function fieldFixComposition(field) {
    if ( !field.subfields ) { return field; }
    const originalValue = fieldToString(field);
    field.subfields.forEach((subfield, index) => field.subfields[index].value = fixComposition(subfield.value));
    const newValue = fieldToString(field);
    if ( originalValue !== newValue ) {
        debug(`FIXCOMP: '${originalValue}' => '${newValue}'`);
    }
    return field;
}

export function recordFixComposition(record) {
    if ( !record.fields ) { return record; }
    record.fields.forEach((field, index) => record.fields[index] = fieldFixComposition(field));
    return record;
}

 export function recordPreprocess(record) {
    if ( !record.fields ) { return record; }
    record.fields.forEach((field, index) => fieldPreprocess(field));
    return record;
 }