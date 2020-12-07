// Custom functions for Melinda merge

import fs from 'fs';
import path from 'path';
import {normalizeSync} from 'normalize-diacritics';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

// Get field specs from melindaCustomMergeFields.json
export function getFieldSpecs(fieldTag) {
  const melindaFields = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'melindaCustomMergeFields.json'), 'utf8'));
  const [fieldSpecs] = melindaFields.fields.filter(field => field.tag === fieldTag);
  return fieldSpecs;
}

// Normalize subfield values for comparison, returns array of normalized subfields
export function normalizeSubfields(field) {
  const normalizedSubs = field.subfields
  .map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}));
  return normalizedSubs;
}

export function normalizeSubfieldValue(value) {
  // Regexp options: g: global search, u: unicode
  const punctuation = /[.,\-/#!$%^&*;:{}=_`~()[\]]/gu;
  return normalizeSync(value).toLowerCase().replace(punctuation, '', 'u').replace(/\s+/gu, ' ').trim();
}

// Compare normalized subfield values between base and source fields
// Note: Subfields must be in the same order in base and source
// ###Jos tämä ei riitä, pitää keksiä funktio joka vertaa jokaista sourceValues-arvoa jokaiseen baseValues-arvoon ja katsoo löytyykö jostain kohtaa matchi
export function compareSubValues(codes, baseField, sourceField) {
  const baseValues = normalizeSubfields(baseField)
    .filter(subfield => codes.indexOf(subfield.code) !== -1)
    .map(sub => sub.value);
  const sourceValues = normalizeSubfields(sourceField)
    .filter(subfield => codes.indexOf(subfield.code) !== -1)
    .map(sub => sub.value);
  debug(`baseValues: ${JSON.stringify(baseValues, undefined, 2)}`);
  debug(`sourceValues: ${JSON.stringify(sourceValues, undefined, 2)}`);
  if (sourceValues.every((val, index) => val === baseValues[index]) === true) {
    return true;
  }
  return false;
}

// Modify existing base field in Melinda
export function modifyBaseField(base, baseField, modifiedField) {
  const index = base.fields.findIndex(field => field === baseField);
  base.fields.splice(index, 1, modifiedField); // eslint-disable-line functional/immutable-data
  debug(`Adding new subfields to ${baseField.tag}`);
  return base;
}
