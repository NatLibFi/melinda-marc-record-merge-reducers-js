import createDebugLogger from 'debug';

import fs from 'fs';
import path from 'path';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:utils');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

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

// Get field specs from melindaCustomMergeFields.json
const melindaFields = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'melindaCustomMergeFields.json'), 'utf8'));


function marc21GetTagsLegalIndicators(tag) {
  const fieldSpecs = melindaFields.fields.filter(field => field.tag === tag);
  if (fieldSpecs.length === 0) {
    return undefined;
  }
  return fieldSpecs[0].indicators;
}

export function marc21GetTagsLegalInd1Value(tag) {
  const indicator = marc21GetTagsLegalIndicators(tag);
  if (indicator === undefined) {
    return undefined;
  }
  return indicator.ind1;
}

export function marc21GetTagsLegalInd2Value(tag) {
  const indicator = marc21GetTagsLegalIndicators(tag);
  if (indicator === undefined) {
    return undefined;
  }
  return indicator.ind2;
}


function isNonStandardNonrepeatableSubfield(tag, subfieldCode) {
  // Put these into config or so...
  if (tag === '264') {
    return ['a', 'b', 'c'].includes(subfieldCode);
  }

  if (['336', '337', '338'].includes(tag)) {
    return ['a', 'b', '2'].includes(subfieldCode);
  }

  return false;
}


export function subfieldIsRepeatable(tag, subfieldCode) {

  if (isNonStandardNonrepeatableSubfield(tag, subfieldCode)) {
    return false;
  }

  // These we know or "know":
  if ('0159'.indexOf(subfieldCode) > -1) {
    // Uh, can $0 appear on any field?
    return true;
  }

  const fieldSpecs = melindaFields.fields.filter(field => field.tag === tag);
  if (fieldSpecs.length !== 1) {
    nvdebug(` WARNING! Getting field ${tag} data failed! ${fieldSpecs.length} hits. Default value true is used for'${subfieldCode}' .`, debugDev);
    return true;
  }

  const subfieldSpecs = fieldSpecs[0].subfields.filter(subfield => subfield.code === subfieldCode);
  // Currently we don't support multiple $6 fields due to re-indexing limitations...
  // Well, $6 is non-repeatable, isn't it?!?
  // (This might actually already be fixed... Marginal issue, but check eventually.)
  if (subfieldSpecs.length !== 1 || subfieldCode === '6') {
    return false; // repeatable if not specified, I guess. Maybe add log or warn?
  }
  return subfieldSpecs[0].repeatable;
}


export function tagIsRepeatable(tag) {
  const fieldSpecs = melindaFields.fields.filter(field => field.tag === tag);
  if (fieldSpecs.length !== 1) {
    debugDev(` WARNING! Getting field ${tag} data failed! Default to repeatable field.`);
    return true;
  }
  return fieldSpecs[0].repeatable;
}

export function subfieldsAreIdentical(subfieldA, subfieldB) {
  return subfieldA.code === subfieldB.code && subfieldA.value === subfieldB.value;
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

export function fieldHasMultipleSubfields(field, subfieldCode/*, subfieldValue = null*/) {
  return fieldHasNSubfields(field, subfieldCode) > 1;
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
  if (func) { // eslint-disable-line functional/no-conditional-statements
    func(message);
    return;
  }
  if (!func) {
    // eslint-disable-next-line no-console
    console.info(message);
    return;
  }
}

export function nvdebugFieldArray(fields, prefix = '  ', func = undefined) {
  fields.forEach(field => nvdebug(`${prefix}${fieldToString(field)}`, func));
}

export function nvdebugSubfieldArray(subfields, prefix = '  ', func = undefined) {
  subfields.forEach(subfield => nvdebug(`${prefix}${subfieldToString(subfield)}`, func));
}

export function removeCopyright(value) {
  return value.replace(/^(?:c|p|©|℗|Cop\. ?) ?((?:1[0-9][0-9][0-9]|20[012][0-9])\.?)$/ui, '$1'); // eslint-disable-line prefer-named-capture-group
}

export function hasCopyright(value) {
  const modValue = removeCopyright(value);
  return value !== modValue;
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
