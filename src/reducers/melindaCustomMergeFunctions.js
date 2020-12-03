// Custom functions for Melinda merge

import fs from 'fs';
import path from 'path';
import {normalizeSync} from 'normalize-diacritics';

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

  function normalizeSubfieldValue(value) {
    // Regexp options: g: global search, u: unicode
    const punctuation = /[.,\-/#!$%^&*;:{}=_`~()[\]]/gu;
    return normalizeSync(value).toLowerCase().replace(punctuation, '', 'u').replace(/\s+/gu, ' ').trim();
  }
  return normalizedSubs;
}


