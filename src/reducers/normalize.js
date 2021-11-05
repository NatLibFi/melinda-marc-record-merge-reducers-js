import {normalizeSync} from 'normalize-diacritics';
import createDebugLogger from 'debug';
import { fieldsAreIdentical } from './utils';
import clone from 'clone';
import { fieldStripPunctuation } from './punctuation';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

function conditionallyLowercase(tag, subfieldcode, value){
    return value.toLowerCase();
}

function removePunctuation(tag, subfieldCode, value) {

  
    //return value;
    //const punctuation = /[.,\-/#!?$%^&*;:{}=_`~()[\]]/gu;
    return value; // value.replace(punctuation, '', 'u');
}

function normalizeField(field) {
    fieldStripPunctuation(field);

    field.subfields = normalizeSubfields(field); // eslint-disable-line functional/immutable-data
    return field;
}

export function cloneAndNormalizeField(field) {
    const clonedField = normalizeField(clone(field));

    field.subfields.forEach((value, index) => { 
        if ( field.subfields[index].value !== clonedField.subfields[index].value) {
            debug(`NORMALIZE: ${field.subfields[index].value} => ${clonedField.subfields[index].value}`);
        }
    });
    return clonedField;
}

// Normalize subfield values for comparison, returns array of normalized subfields (keep the original values)
export function normalizeSubfields(field) {
    const normalizedSubs = field.subfields
      .map(({code, value}) => ({code, value: normalizeStringValue(field.tag, code, value)}));

    return normalizedSubs;
}
  
export function normalizeStringValue(tag, subfieldCode, value) {
    if ( ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'w'].includes(subfieldCode) ) { return value; }
    // Regexp options: g: global search, u: unicode
    // Note: normalize-diacritics' nomalizeSync() also changes "äöå" to "aoa"
    return removePunctuation(tag, subfieldCode, conditionallyLowercase(tag, subfieldCode, normalizeSync(value))).replace(/\s+/gu, ' ').trim();
}
  