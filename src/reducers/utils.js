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

export function strictEquality(subfieldA, subfieldB) {
  return subfieldA.code === subfieldB.code &&
  subfieldA.value === subfieldB.value;
}

// Compare base and source subfield arrays defined by the given array of subfield codes
// Returns true if all compared subfields are equal
export function compareSubfields(baseField, sourceField, codes) {
  const baseSubsNormComp = baseField.subfields
    .filter(subfield => codes.indexOf(subfield.code) !== -1)
    .map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}));
  const sourceSubsNormComp = sourceField.subfields
    .filter(subfield => codes.indexOf(subfield.code) !== -1)
    .map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}));
  debug(`baseSubsNormComp: ${JSON.stringify(baseSubsNormComp, undefined, 2)}`);
  debug(`sourceSubsNormComp: ${JSON.stringify(sourceSubsNormComp, undefined, 2)}`);

  // Returns the base subfields for which a matching source subfield is found
  const equalSubfieldsBase = baseSubsNormComp
    .filter(baseSubfield => sourceSubsNormComp
      .some(sourceSubfield => strictEquality(baseSubfield, sourceSubfield)));
  debug(`equalSubfieldsBase: ${JSON.stringify(equalSubfieldsBase, undefined, 2)}`);

  // Returns the source subfields for which a matching base subfield is found
  const equalSubfieldsSource = sourceSubsNormComp
    .filter(sourceSubfield => baseSubsNormComp
      .some(baseSubfield => strictEquality(sourceSubfield, baseSubfield)));
  debug(`equalSubfieldsSource: ${JSON.stringify(equalSubfieldsSource, undefined, 2)}`);

  debug(`baseSubsNormComp.length: ${baseSubsNormComp.length}`);
  debug(`sourceSubsNormComp.length: ${sourceSubsNormComp.length}`);
  debug(`equalSubfieldsBase.length: ${equalSubfieldsBase.length}`);
  debug(`equalSubfieldsSource.length: ${equalSubfieldsSource.length}`);

  // If the same number of matches is found both ways, all compared subfields are equal
  if (baseSubsNormComp.length === equalSubfieldsBase.length
      && sourceSubsNormComp.length === equalSubfieldsSource.length
      && equalSubfieldsBase.length === equalSubfieldsSource.length) {
    debug(`All compared subfields are equal`);
    return true;
  }
  debug(`All compared subfields are not equal`);
  return false;
}

// Modify existing base field in Melinda
export function modifyBaseField(base, baseField, modifiedField) {
  const index = base.fields.findIndex(field => field === baseField);
  base.fields.splice(index, 1, modifiedField); // eslint-disable-line functional/immutable-data
  debug(`Adding new subfields to ${baseField.tag}`);
  return base;
}
