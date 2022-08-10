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
  if (field1.tag !== field2.tag) { // NB! We are skipping normalizations here on purpose! They should be done beforehand...
    return false;
  }
  return fieldToString(field1) === fieldToString(field2);

  // The order of subfields is relevant! Bloody JS idiotisms make people use conditions such as:
  // return field1.subfields.every(sf => field2.subfields.some(sf2 => sf.code === sf2.code && sf.value === sf2.value));
}

// Modified from copy functionality in marc-record-merge
// Changed function name from checkIdenticalness to getNonIdenticalFields / SS 28.5.2021
export function getNonIdenticalFields(baseFields, sourceFields) {
  // debug(`gNIF() in... ${baseFields.length} vs ${sourceFields.length}`);

  /*
  const baseFieldsAsString = baseFields.map(field => fieldToString(field));
  return sourceFields.filter(sourceField => baseFieldsAsString.some(fieldAsString => fieldAsString === fieldToString(sourceField)));
*/
  // Return array of non-identical fields (source fields not present in base)
  return sourceFields.filter(filterNonIdentical);

  function filterNonIdentical(sourceField) {
    return baseFields.some(baseField => fieldsAreIdentical(sourceField, baseField)) === false;
  }
}

export function fieldToString(f) {
  if ('subfields' in f) {
    return `${f.tag} ${f.ind1}${f.ind2} ‡${formatSubfields(f)}`;
  }
  return `${f.tag}    ${f.value}`;
  function formatSubfields(field) {
    return field.subfields.map(sf => `${sf.code}${sf.value || ''}`).join('‡');
  }
}

// Copy fields from source to base
// Used for non-identical fields
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


export function subfieldIsRepeatable(tag, subfieldCode) {
  const fieldSpecs = melindaFields.fields.filter(field => field.tag === tag);
  if (fieldSpecs.length !== 1) {
    debug(` WARNING! Getting field ${tag} data failed! Default value true is used for'${subfieldCode}' .`);
    return true;
  }

  // These we know or "know":
  if ('0159'.indexOf(subfieldCode) > -1) {
    // Uh, can $0 appear on any field?
    return true;
  }

  const subfieldSpecs = fieldSpecs[0].subfields.filter(subfield => subfield.code === subfieldCode);
  // Currently we don't support multiple $6 fields due to re-indexing limitations...
  // (This might actually already be fixed... Marginal issue, but check eventually.)
  if (subfieldSpecs.length !== 1 || subfieldCode === '6') {
    return false; // repeatable if not specified, I guess. Maybe add log or warn?
  }
  return subfieldSpecs[0].repeatable;
}


export function fieldIsRepeatable(tag) {
  const fieldSpecs = melindaFields.fields.filter(field => field.tag === tag);
  if (fieldSpecs.length !== 1) {
    debug(` WARNING! Getting field ${tag} data failed! Default to repeatable field.`);
    return true;
  }
  return fieldSpecs[0].repeatable;
}

export function subfieldsAreIdentical(subfieldA, subfieldB) {
  return subfieldA.code === subfieldB.code && subfieldA.value === subfieldB.value;
}

/* // subfield sorting is done in mergeSubfield.js
// Default subfield sort order if no custom order is given (use string first to improve readablility and compactness)
const sortDefaultString = '8673abcdefghijklmnopqrstuvwxyz420159';
const sortDefault = sortDefaultString.split('');

function sortSubfields(subfields, order = sortDefault, orderedSubfields = []) {
  const [filter, ...rest] = order;
  if (filter === undefined) {
    return [...orderedSubfields, ...subfields];
  }
  //debug(`### Subfield sort filter: ${JSON.stringify(filter)}`);
  //debug(`### Subfields: ${JSON.stringify(subfields)}`);
  //debug(`### Ordered subfields: ${JSON.stringify(orderedSubfields)}`);
  // eslint-disable
  const filtered = subfields.filter(sub => {
    if (typeof filter === 'string') {
      return sub.code === filter;
    }

  });
  const restSubfields = subfields.filter(sub => {
    if (typeof filter === 'string') {
      return sub.code !== filter;
    }
    // eslint-enable
  });
  if (filtered.length > 0) {
    return sortSubfields(restSubfields, rest, [...orderedSubfields, ...filtered]);
  }
  return sortSubfields(restSubfields, rest, orderedSubfields);
}
*/

// NVOLK's marc record modifications
export function fieldHasSubfield(field, subfieldCode, subfieldValue = null) {
  if (subfieldValue === null) {
    return field.subfields.some(sf => sf.code === subfieldCode);
  }
  return field.subfields.some(sf => sf.code === subfieldCode && subfieldValue === sf.value);
}

export function fieldHasNSubfields(field, subfieldCode/*, subfieldValue = null*/) {
  const relevantSubfields = field.subfields.filter(sf => sf.code === subfieldCode);
  //if (subfieldValue === null) {
  return relevantSubfields.length;
  //}
  //const subset = relevantSubfields.filter(value => value === subfieldValue);
  //return subset.length;
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
}

export function isControlSubfieldCode(subfieldCode) {
  if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'w'].includes(subfieldCode)) {
    return true;
  }
  return false;
}

export function nvdebug(message, func) {
  if (func) { // eslint-disable-line functional/no-conditional-statement
    func(message);
  }
  //console.info(message); // eslint-disable-line no-console
}

// base record level codes from highest (1) to lowest (10)
const ldr17ToRanking = {' ': 1, '^': 1, '4': 2, '1': 3, '5': 4, '7': 5, '2': 6, '3': 7, '8': 8, 'u': 9, 'z': 10};

export function getEncodingLevelRanking(record) {
  const ldr17 = record.leader.charAt(17); //record.leader[17];
  if (ldr17 in ldr17ToRanking) {
    const ranking = ldr17ToRanking[ldr17];
    debug(`LDR/17 ranking is ${ranking}`);
    return ranking;
  }
  debug(`LDR/19 VALUE '${ldr17}' NOT FOUND. USING DEFAULT RANKING 10.`);
  return 10;
  //return levelCodes.filter(level => level.levelValue === record.leader[17])[0].levelCode;
}

/*
export function isMainOrCorrespondingAddedEntryFieldTag(tag) {
  const tags = ['100', '110', '111', '130', '700', '710', '711', '730'];
  return tags.includes(tag);
}

export function isMainOrCorrespondingAddedEntryField(field) {
  if (isMainOrCorrespondingAddedEntryFieldTag(field.tag)) {
    return true;
  }
  // A bit more theoretical:
  if (field.tag === '880') {
    const sf8 = field.subfields.filter(sf => sf.code === '6');
    if (sf8.length) {
      const referredTag = sf8[0].value.slice(0, 3);
      return isMainOrCorrespondingAddedEntryFieldTag(referredTag);
    }
  }

  return 0;
}
*/

