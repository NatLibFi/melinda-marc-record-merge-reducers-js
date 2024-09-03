import createDebugLogger from 'debug';
import {melindaCustomMergeFields as melindaFields} from '@natlibfi/marc-record-validators-melinda/dist/melindaCustomMergeFields';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:utils');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

// Get array of field tags for use in other functions
export function getTags(fields) {
  const tags = fields.map(field => field.tag);
  return tags;
}

export function subfieldToString(sf) {
  return `‡${sf.code} ${sf.value}`;
}

export function fieldToString(f) {
  if ('subfields' in f) {
    return `${f.tag} ${f.ind1}${f.ind2}${formatSubfields(f)}`;
  }
  return `${f.tag}    ${f.value}`;

  function formatSubfields(field) {
    return field.subfields.map(sf => ` ${subfieldToString(sf)}`).join('');
  }
}

// Copy fields from source to base
// Used for non-identical fields
// Copy all (typically non-identical in our context) fields from source to base
export function copyFields(record, fields) {
  fields.forEach(f => {
    debugDev(`Field ${fieldToString(f)} copied from source to base`);
    record.insertField(f);
  });
  // const tags = fields.map(field => field.tag);
  // tags.forEach(tag => debugDev('Field '+ mapDataField(copied from source to base`));
  return record;
}

export function tagIsRepeatable(tag) {
  const fieldSpecs = melindaFields.fields.filter(field => field.tag === tag);
  if (fieldSpecs.length !== 1) {
    debugDev(` WARNING! Getting field ${tag} data failed! Default to repeatable field.`);
    return true;
  }
  return fieldSpecs[0].repeatable;
}

// NVOLK's marc record modifications
export function fieldHasSubfield(field, subfieldCode, subfieldValue = null) {
  if (!field.subfields) {
    return false;
  }
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


/*
export function recordHasField(record, tag) {
  const re = new RegExp(`^${tag}$`, 'u');
  const yeOldeFields = record.get(re);
  return yeOldeFields.length > 0;
}
*/

export function fieldHasControlSubfieldCode(field) {
  return field.subfields.some(sf => isControlSubfieldCode(sf.code));
}


export function isControlSubfieldCode(subfieldCode) {
  if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'w'].includes(subfieldCode)) {
    return true;
  }
  return false;
}

export function nvdebug(message, func = undefined) {
  if (func) {
    func(message);
    return;
  }
  //console.info(message); // eslint-disable-line no-console
}

export function nvdebugFieldArray(fields, prefix = '  ', func = undefined) {
  fields.forEach(field => nvdebug(`${prefix}${fieldToString(field)}`, func));
}

/*
export function stringToRegex(string) { // easier to remember
  return new RegExp(string, 'u');
}
*/

export function getCatalogingLanguage(record) {
  const [field040] = record.get(/^040$/u);
  if (!field040) {
    return null;
  }
  const [b] = field040.subfields.filter(sf => sf.code === 'b');
  if (!b) {
    return null;
  }
  return b.value;
}

export function uniqArray(arr) {
  return arr.filter((val, i) => arr.indexOf(val) === i);
}
