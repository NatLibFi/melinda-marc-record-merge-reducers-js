import {fieldToString, nvdebug} from './utils';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:normalizeSubfield9Linkage');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

export default () => (base, source) => {
  //nvdebug(' IN1', debugDev);
  recordNormalizeSubfield9Linkage(base);
  //nvdebug(' IN2', debugDev);
  recordNormalizeSubfield9Linkage(source);
  //nvdebug(' IN3', debugDev);
  return {base, source};
};

/*
export default function () { // (commented) validator/fixer style default function

  return {
    description: 'Normalizes $9-chains',
    validate, fix
  };

  function fix(record) {
    const res = {message: [], fix: [], valid: true};
    recordNormalizeSubfield9Linkage(record);
    // message.fix = []; // eslint-disable-line functional/immutable-data
    // message.valid = !(message.message.length >= 1); // eslint-disable-line functional/immutable-data
    return res;
  }

  function validate(record) {
    const res = {message: [], valid: true};
    //nvdebug(`NORMALIZE CONTROL NUMBER VALIDATE`, debugDev);
    // Actual parsing of all fields

    const position = getIndexOfNextLinkableField(record);
    if (position !== -1) { // Fail
      res.message.push(`Record had $9 linkage that may need to removed`); // eslint-disable-line functional/immutable-data
      res.valid = false; // eslint-disable-line functional/immutable-data
      return res;
    }

    return res;
  }
}
*/

function getLastSubfield(field) {
  return field.subfields[field.subfields.length - 1];
}

function hasLinkageLHS(field) {
  // Has linkage if last subfield ends with '^'
  if (!field.subfields) {
    return false;
  }
  const lastSubfield = getLastSubfield(field);
  const lastChar = lastSubfield.value.charAt(lastSubfield.value.length - 1);
  return lastChar === '^';
}

function getRHSLinkage(field) {
  if (!field.subfields || field.subfields.length < 2) {
    return false;
  }
  if (field.subfields[0].code !== '9') {
    return false;
  }
  const val = field.subfields[0].value;
  if (val === '^^' || val === '^') {
    return val;
  }
  return false;
}

function canCombineTwoFields(field1, field2) {
  if (field1.tag !== field2.tag || !hasLinkageLHS(field1)) {
    return false;
  }

  const linkageType = getRHSLinkage(field2); // either '^^' or '^'

  nvdebug(`FOUND LHS LINKAGE. CHECK RHS: '${fieldToString(field2)}' has linkage ${linkageType ? linkageType : 'NONE'}`, debugDev);
  if (linkageType === '^') {
    return true;
  }
  if (linkageType === '^^') {
    if (getLastSubfield(field1).code === field2.subfields[1].code) {
      return true;
    }
  }
  nvdebug('HOWEVER, RHS LINKAGE FAILED', debugDev);
  return false;
}

function getIndexOfNextLinkableField(record, currPosition = 0) {
  if (currPosition + 1 >= record.fields.length) {
    return -1;
  }
  if (canCombineTwoFields(record.fields[currPosition], record.fields[currPosition + 1])) {
    nvdebug(`Combine two fields at ${currPosition}: ${fieldToString(record.fields[currPosition])} and ${fieldToString(record.fields[currPosition + 1])}`, debugDev);
    return currPosition;
  }
  // Recursion is ugly, but I'll do it anyway since this is JS.
  return getIndexOfNextLinkableField(record, currPosition + 1);
}

function removeLHSLinkingCharacter(field, replacement) {
  const lastSubfield = getLastSubfield(field);
  nvdebug(`Modify last subfield '${lastSubfield.value}', replacement: '${replacement}'`, debugDev);
  lastSubfield.value = lastSubfield.value.replace(/\^$/u, replacement); // eslint-disable-line functional/immutable-data
  nvdebug(` Modified last subfield '${lastSubfield.value}'`, debugDev);
}

function addSubfields(targetField, sourceField, subfieldIndex) {
  if (subfieldIndex >= sourceField.subfields.length) {
    return;
  }
  nvdebug(` sf9-linking: Added subfield $${sourceField.subfields[subfieldIndex].code} ${sourceField.subfields[subfieldIndex].value}`, debugDev);
  // Add subfield to the end of all subfields. NB! Implement a separate function that does this + subfield reordering somehow...
  targetField.subfields.push(sourceField.subfields[subfieldIndex]); // eslint-disable-line functional/immutable-data
  return addSubfields(targetField, sourceField, subfieldIndex + 1);
}

export function recordNormalizeSubfield9Linkage(record, startPosition = 0) {
  const position = getIndexOfNextLinkableField(record, startPosition);
  if (position === -1) {
    return;
  }
  nvdebug(`TODO: STARTED FROM ${startPosition}, MERGE FIELDS AT ${position}`, debugDev);
  // NB! Add recursion only after merging is properly done.
  const currField = record.fields[position];
  const nextField = record.fields[position + 1];
  const linkageType = getRHSLinkage(nextField); // either '^^' or '^'

  removeLHSLinkingCharacter(currField, linkageType === '^^' ? ' ' : ''); // Replace '^' with either ' ' or ''.
  if (linkageType === '^^') { // eslint-disable-line functional/no-conditional-statements
    nvdebug('CONCAT SUBS BASED ON "^^"', debugDev);
    // Take 2nd subfield (1st is the '$9 ^^') from nextField and append it to the last subfield of currField
    currField.subfields[currField.subfields.length - 1].value += nextField.subfields[1].value; // eslint-disable-line functional/immutable-data
    nvdebug(`POS${position} value is now ${currField.subfields[currField.subfields.length - 1].value}`, debugDev);
  }

  // Linkage type is '^': copy all subfields except initial $9:
  addSubfields(currField, nextField, 1 + (linkageType === '^^' ? 1 : 0));

  // Remove next field:
  nvdebug('TRY AND REMOVE NEXT FIELD, AS ITS DATA WAS MERGED', debugDev);
  record.fields.splice(position + 1, 1); // eslint-disable-line functional/immutable-data

  // Recurse/continue from merged record.fields[position]
  recordNormalizeSubfield9Linkage(record, position);
}
