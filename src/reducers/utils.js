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

  return fieldToString(field1) === fieldToString(field2);
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
export function getFieldSpecs(tag) {
  const [fieldSpecs] = melindaFields.fields.filter(field => field.tag === tag);
  return fieldSpecs;
}

function subfieldIsRepeatable(currFieldSpecs, subfieldCode) {
  // These we know or "know":
  if ('0159'.indexOf(subfieldCode) > -1) {
    // Uh, can $0 appear on any field?
    return true;
  }

  if ('6'.indexOf(subfieldCode) > -1) {
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

export function subfieldsAreIdentical(subfieldA, subfieldB) {
  return subfieldA.code === subfieldB.code && subfieldA.value === subfieldB.value;
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


// NVOLK's marc record modifications
export function fieldHasSubfield(field, subfieldCode, subfieldValue = null) {
  if (subfieldValue === null) {
    return field.subfields.some(sf => sf.code === subfieldCode);
  }
  return field.subfields.some(sf => sf.code === subfieldCode && subfieldValue === sf.value);
}

export function fieldHasNSubfields(field, subfieldCode, subfieldValue = null) {
  const relevantSubfields = field.subfields.filter(sf => sf.code === subfieldCode);
  if (subfieldValue === null) {
    return relevantSubfields.length;
  }
  const subset = relevantSubfields.filter(value => value === subfieldValue);
  return subset.length;
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
  if ( ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'w'].includes(subfieldCode) ) { return true; }
  return false;
}