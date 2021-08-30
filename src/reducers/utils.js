import {normalizeSync} from 'normalize-diacritics';
import createDebugLogger from 'debug';

import fs from 'fs';
import path from 'path';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

// Get array of field tags for use in other functions
export function getTags(fields) {
  const tags = fields.map(field => field.tag);
  return tags;
}

export function fieldsAreIdentical(field1, field2) {
  // NB! We are skipping normalizations here on purpose! They should be done beforehand...
  if (field1.tag !== field2.tag) {
    return false;
  }

  // debug(`Compare '${localFieldToString(field1)}' vs '${localFieldToString(field2)}'...`);

  if ('value' in field1) { // 001-009
    return localFieldToString(field1) === localFieldToString(field2);
  }

  if ('subfields' in field1) {
    if (field1.ind1 === field2.ind1 &&
        field1.ind2 === field2.ind2 &&
        field1.subfields.length === field2.subfields.length) {
      // NB! This does not check order of subfields, which might or might nor be a bad idea.
      // NV would just do localFieldToString() and compare them strings...
      // This is the original (Artturi?) way...
      return field1.subfields.every(sf => field2.subfields.some(sf2 => sf.code === sf2.code && sf.value === sf2.value));
    }
    return false;
  }

  return false;
}

// Modified from copy functionality in marc-record-merge
// Changed function name from checkIdenticalness to getNonIdenticalFields / SS 28.5.2021
export function getNonIdenticalFields(baseFields, sourceFields) {
  debug(`gNIF() in... ${baseFields.length} vs ${sourceFields.length}`);

  /*
  const baseFieldsAsString = baseFields.map(field => localFieldToString(field));
  return sourceFields.filter(sourceField => baseFieldsAsString.some(fieldAsString => fieldAsString === localFieldToString(sourceField)));
*/
  // Return array of non-identical fields (source fields not present in base)
  return sourceFields.filter(filterNonIdentical);

  function filterNonIdentical(sourceField) {
    return baseFields.some(baseField => fieldsAreIdentical(sourceField, baseField)) === false;
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

export function fieldToString(f) { // copied aped from marc-record-js, NB! Overrides the normal json output (oops)
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
const melindaFields = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'melindaCustomMergeFields.json'), 'utf8'));
export function getFieldSpecs(tag) {
  const [fieldSpecs] = melindaFields.fields.filter(field => field.tag === tag);
  return fieldSpecs;
}
export function getRepCodes(tag) {
  return getFieldSpecs(tag).subfields
    .filter(sub => sub.repeatable === true)
    .map(sub => sub.code);
}
export function getNonRepCodes(tag) {
  return getFieldSpecs(tag).subfields
    .filter(sub => sub.repeatable === false)
    .map(sub => sub.code);
}

function subfieldIsRepeatable(currFieldSpecs, subfieldCode) {
  // These we know or "know":
  if ('09'.indexOf(subfieldCode) > -1) {
    // Uh, can $0 appear on any field?
    return true;
  }
  if ('56'.indexOf(subfieldCode) > -1) {
    return false;
  }

  const subfieldSpecs = currFieldSpecs.subfields.filter(subfield => subfield.code === subfieldCode);
  if (subfieldSpecs.length !== 1) {
    return false; // repeatable if not specified?
  }
  return subfieldSpecs[0].repeatable;
}

export function fieldIsRepeatable(tag, code = null) {
  const fieldSpecs = melindaFields.fields.filter(field => field.tag === tag);
  if (fieldSpecs.length !== 1) {
    if (!code) {
      debug(` WARNING! Getting field ${tag} data failed! Default to unrepeatable field.`);
      return false;
    }
    debug(` WARNING! Getting field ${tag}$${code} data failed! Default to repeatable subfield.`);
    return true;
  }
  if (!code) { // Field is repeatable:
    return fieldSpecs[0].repeatable;
  }
  return subfieldIsRepeatable(fieldSpecs[0], code);
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

function strictEquality(subfieldA, subfieldB) {
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
  debug(`selectLongerField(): Comparing field ${baseField.tag}`);
  const baseSubs = 'subfields' in baseField ? baseField.subfields : [];
  const sourceSubs = 'subfields' in sourceField ? sourceField.subfields : [];

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

  if (baseSubs.length > 0 && baseSubs.length === sourceSubs.length && equalSubfieldsBase.length === equalSubfieldsSource.length &&
    localFieldToString(baseField).length < localFieldToString(sourceField).length) {
    debug(`Checking subfield equality: equal number of subfields, but source has longer contents`);
    return replaceBasefieldWithSourcefield(base);

    /*
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
    */
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
  if (subfieldValue === null) {
    return field.subfields.some(sf => sf.code === subfieldCode);
  }
  return field.subfields.some(sf => sf.code === subfieldCode && subfieldValue === sf.value);
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

export function recordHasField(record, tag) {
  const re = new RegExp(`^${tag}$`, 'u');
  const yeOldeFields = record.get(re);
  return yeOldeFields.length > 0;
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

