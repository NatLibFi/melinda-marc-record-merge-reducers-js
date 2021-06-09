import {MarcRecord} from '@natlibfi/marc-record';
import {normalizeSync} from 'normalize-diacritics';
import createDebugLogger from 'debug';
import { isEqual } from 'lodash';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

// Get array of field tags for use in other functions
export function getTags(fields) {
  const tags = fields.map(field => field.tag);
  return tags;
}

// Modified from copy functionality in marc-record-merge
// Changed function name from checkIdenticalness to getNonIdenticalFields / SS 28.5.2021
export function getNonIdenticalFields(baseFields, sourceFields) {
  // Return array of non-identical fields (source fields not present in base)
  return sourceFields.filter(filterNonIdentical);

  function filterNonIdentical(sourceField) {
    if ('value' in sourceField) {
      debug(`Checking control field ${sourceField.tag} for identicalness`);
      return baseFields.some(isIdenticalControlField) === false;
    }
    if ('subfields' in sourceField) {
      debug(`Checking data field ${sourceField.tag} for identicalness`);
      return baseFields.some(isIdenticalDataField) === false;
    }

    // Used to normalize both control fields and subfields
    function normalizeItem(item) {
      return item.value.toLowerCase().replace(/\s+/u, '');
    }
    function isIdenticalControlField(baseField) {
      return normalizeItem(sourceField) === normalizeItem(baseField);
    }
    function isIdenticalDataField(baseField) {
      if (sourceField.tag === baseField.tag &&
          sourceField.ind1 === baseField.ind1 &&
          sourceField.ind2 === baseField.ind2 &&
          sourceField.subfields.length === baseField.subfields.length) {
        return baseField.subfields.every(isIdenticalSubfield);
      }
      function isIdenticalSubfield(baseSub) {
        return sourceField.subfields.some(sourceSub => normalizeItem(sourceSub) === normalizeItem(baseSub));
      }
    }
  }
}

function localFieldToString(f) {
  if ('subfields' in f) {
    return `${f.tag} ${f.ind1}${f.ind2} ‡${formatSubfields(f)}`;
  }
  return `${f.tag}    ${f.value}`;
  function formatSubfields(field) {
    return field.subfields.map(sf => `${sf.code}${sf.value || ''}`).join('‡');
  }
}
export function fieldToString(f) { // copied aped from marc-record-js
  return localFieldToString(f);
}

// NV: This function should be renamed to copyFields(base, fields) even if it is used by nonIdenticalFields
// SS: renamed from copyNonIdenticalFields(base, nonIdenticalFields) 1.6.2021
// Copy fields from source to base
// Used for non-identical fields
/*export function copyFields(base, fields) {
  fields.forEach(f => base.insertField(f));
  const tags = fields.map(field => field.tag);
  tags.forEach(tag => debug(`Field ${tag} copied from source to base`));
  return base;*/

// Copy all (typically non-identical in our context) fields from source to base
export function copyFields(record, fields) {
  fields.forEach(f => {
    debug(`Field ${fieldToString(f)} copied from source to base`);
    record.insertField(f);
  });
  // const tags = fields.map(field => field.tag);
  // tags.forEach(tag => debug('Field '+ mapDataField(copied from source to base`));
  return record;
}

// Get field specs from melindaCustomMergeFields.json
// This is not currently used, but keep it here in case field specs are needed
/*export function getFieldSpecs(tag) {
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
}*/

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
  return nonRepSubs;
}

