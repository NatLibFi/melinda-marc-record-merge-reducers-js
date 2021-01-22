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
export function getRepCodes(fieldTag) {
  return getFieldSpecs(fieldTag).subfields
    .filter(sub => sub.repeatable === 'true')
    .map(sub => sub.code);
}
export function getNonRepCodes(fieldTag) {
  return getFieldSpecs(fieldTag).subfields
    .filter(sub => sub.repeatable === 'false')
    .map(sub => sub.code);
}

// Normalize subfield values for comparison, returns array of normalized subfields
export function normalizeSubfields(field) {
  const normalizedSubs = field.subfields
    .map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}));
  return normalizedSubs;
}

export function normalizeSubfieldValue(value) {
  // Regexp options: g: global search, u: unicode
  const punctuation = /[.,\-/#!?$%^&*;:{}=_`~()[\]]/gu;
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
  if (baseSubsNorm.length === equalSubfieldsBase.length &&
      sourceSubsNorm.length === equalSubfieldsSource.length &&
      equalSubfieldsBase.length === equalSubfieldsSource.length) {
    debug(`All compared subfields (${codes}) are equal`);
    return true;
  }
  debug(`All compared subfields (${codes}) are not equal`);
  return false;
}

// Get non-repeatable subfields to copy from source to base
// Filter out dropped and identifying subfields
export function getNonRepSubs(sourceField, nonRepCodes, dropCodes, idCodes) {
  const nonRepSubs = sourceField.subfields
    .filter(subfield => nonRepCodes
      .filter(code => dropCodes.indexOf(code) === -1 && idCodes.indexOf(code) === -1).indexOf(subfield.code) !== -1);
  return nonRepSubs;
}

// Get repeatable subfields to copy from source to base
export function getRepSubs(baseField, sourceField, repCodes, dropCodes, idCodes) {
  // First get all repeatable subfields and filter out dropped and identifying subfields
  const allRepSubs = sourceField.subfields
    .filter(subfield => repCodes
      .filter(code => dropCodes.indexOf(code) === -1 && idCodes.indexOf(code) === -1).indexOf(subfield.code) !== -1);
  //debug(`allRepSubs: ${JSON.stringify(allRepSubs, undefined, 2)}`);

  // Add temporary index property to array elements (subfields) to identify them even when values are normalized
  const allIndexedRepSubs = allRepSubs
    .map(sub => ({...sub, index: allRepSubs.indexOf(sub)}));
  //debug(`allIndexedRepSubs: ${JSON.stringify(allIndexedRepSubs, undefined, 2)}`);

  // Then filter out duplicates already existing in base
  const nonDupRepSubsNorm = filterDuplicates(baseField, allIndexedRepSubs);
  //debug(`nonDupRepSubsNorm: ${JSON.stringify(nonDupRepSubsNorm, undefined, 2)}`);

  function filterDuplicates(baseField, allIndexedRepSubs) {
    // Normalize subfield values for comparison
    const allIndexedRepSubsNorm = allIndexedRepSubs
      .map(({code, value, index}) => ({code, value: normalizeSubfieldValue(value), index}));
    //debug(`allIndexedRepSubsNorm: ${JSON.stringify(allIndexedRepSubsNorm, undefined, 2)}`);

    function strictEquality(subfieldA, subfieldB) {
      return subfieldA.code === subfieldB.code &&
      subfieldA.value === subfieldB.value;
    }
    // Get base subfields for which a matching subfield in source (allIndexedRepSubsNorm) is found
    /*const dupRepSubsBase = normalizeSubfields(baseField)
      .filter(baseSub => allIndexedRepSubsNorm
        .some(sourceSub => strictEquality(baseSub, sourceSub)));*/
    //debug(`Match in source found for normalized base subfield: ${JSON.stringify(dupRepSubsBase, undefined, 2)}`);

    // Get source subfields for which a matching base subfield is found
    const dupRepSubsSource = allIndexedRepSubsNorm
      .filter(sourceSub => normalizeSubfields(baseField)
        .some(baseSub => strictEquality(sourceSub, baseSub)));
    //debug(`Match in base found for normalized source subfield: ${JSON.stringify(dupRepSubsSource, undefined, 2)}`);

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
    .map(({code, value, index}) => ({code, value})); // eslint-disable-line no-unused-vars
  //debug(`nonDupRepSubsToCopy: ${JSON.stringify(nonDupRepSubsToCopy, undefined, 2)}`);
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
const alphabetical = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9'
];

export function sortSubfields(subfields, order = alphabetical, orderedSubfields = []) {
  //debug(`Order: ${order}`); // testing
  const [filter, ...rest] = order;
  if (filter === undefined) {
    return [...orderedSubfields, ...subfields];
  }
  //debug(`Subfield sort filter: ${JSON.stringify(filter)}`);
  //debug(`Subfields: ${JSON.stringify(subfields)}`);
  //debug(`Ordered subfields: ${JSON.stringify(orderedSubfields)}`);

  /* eslint-disable */
  const filtered = subfields.filter(sub => {
    if (typeof filter === 'string') {
      return sub.code === filter;
    }

  });
  //debug(`Filtered subfields: ${JSON.stringify(filtered, undefined, 2)}`);

  const restSubfields = subfields.filter(sub => {
    if (typeof filter === 'string') {
      return sub.code !== filter;
    }
  /* eslint-enable */
  });
  if (filtered.length > 0) {
    return sortSubfields(restSubfields, rest, [...orderedSubfields, ...filtered]);
  }
  return sortSubfields(restSubfields, rest, orderedSubfields);
}

// Process repeatable field
// ###Tarvitaanko tänne vai kustomoituna joka reduceriin oma?
export function repeatableField(base, tagString, baseField, sourceField, repCodes, nonRepCodes) {
  debug(`Working on field ${tagString}`);
  // First check whether the values of identifying subfields are equal
  // 020: $a (ISBN)
  const idCodes = ['a'];

  // Case 1: If all identifying subfield values are not equal the entire source field is copied to base as a new field
  if (compareAllSubfields(baseField, sourceField, idCodes) === false) {
    //debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);
    base.insertField(sourceField);
    debug(`Base after copying: ${JSON.stringify(base, undefined, 2)}`);
    debug(`Field ${tagString}: One or more subfields (${idCodes}) not matching, source field copied as new field to Melinda`);
    return base; // Base record returned in case 1
  }

  // Case 2: If identifying subfield values are equal, continue with the merge process
  debug(`Field ${tagString}: Matching subfields (${idCodes}) found in source and Melinda, continuing with merge`);

  // If there are subfields to drop, define them first
  // 020: $c
  const dropCodes = ['c'];

  // Copy other subfields from source field to base field
  // For non-repeatable subfields, the value existing in base (Melinda) is preferred
  // Non-repeatable subfields are copied from source only if missing completely in base
  // 020: $a, $c, $6 (but $a was already checked and $c dropped, so only $6 is copied here)
  const nonRepSubsToCopy = getNonRepSubs(sourceField, nonRepCodes, dropCodes, idCodes);
  //debug(`nonRepSubsToCopy: ${JSON.stringify(nonRepSubsToCopy, undefined, 2)}`);

  // Repeatable subfields are copied if the value is different
  // 020: $q, $z, $8
  const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes, dropCodes, idCodes);
  //debug(`repSubsToCopy: ${JSON.stringify(repSubsToCopy, undefined, 2)}`);

  // Create modified base field and replace old base record in Melinda with it (exception to general rule of data immutability)
  // Subfields in the modified base field are arranged by default in alphabetical order (a-z, 0-9)
  // To use a custom sorting order, set it as the second parameter in sortSubfields
  const modifiedBaseField = JSON.parse(JSON.stringify(baseField));
  const sortedSubfields = sortSubfields([...baseField.subfields, ...nonRepSubsToCopy, ...repSubsToCopy]);
  /* eslint-disable functional/immutable-data */
  modifiedBaseField.subfields = sortedSubfields;
  modifyBaseField(base, baseField, modifiedBaseField);
  debug(`Base after modification: ${JSON.stringify(base, undefined, 2)}`);
  return base; // Base record returned in case 2
}

// Process non-repeatable field
export function nonRepeatableField(base, tagString, baseFields, sourceFields) {
  // If the field is missing completely from base, it is copied as a new field
  if (baseFields.length === 0) {
    debug(`Missing field ${tagString} copied from source to Melinda`);
    sourceFields.forEach(f => base.insertField(f));
    return base;
  }
  // Otherwise the original base field is kept
  return base;
}
