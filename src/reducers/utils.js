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
export function compareAllSubfields(baseField, sourceField, codes) {
  const baseSubsNorm = baseField.subfields
    .filter(subfield => codes.indexOf(subfield.code) !== -1)
    .map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}));
  const sourceSubsNorm = sourceField.subfields
    .filter(subfield => codes.indexOf(subfield.code) !== -1)
    .map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}));

  // Get base subfields for which a matching source subfield is found
  const equalSubfieldsBase = baseSubsNorm
    .filter(baseSub => sourceSubsNorm
      .some(sourceSub => strictEquality(baseSub, sourceSub)));
  //debug(`equalSubfieldsBase: ${JSON.stringify(equalSubfieldsBase, undefined, 2)}`);

  // Get source subfields for which a matching base subfield is found
  const equalSubfieldsSource = sourceSubsNorm
    .filter(sourceSub => baseSubsNorm
      .some(baseSub => strictEquality(sourceSub, baseSub)));
  //debug(`equalSubfieldsSource: ${JSON.stringify(equalSubfieldsSource, undefined, 2)}`);

  // If the same number of matches is found both ways, all compared subfields are equal
  if (baseSubsNorm.length === equalSubfieldsBase.length
      && sourceSubsNorm.length === equalSubfieldsSource.length
      && equalSubfieldsBase.length === equalSubfieldsSource.length) {
    debug(`All compared subfields are equal`);
    return true;
  }
  debug(`All compared subfields are not equal`);
  return false;
}

// Get non-repeatable subfields to copy from source to base
// Filter out dropped and identifying subfields
export function getNonRepSubs(sourceField, nonRepCodes, dropCodes, idCodes) {
  const nonRepSubs = sourceField.subfields
  .filter(subfield => nonRepCodes
    .filter(code => (dropCodes.indexOf(code) === -1) && (idCodes.indexOf(code) === -1)).indexOf(subfield.code) !== -1);
  return nonRepSubs;
}

// Get repeatable subfields to copy from source to base
export function getRepSubs(baseField, sourceField, repCodes, dropCodes, idCodes) {
  // First get all repeatable subfields and filter out dropped and identifying subfields
  const allRepSubs = sourceField.subfields
    .filter(subfield => repCodes
      .filter(code => (dropCodes.indexOf(code) === -1) && (idCodes.indexOf(code) === -1)).indexOf(subfield.code) !== -1);
  debug(`allRepSubs: ${JSON.stringify(allRepSubs, undefined, 2)}`);

  // Add temporary index property to array elements (subfields) to identify them even when values are normalized
  const allIndexedRepSubs = allRepSubs
    .map(sub => ({...sub, index: allRepSubs.indexOf(sub)}));
  debug(`allIndexedRepSubs: ${JSON.stringify(allIndexedRepSubs, undefined, 2)}`);

  // Then filter out duplicates already existing in base
  const nonDupRepSubsNorm = filterDuplicates(baseField, allIndexedRepSubs);
  debug(`nonDupRepSubsNorm: ${JSON.stringify(nonDupRepSubsNorm, undefined, 2)}`);

  function filterDuplicates(baseField, allIndexedRepSubs) {
    // Normalize subfield values for comparison
    const allIndexedRepSubsNorm = allIndexedRepSubs
      .map(({code, value, index}) => ({code, value: normalizeSubfieldValue(value), index}));
    debug(`allIndexedRepSubsNorm: ${JSON.stringify(allIndexedRepSubsNorm, undefined, 2)}`);

    function strictEquality(subfieldA, subfieldB) {
      return subfieldA.code === subfieldB.code &&
      subfieldA.value === subfieldB.value;
    }
    // Get base subfields for which a matching subfield in source (allIndexedRepSubsNorm) is found
    const dupRepSubsBase = normalizeSubfields(baseField)
      .filter(baseSub => allIndexedRepSubsNorm
        .some(sourceSub => strictEquality(baseSub, sourceSub)));
    debug(`Match in source found for normalized base subfield: ${JSON.stringify(dupRepSubsBase, undefined, 2)}`);

    // Get source subfields for which a matching base subfield is found
    const dupRepSubsSource = allIndexedRepSubsNorm
      .filter(sourceSub => normalizeSubfields(baseField)
        .some(baseSub => strictEquality(sourceSub, baseSub)));
    debug(`Match in base found for normalized source subfield: ${JSON.stringify(dupRepSubsSource, undefined, 2)}`);

    // Returns an array of non-duplicate repeatable subfields from source
    // Subfields still include the temporary index property and values are normalized
    const result = allIndexedRepSubsNorm
      .filter(sub => dupRepSubsSource
          .map(sub => sub.value).indexOf(sub.value) === -1);
    return result;
  }

  // Get the non-normalized versions of non-duplicate repeatable subfields
  // Drop the temporary index property
  const nonDupRepSubsToCopy = allIndexedRepSubs
    .filter(sub => nonDupRepSubsNorm
      .map(sub => sub.index).indexOf(sub.index) !== -1)
        .map(({code, value, index}) => ({code, value}));
  debug(`nonDupRepSubsToCopy: ${JSON.stringify(nonDupRepSubsToCopy, undefined, 2)}`);
  return nonDupRepSubsToCopy;
}

// Modify existing base field in Melinda
export function modifyBaseField(base, baseField, modifiedField) {
  const index = base.fields.findIndex(field => field === baseField);
  base.fields.splice(index, 1, modifiedField); // eslint-disable-line functional/immutable-data
  debug(`Adding new subfields to field ${baseField.tag}`);
  return base;
}

// Sort subfields by default in alphabetical order (a-z, 0-9)
const sortOrder = [
  'a','b','c','d','e',
  'f','g','h','i','j',
  'k','l','m','n','o',
  'p','q','r','s','t',
  'u','v','w','x','y','z',
  '0','1','2','3','4',
  '5','6','7','8','9'];
export function sortSubfields(subfields, order = sortOrder, orderedSubfields = []) {
  debug(`Order: ${order}`); // testing
  const [filter, ...rest] = order;
  if (filter === undefined) {
    return [...orderedSubfields, ...subfields];
  }
  debug(`Subfield sort filter: ${JSON.stringify(filter)}`);
  debug(`Subfields: ${JSON.stringify(subfields)}`);
  debug(`Ordered subfields: ${JSON.stringify(orderedSubfields)}`);

  const filtered = subfields.filter(sub => {
    if (typeof filter === 'string') {
        return sub.code === filter;
    }
    return;
//    return sub.code === filter && new RegExp(filter, 'u').test(sub.value);
//    return sub.code === filter.code && new RegExp(filter.value, 'u').test(sub.value);
  });
  debug(`Filtered subfields: ${JSON.stringify(filtered, undefined, 2)}`);

  const restSubfields = subfields.filter(sub => {
    if (typeof filter === 'string') {
      return sub.code !== filter;
    }
    return;
//    return sub.code !== filter && !new RegExp(filter, 'u').test(sub.value);
//    return sub.code !== filter.code && !new RegExp(filter.value, 'u').test(sub.value);
  });
if (filtered.length > 0) {
    return sortSubfields(restSubfields, rest, [...orderedSubfields, ...filtered]);
  }
  return sortSubfields(restSubfields, rest, orderedSubfields);
}

