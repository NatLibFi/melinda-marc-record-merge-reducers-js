import fs from 'fs';
import path from 'path';
import {normalizeSync} from 'normalize-diacritics';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

// Get field tags for use in other functions
export function getTags(fields) {
  const tags = fields.map(field => field.tag);
  // If there is only one field = one tag in the array, it is returned as string
  if (tags.length === 1) {
    const [tagString] = tags;
    debug(`### tagString from getTags: ${tagString}`);
    return tagString;
  }
  // If there are several fields, return an array of tags
  debug(`### tags from getTags: ${JSON.stringify(tags, undefined, 2)}`);
  return tags;
}

// Quick identicalness check
// Returns true if base and source are completely identical in stringified form
// Fields do not have to be in the same order
export function checkIdenticalness(baseFields, sourceFields) {
  const baseStrings = baseFields.map(field => JSON.stringify(field))
    .map(baseString => baseString.normalize());
  debug(`### baseStrings: ${JSON.stringify(baseStrings, undefined, 2)}`);
  const sourceStrings = sourceFields.map(field => JSON.stringify(field))
    .map(sourceString => sourceString.normalize());
  debug(`### sourceStrings: ${JSON.stringify(sourceStrings, undefined, 2)}`);

  // https://stackoverflow.com/questions/6229197/how-to-know-if-two-arrays-have-the-same-values

  function containsAll(arr1, arr2) {
    const result = arr2.every(arr2Item => arr1.includes(arr2Item));
    debug(`### containsAll result: ${JSON.stringify(result, undefined, 2)}`);
    return result;
  }
  function sameMembers(arr1, arr2) {
    const result = containsAll(arr1, arr2) && containsAll(arr2, arr1);
    debug(`### sameMembers result: ${JSON.stringify(result, undefined, 2)}`);
    return result;
  }
  const result = sameMembers(baseStrings, sourceStrings);
  debug(`### result: ${result}`);
  const baseTags = baseFields.map(field => field.tag);
  if (result === true) {
    baseTags.forEach(tag => debug(`Field ${tag}: base and source identical, keeping base`));
  }
  return result;
}

// Get field specs from melindaCustomMergeFields.json
export function getFieldSpecs(tag) {
  const melindaFields = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'melindaCustomMergeFields.json'), 'utf8'));
  const [fieldSpecs] = melindaFields.fields.filter(field => field.tag === tag);
  return fieldSpecs;
}
export function getRepCodes(tag) {
  return getFieldSpecs(tag).subfields
    .filter(sub => sub.repeatable === 'true')
    .map(sub => sub.code);
}
export function getNonRepCodes(tag) {
  return getFieldSpecs(tag).subfields
    .filter(sub => sub.repeatable === 'false')
    .map(sub => sub.code);
}

// Normalize subfield values for comparison, returns array of normalized subfields
export function normalizeSubfields(field) {
  const normalizedSubs = field.subfields
    .map(({code, value}) => ({code, value: normalizeStringValue(value)}));
  return normalizedSubs;
}

export function normalizeStringValue(value) {
  // Regexp options: g: global search, u: unicode
  // Note: normalize-diacritics also changes "äöå" to "aoa"
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
    .map(({code, value}) => ({code, value: normalizeStringValue(value)}));
  const sourceSubsNorm = sourceField.subfields
    .filter(subfield => codes.indexOf(subfield.code) !== -1)
    .map(({code, value}) => ({code, value: normalizeStringValue(value)}));

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
    codes.forEach(code => debug(`Subfield (${code}): all equal in source and base`));
    return true;
  }
  codes.forEach(code => debug(`Subfield (${code}): not equal in source and base`));
  return false;
}

// Get non-repeatable subfields to copy from source to base
// Filter out dropped and identifying subfields, if given
export function getNonRepSubs(sourceField, nonRepCodes, dropCodes = [], idCodes = []) {
  const nonRepSubs = sourceField.subfields
    .filter(subfield => nonRepCodes
      .filter(code => dropCodes.indexOf(code) === -1 && idCodes.indexOf(code) === -1).indexOf(subfield.code) !== -1);
  debug(`### nonRepSubs: ${JSON.stringify(nonRepSubs, undefined, 2)}`);
  return nonRepSubs;
}

// Get repeatable subfields to copy from source to base
export function getRepSubs(baseField, sourceField, repCodes, dropCodes = [], idCodes = []) {
  // First get all repeatable subfields and filter out dropped and identifying subfields, if given
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
      .map(({code, value, index}) => ({code, value: normalizeStringValue(value), index}));
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
  debug(`### nonDupRepSubsToCopy: ${JSON.stringify(nonDupRepSubsToCopy, undefined, 2)}`);
  return nonDupRepSubsToCopy;
}

// Modify existing base field in base
export function modifyBaseField(base, baseField, modifiedField) {
  const index = base.fields.findIndex(field => field === baseField);
  base.fields.splice(index, 1, modifiedField); // eslint-disable-line functional/immutable-data
  debug(`Adding new subfields to field ${baseField.tag}`);
  return base;
}

// Default subfield sort order if no custom order is given
const sortDefault = [
  '8',
  '6',
  '7',
  '3',
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
  '4',
  '2',
  '0',
  '1',
  '5',
  '9'
];

export function sortSubfields(subfields, order = sortDefault, orderedSubfields = []) {
  //debug(`### Order: ${order}`); // testing
  const [filter, ...rest] = order;
  if (filter === undefined) {
    return [...orderedSubfields, ...subfields];
  }
  //debug(`### Subfield sort filter: ${JSON.stringify(filter)}`);
  //debug(`### Subfields: ${JSON.stringify(subfields)}`);
  //debug(`### Ordered subfields: ${JSON.stringify(orderedSubfields)}`);

  /* eslint-disable */
  const filtered = subfields.filter(sub => {
    if (typeof filter === 'string') {
      return sub.code === filter;
    }

  });
  //debug(`### Filtered subfields: ${JSON.stringify(filtered, undefined, 2)}`);

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
