import createDebugLogger from 'debug';

import {fieldHasControlSubfieldCode, fieldHasNSubfields, nvdebug, subfieldToString} from './utils';
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:transferManufacturerDataFrom260To264');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

export default () => (base, source) => {
  nvdebug('260$efg to 264$abc transfer', debugDev);
  handleRecord(base);
  handleRecord(source);
  return {base, source};
};

function hasManufacturerData(field) {
  return field.subfields.some(subfield => ['e', 'f', 'g'].includes(subfield.code));
}

function hasTooMuchManufacturerData(field) {
  // Subfields $e, $f $g are repeatable, we don't currently handle repeated cases.
  return fieldHasNSubfields(field, 'e') > 1 || fieldHasNSubfields(field, 'f') > 1 || fieldHasNSubfields(field, 'g') > 1;
}

function hasNonManufacturerData(field) {
  return field.subfields.some(subfield => ['a', 'b', 'c'].includes(subfield.code));
}

function retagableField(field) {
  return !hasNonManufacturerData(field) && !hasTooMuchManufacturerData(field);
}

function isRelevantField(field) {
  return hasManufacturerData(field) && !hasTooMuchManufacturerData(field) && !fieldHasControlSubfieldCode(field);
}


function renameSubfield(subfield) {
  nvdebug(`renameSubfield(${subfieldToString(subfield)})`, debugDev);
  if (subfield.code === 'e') {
    subfield.code = 'a'; // eslint-disable-line functional/immutable-data
    return;
  }
  if (subfield.code === 'f') {
    subfield.code = 'b'; // eslint-disable-line functional/immutable-data
    return;
  }
  if (subfield.code === 'g') {
    subfield.code = 'c'; // eslint-disable-line functional/immutable-data
    return;
  }
}

function locateSubfieldPosition(field, subfieldCode, candPosition) {
  if (candPosition === -1) { // Any will do
    return field.subfields.findIndex(sf => sf.code === subfieldCode);
  }
  if (candPosition < field.subfields.length && field.subfields[candPosition].code === subfieldCode) {
    return candPosition;
  }
  return -1;
}

function extractSubfield(field, index) {
  if (index < 0) {
    return null;
  }

  const [subfield] = field.subfields.splice(index, 1); // eslint-disable-line functional/immutable-data

  renameSubfield(subfield);
  return subfield;
}

function subfieldArrayRemoveParentheses(subfields) {
  const firstValue = subfields[0].value;
  if (firstValue.charAt(0) !== '(') {
    return;
  }
  const lastSubfield = subfields[subfields.length - 1];
  if (lastSubfield.value.slice(-1) !== ')') {
    return;
  }
  subfields[0].value = subfields[0].value.substring(1); // eslint-disable-line functional/immutable-data
  lastSubfield.value = lastSubfield.value.slice(0, -1); // eslint-disable-line functional/immutable-data
}

function extractField(field) {
  const ePos = locateSubfieldPosition(field, 'e', -1);
  const fPos = locateSubfieldPosition(field, 'f', ePos === -1 ? -1 : ePos + 1);
  const gPos = locateSubfieldPosition(field, 'g', fPos === -1 ? -1 : fPos + 1);

  // NB! Does not handle control subfields at all!

  // NB! Start from last, so indexes won't get messed up:
  const g = extractSubfield(field, gPos);
  const f = extractSubfield(field, fPos);
  const e = extractSubfield(field, ePos);
  const subfields = [e, f, g].filter(val => val !== null);

  subfieldArrayRemoveParentheses(subfields);

  return {'tag': '264', 'ind1': field.ind1, 'ind2': '3', subfields};

}

function retag(field) {
  field.tag = '264'; // eslint-disable-line functional/immutable-data
  field.ind2 = '3'; // eslint-disable-line functional/immutable-data
  field.subfields.forEach(subfield => renameSubfield(subfield));
  subfieldArrayRemoveParentheses(field.subfields);

}


function handleRecord(record) {
  const fields260 = record.get(/^260$/u);
  if (fields260.length === 0) {
    return;
  }

  const relevantFields = fields260.filter(field => isRelevantField(field));
  if (relevantFields.length === 0) {
    return;
  }


  relevantFields.forEach(field => processField(field));

  function processField(field) {
    if (retagableField(field)) {
      retag(field);
      return;
    }
    const newField = extractField(field);
    record.insertField(newField);
    // Recursion support (does not currenly happen as we use hasTooMuchManufacturerData)
    if (isRelevantField(field)) {
      processField(field);
      return;
    }
  }

}
