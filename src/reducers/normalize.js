import {normalizeSync} from 'normalize-diacritics';
import createDebugLogger from 'debug';
import clone from 'clone';
import { fieldStripPunctuation } from './punctuation.js';
import { fieldToString, isControlSubfieldCode } from './utils.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

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



 