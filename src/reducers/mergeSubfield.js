import createDebugLogger from 'debug';
import {
  fieldHasSubfield,
  fieldIsRepeatable,
  fieldToString,
  normalizeStringValue,
} from './utils.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

const excludeSubfieldsFromMerge = [
  {'tag': '020', 'subfields': 'c'},
  {'tag': '022'},
  {'tag': '024', 'subfields': 'c'}
];

// Used by our very own hacky bottomUpSortSubfields(). Features:
// - Swap only sort adjacent pairs.
// - No sorting over unlisted subfield codes. Thus a given subfield can not shift to wrong side of $t...
const subfieldSortOrder = [
  {'tag': '040', 'sortOrder': '86abcedx'},
  {'tag': '100', 'sortOrder': 'abcde059'},
  {'tag': '240', 'sortOrder': 'amnpsl20159'},
  {'tag': '245', 'sortOrder': 'abnpc'}
];

const onlyBirthYear = /^[1-9][0-9]*-[,.]?$/u;
const birthYearAndDeathYear = /^[1-9][0-9]*-[1-9][0-9]*[,.]?$/u;

function replaceSubfield(targetField, candSubfield) {
  // Return true, if replace succeeds.
  // However, replacing/succeeding requires a sanity check, that the new value is a better one...
  // Thus, typically this function fails...
  const relevantSubfields = targetField.subfields.filter(subfield => subfield.code === candSubfield.code);
  debug(`Got ${relevantSubfields.length} sf-cands for field ${targetField.tag}`);

  // Handle X100$d: add death year, if original value only contains birth year:
  if (candSubfield.code === 'd' && /* debug("WP000") && */ (/00$/u).test(targetField.tag) && relevantSubfields.length === 1 &&
    onlyBirthYear.test(relevantSubfields[0].value) && birthYearAndDeathYear.test(candSubfield.value)) {
    relevantSubfields[0].value = candSubfield.value; // eslint-disable-line functional/immutable-data

    return true;
  }
  return false;
}

function OkToInsertTagCode(tag, code) {
  if ( tag === '040' && code === 'a') {
    // This is not allowed as such. It should be 040$d by now...
    return false;
  }
  return true;
}

function insertSubfieldAllowed(targetField, candSubfield) {
  // NB! If insert is not allowed, the candicate subfield can still replace the original. (Not handled by this function though.)

  // Subfield codes missing from the original record can be added by defautl:
  if (!fieldHasSubfield(targetField, candSubfield.code) && OkToInsertTagCode(targetField.tag, candSubfield.code)) { 
    return true;
  }

  // melindaCustomMergeFields.json tells us whether the subfield is repeatable or not:
  if (fieldIsRepeatable(targetField.tag, candSubfield.code)) {
    return true;
  }

  debug(`No rule to add '‡${candSubfield.code} ${candSubfield.value}' to '${fieldToString(targetField)}'`);
  return false;
}

function listDroppableSubfields(field) {
  const entry = excludeSubfieldsFromMerge.filter(currEntry => field.tag === currEntry.tag);
  if (entry.length > 0 && 'subfields' in entry[0]) {
    debug(`droppables: ${entry[0].subfields}`);
    return entry[0].subfields;
  }
  //debug(`NO DROPPABLE SUBFIELDS FOUND FOR ${field.tag}.`);
  return '';
}

export function isDroppableSubfield(field, subfieldCode) {
  const droppings = listDroppableSubfields(field);
  return droppings.indexOf(subfieldCode) > -1;
}

// Rename function?
function mergeSubfieldNotRequired(targetField, candSubfield) {
  const targetSubfieldsAsStrings = targetField.subfields.map(sf => sf.code + normalizeStringValue(sf.value));
  const cand = candSubfield.code + normalizeStringValue(candSubfield.value);
  if (targetSubfieldsAsStrings.some(existingValue => cand === existingValue)) {
    // Subfield exists. Do nothing
    return true;
  }
  if (targetField.tag === '040' && candSubfield.code === 'd' &&
    targetSubfieldsAsStrings.some(existingValue => ('a'+ cand.substring(1)) === existingValue) ) {
      debug("040$d matched 040$a");
      return true;
  }

  // Hey! We don't want this subfield:
  const droppableSubfieldsAsString = listDroppableSubfields(targetField);
  if (droppableSubfieldsAsString.includes(candSubfield.code)) {
    return true;
  }

  return false;
}

function getSubfieldSortOrder(field) {
  const entry = subfieldSortOrder.filter(currEntry => field.tag === currEntry.tag);
  if (entry.length > 0 && 'sortOrder' in entry[0]) {
    debug(`sort order for ${field.tag}: ${entry[0].sortOrder}`);
    return entry[0].sortOrder;
  }
  //debug(`NO DROPPABLE SUBFIELDS FOUND FOR ${field.tag}.`);
  return '';
}

// Now this gets ugly here lintwise...
function swapSubfields(field, sortOrder) {
  return field.subfields.some((sf, index) => {
    if (index === 0) {
      return false;
    }
    const currPos = sortOrder.indexOf(sf.code);
    const prevPos = sortOrder.indexOf(field.subfields[index - 1].code);
    if (currPos === -1 || prevPos === -1 || currPos >= prevPos) {
      return false;
    }
    // Swap:
    const tmp = field.subfields[index - 1];
    field.subfields[index - 1] = sf; // eslint-disable-line functional/immutable-data
    field.subfields[index] = tmp; // eslint-disable-line functional/immutable-data
    return true;
  });
}

export function bottomUpSortSubfields(field) {
  // Features:
  // - Swap only sort adjacent pairs.
  // - No sorting over unlisted subfield codes
  const sortOrder = getSubfieldSortOrder(field);
  if (sortOrder === null) {
    return field;
  }
  // I just love my own ugly {} hacks...
  while (swapSubfields(field, sortOrder)) {} // eslint-disable-line functional/no-loop-statement

  return field;
}


function prepareSubfieldForMerge(tag, originalSubfield) {
  const subfield = JSON.parse(JSON.stringify(originalSubfield));
  if (tag === '040' && subfield.code === 'a') {
    subfield.code = 'd'; // eslint-disable-line functional/immutable-data
    return subfield;
  }
  return subfield;
}

export function mergeSubfield(record, targetField, originalCandSubfield) {
  // Create a copy (and possibly modify a bit):
  const candSubfield = prepareSubfieldForMerge(targetField.tag, originalCandSubfield);

  if (mergeSubfieldNotRequired(targetField, candSubfield)) {
    debug(`    No need to add '‡${candSubfield.code} ${candSubfield.value}'`);
    return;
  }

  if ( targetField.tag === '040' && candSubfield.code === 'a' ) {

  }

  const str = `${candSubfield.code} ${candSubfield.value}`;
  if (insertSubfieldAllowed(targetField, candSubfield)) {
    debug(` Added subfield ‡'${str}' to field`);
    // Add subfield to the end of all subfields. NB! Implement a separate function that does this + subfield reordering somehow...
    targetField.subfields.push(candSubfield); // eslint-disable-line functional/immutable-data

    bottomUpSortSubfields(targetField);
    return;
  }
  // Currently only X00$d 1984- => 1984-2000 type of changes
  if (replaceSubfield(targetField, candSubfield)) {
    return;
  }
  // Didn't do anything, but thinks something should have been done:
  debug(`TODO: Handle merging/adding subfield '‡${str}' to field`);
}
