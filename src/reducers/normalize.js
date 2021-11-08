import {normalizeSync} from 'normalize-diacritics';
import createDebugLogger from 'debug';
import clone from 'clone';
import { fieldStripPunctuation } from './punctuation.js';
import { fieldToString, isControlSubfieldCode, subfieldsAreIdentical } from './utils.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');


function fixComposition(value) {
    // Target: Diacritics use Melinda internal notation.
    // Solution: Decompose everything and then compose 'å', 'ä', 'ö', 'Å', 'Ä' and 'Ö'.
    return String(value).normalize('NFD').
        replace(/å/gu, 'å').
        replace(/ä/gu, 'ä').
        replace(/ö/gu, 'ö').
        replace(/Å/gu, 'Å').
        replace(/Ä/gu, 'Ä').
        replace(/Ö/gu, 'Ö');

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
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
    field.subfields.forEach((sf, i) => {
        // TODO
        // 1. Fix composition
         // I don't want to use normalizeSync(). "åäö" => "aao". Utter crap! NB: Use something else later on!
        //sf.value = normalizeSync(sf.value);
        fieldFixComposition(field);
        // 2. Fix other shit
        // - non-breaking space etc whitespace characters
        // - various '-' letters?
        // - various copyright signs
        // 3. Trim
        sf.value.replace(/\s+/gu, ' ').trim(); // eslint-disable-line functional/immutable-data
    });
}


function normalizeField(field) {
    fieldPreprocess(field); // spacing, composition, remap wrong utf-8 characters
    fieldStripPunctuation(field);
    fieldLowercase(field);
    return field;
}

function fieldComparison(oldField, newField) {
    oldField.subfields.forEach((subfield, index) => {
        const newValue = newField.subfields[index].value;
        if ( subfield.value !== newValue ) {
            debug(`NORMALIZE: '${subfield.value}' => '${newValue}'`);
        }
    });
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

 