// Get repeatable subfields to copy from source to base
export function getRepSubs(baseField, sourceField, repCodes, dropCodes = [], idCodes = []) {
  // First get all repeatable subfields and filter out dropped and identifying subfields, if given
  const allRepSubs = sourceField.subfields
    .filter(subfield => repCodes
      .filter(code => dropCodes.indexOf(code) === -1 && idCodes.indexOf(code) === -1).indexOf(subfield.code) !== -1);

  // Add temporary index property to array elements (subfields) to identify them even when values are normalized
  const allIndexedRepSubs = allRepSubs
    .map(sub => ({...sub, index: allRepSubs.indexOf(sub)}));

  // Then filter out duplicates already existing in base
  const nonDupRepSubsNorm = filterDuplicates(baseField, allIndexedRepSubs);

  function filterDuplicates(baseField, allIndexedRepSubs) {
    // Normalize subfield values for comparison
    const allIndexedRepSubsNorm = allIndexedRepSubs
      .map(({code, value, index}) => ({code, value: normalizeStringValue(value), index}));

    function strictEquality(subfieldA, subfieldB) {
      return subfieldA.code === subfieldB.code &&
      subfieldA.value === subfieldB.value;
    }

    // Get source subfields for which a matching base subfield is found
    const dupRepSubsSource = allIndexedRepSubsNorm
      .filter(sourceSub => normalizeSubfields(baseField)
        .some(baseSub => strictEquality(sourceSub, baseSub)));

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
  return nonDupRepSubsToCopy;
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

// Create new base field with custom array of sorted subfields
export function makeNewBaseField(base, baseField, sortedSubfields) {
  const newBaseField = JSON.parse(JSON.stringify(baseField));
  /* eslint-disable */
  newBaseField.subfields = sortedSubfields;
  base.removeField(baseField); // remove old baseField
  base.insertField(newBaseField); // insert newBaseField
  /* eslint-enable */
  return base;
}

/**
 * Select longer field
 * Longer means fulfilling either (but not both) of these conditions:
 *   a) Source has more subfields than base
 * Or if source and base have the same number of subfields:
 *   b) Subfield values in source are supersets of subfield values in base
 * */
export function selectLongerField(base, baseField, sourceField) {
  debug(`Comparing field ${baseField.tag}`);
  const baseSubs = baseField.subfields;
  const sourceSubs = sourceField.subfields;

  const baseSubsNormalized = baseSubs
    .map(({code, value}) => ({code, value: normalizeStringValue(value)}));

  const sourceSubsNormalized = sourceSubs
    .map(({code, value}) => ({code, value: normalizeStringValue(value)}));

  // Returns the base subfields for which a matching source subfield is found
  const equalSubfieldsBase = baseSubsNormalized
    .filter(baseSubfield => sourceSubsNormalized
      .some(sourceSubfield => subsetEquality(baseSubfield, sourceSubfield)));
  //debug(`equalSubfieldsBase: ${JSON.stringify(equalSubfieldsBase, undefined, 2)}`);

  // Returns the source subfields for which a matching base subfield is found
  const equalSubfieldsSource = sourceSubsNormalized
    .filter(sourceSubfield => baseSubsNormalized
      .some(baseSubfield => subsetEquality(sourceSubfield, baseSubfield)));
  //debug(`equalSubfieldsSource: ${JSON.stringify(equalSubfieldsSource, undefined, 2)}`);

  // If fields are equally long, keep base
  if (baseSubs.length === sourceSubs.length && equalSubfieldsBase.length < baseSubs.length) {
    debug(`No changes to base`);
    return base;
  }

  if (baseSubs.length === sourceSubs.length && equalSubfieldsBase.length === equalSubfieldsSource.length) {
    debug(`Checking subfield equality`);
    const totalSubfieldLengthBase = baseSubsNormalized
      .map(({value}) => value.length)
      .reduce((acc, value) => acc + value);
    const totalSubfieldLengthSource = sourceSubsNormalized
      .map(({value}) => value.length)
      .reduce((acc, value) => acc + value);

    if (totalSubfieldLengthSource > totalSubfieldLengthBase) {
      return replaceBasefieldWithSourcefield(base);
    }
  }
  if (sourceSubs.length > baseSubs.length && equalSubfieldsBase.length === baseSubs.length) {
    return replaceBasefieldWithSourcefield(base);
  }
  debug(`No changes to base`);
  return base;

  // Subset equality function from marc-record-merge select.js
  function subsetEquality(subfieldA, subfieldB) {
    return subfieldA.code === subfieldB.code &&
    (subfieldA.value.indexOf(subfieldB.value) !== -1 || subfieldB.value.indexOf(subfieldA.value) !== -1);
  }
  function replaceBasefieldWithSourcefield(base) {
    const index = base.fields.findIndex(field => field === baseField);
    base.fields.splice(index, 1, sourceField); // eslint-disable-line functional/immutable-data
    debug(`Source field ${sourceField.tag} is longer, replacing base field with source field`);
    return base;
  }
}



// NVOLK's marc record modifications
function internalFieldHasSubfield(field, subfieldCode, subfieldValue) {
  if ( field.subfields.some(sf => sf.code === subfieldCode) ) {
    if ( subfieldValue === null ) {
      return true;
    }
    return sf.value === subfieldValue;
  }
  return false;
}

export function fieldHasSubfield(field, subfieldCode, subfieldValue = null) {
  return internalFieldHasSubfield(field, subfieldCode, subfieldValue);
}

/**
 * renameSubfieldCodes
 *
 * */
 export function fieldRenameSubfieldCodes(field, origCode, targetCode) {
   // should we clone this?
  field.subfields.map(currSub => {
    if (currSub.code === origCode) {
      currSub.code = targetCode; // eslint-disable-line functional/immutable-data
      return currSub;
    }
    return currSub;
  });
  return field;
}

// NVOLK's merge permitters:

function controlSubfield0PermitsMerge(field1, field2) {
  if ( !internalFieldHasSubfield(field1, '0', null) || !internalFieldHasSubfield(field2, '0', null) ) { return true; }
  return field1.subfields.every(sf => {
    if ( sf.code !== '0' ) { return true; }
    if ( internalFieldHasSubfield(field2, field1.code, field1.data) ) {
      return true;
    }
    debug(`isni and FIN11 normalizations not implemented yet. FAIL on '${sf.value}'`);
    return false;
  });
}

function controlSubfield1PermitsMerge(field1, field2) {
  debug(`NB: controlSubfield1PermitsMerge() not implemented yet. Always succeeds!`);
  return true;
}

function controlSubfield3PermitsMerge(field1, field2) {
  return !internalFieldHasSubfield(field1, '3', null) && !internalFieldHasSubfield(field2, '3', null);
}

function controlSubfield5PermitsMerge(field1, field2) {
  // Check OK if neither one has $5.
  // Check fails if one field has $5 and the other one does not
  if ( !fieldHasSubfield(field1, '5') ) {
    return !fieldHasSubfield(field2, '5');
  }
  if ( !fieldHasSubfield(field2, '5') ) { return false; }
  // Strip $5 subfields. If everything else matches, OK, else FAIL:
  const sf5lessField1 = field1.subfields.filter(subfield => subfield.code !== '5');
  const sf5lessField2 = field2.subfields.filter(subfield => subfield.code !== '5');
  return MarcRecord.isEqual(sf5lessField1, sf5lessField2);
}

function controlSubfield6PermitsMerge(field1, field2) {
  if ( !internalFieldHasSubfield(field1, '6', null) && !internalFieldHasSubfield(field2, '6', null) ) {
    return true;
  }
  debug("controlSubfield6PermitsMerge() not properly implemented.");
  return false;
}

function controlSubfield8PermitsMerge(field1, field2) {
  return !internalFieldHasSubfield(field1, '8', null) && !internalFieldHasSubfield(field2, '8', null);
}

function controlSubfield9PermitsMerge(field1, field2) {
  if ( !fieldHasSubfield(field1, '9') && !fieldHasSubfield(field2, '9') ) { return true; }
  const sf9lessField1 = field1.subfields.filter(subfield => subfield.code !== '9' || ! /(?:<KEEP>|<DROP>)/u.test(subfield.value));
  const sf9lessField2 = field2.subfields.filter(subfield => subfield.code !== '9' || ! /(?:<KEEP>|<DROP>)/u.test(subfield.value));
  return MarcRecord.isEqual(sf9lessField1, sf9lessField2);
}

export function controlSubfieldsPermitMerge(field1, field2) {
  if ( !controlSubfield0PermitsMerge(field1, field2) ) {
    debug(" csf0 failed");
    return false;
  }
  if ( !controlSubfield1PermitsMerge(field1, field2) ) { debug(" csf1 failed"); return false; }
  if ( !controlSubfield3PermitsMerge(field1, field2) ) { debug(" csf3 failed"); return false; }
  if ( !controlSubfield5PermitsMerge(field1, field2) ) { debug(" csf5 failed"); return false; }
  if ( !controlSubfield6PermitsMerge(field1, field2) ) { debug(" csf6 failed"); return false; }
  if ( !controlSubfield8PermitsMerge(field1, field2) ) { debug(" csf8 failed"); return false; }
  if ( !controlSubfield9PermitsMerge(field1, field2) ) { debug(" csf9 failed"); return false; }
  return true;
}

// should this go to marc_record
export function recordReplaceField(record, originalField, newField) {
  const index = record.fields.findIndex(field => field === originalField);
  if (index === -1) {
    debug('WARNING: recordReplaceField: Failed to find the original field');
    // Should this function return something for success or failure?
    return record;
  }
  record.removeField(originalField);
  record.insertField(newField);
  return record;

  /*
  //const index = record.fields.findIndex(field => field === originalField);
  if (index === -1) {
    debug('WARNING: recordReplaceField: Failed to find the original field');
    // Should this function return something for success or failure?
    return record;
  }

  record.removeField(originalField);
  record.insertField(newField);
  //record.insertField(newField, index);
  return record;

  record.fields.splice(index, 1, clone(newField)); // eslint-disable-line functional/immutable-data
  debug(`Replacing base field ${originalField.tag} with source ${newField.tag}`);
  return record;
  */
}

