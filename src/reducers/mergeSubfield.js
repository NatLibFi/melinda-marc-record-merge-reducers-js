import createDebugLogger from 'debug';
import {
  fieldHasSubfield,
  fieldIsRepeatable,
  normalizeStringValue
} from './utils.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

const excludeSubfieldsFromMerge = [
  {'tag': '020', 'subfields': 'c'},
  // {'tag': '022'},
  {'tag': '024', 'subfields': 'c'}
];

const includeSubfields = [{'tag': '040', 'subfields': 'abcde68'}]; // if we want only certain subfields to be included...


// List only exceptional order here. Otherwise default order is used.
const subfieldSortOrder = [
  {'tag': '040', 'sortOrder': ['8', '6', 'a', 'b', 'c', 'e', 'd', 'x']},
  {'tag': '100', 'sortOrder': ['a', 'b', 'c', 'd', 'e', '0', '5', '9']},
  {'tag': '240', 'sortOrder': ['a', 'm', 'n', 'p', 's', 'l', '2', '0', '1', '5', '9']},
  {'tag': '245', 'sortOrder': ['a', 'b', 'n', 'p', 'c']},
  {'tag': '382', 'sortOrder': ['a']}, // TODO: write test for this field.,
  {'tag': '385', 'sortOrder': ['8', 'm', 'n', 'a']},
  {'tag': '386', 'sortOrder': ['8', 'm', 'n', 'a']},
  {'tag': '490', 'sortOrder': ['a', 'x', 'v', 'l']},
  {'tag': '505', 'sortOrder': ['a']},
  {'tag': '526', 'sortOrder': ['i', 'a']},
  {'tag': '600', 'sortOrder': ['a', 'b', 'c', 'd', 'e', '0', '5', '9']},
  {'tag': '700', 'sortOrder': ['a', 'b', 'c', 'd', 'e', '0', '5', '9']},
  {'tag': '776', 'sortOrder': ['i', 'a']},
  {'tag': '830', 'sortOrder': ['a', 'n', 'x', 'v']}, // INCOMPLETE, SAME AS 490? APPARENTLY NOT...
  {'tag': '880', 'sortOrder': ['a']} // Hack, so that default order is not used
];

// NB! These are X00 specific. Should we somehow parametrize them?
const onlyBirthYear = /^[1-9][0-9]*-[,.]?$/u;
const birthYearAndDeathYear = /^[1-9][0-9]*-[1-9][0-9]*[,.]?$/u;

function replaceSubfield(targetField, candSubfield) {
  // Return true, if replace succeeds.
  // However, replacing/succeeding requires a sanity check, that the new value is a better one...
  // Thus, typically this function fails...
  const relevantSubfields = targetField.subfields.filter(subfield => subfield.code === candSubfield.code);
  debug(`Got ${relevantSubfields.length} sf-cands for field ${targetField.tag}`);
  if (relevantSubfields.length === 0) { // Can't replace anything, can I...
    return false;
  }

  // Handle X100$d: add death year, if original value only contains birth year:
  if (candSubfield.code === 'd' && /* debug("WP000") && */ (/00$/u).test(targetField.tag) &&
    onlyBirthYear.test(relevantSubfields[0].value) && birthYearAndDeathYear.test(candSubfield.value) &&
    // *Rather hackily* compare the start of the string to determinen that start years are identical(-ish)
    relevantSubfields[0].value.substring(0, 4) === candSubfield.value.substring(0, 4)) {
    relevantSubfields[0].value = candSubfield.value; // eslint-disable-line functional/immutable-data
    return true;
  }
  return false; // default to failure
}

function okToInsertTagCode(tag, code) {
  if (tag === '040' && code === 'a') {
    // This is not allowed as such. It should be 040$d by now...
    // NB: check this...
    return false;
  }
  return true;
}

function insertSubfieldAllowed(targetField, candSubfield) {
  // NB! If insert is not allowed, the candicate subfield can still replace the original. (Not handled by this function though.)

  // Subfield codes missing from the original record can be added by defautl:
  if (!fieldHasSubfield(targetField, candSubfield.code) && okToInsertTagCode(targetField.tag, candSubfield.code)) {
    return true;
  }

  // melindaCustomMergeFields.json tells us whether the subfield is repeatable or not:
  if (fieldIsRepeatable(targetField.tag, candSubfield.code)) {
    return true;
  }


  return false;
}

function listSubfieldsWorthKeeping(tag) {
  const entry = includeSubfields.filter(currEntry => tag === currEntry.tag);
  if (entry.length > 0 && 'subfields' in entry[0]) {
    debug(`keptables: ${entry[0].subfields}`);
    return entry[0].subfields;
  }
  //debug(`NO DROPPABLE SUBFIELDS FOUND FOR ${tag}.`);
  return '';
}

function isKeptableSubfield(tag, subfieldCode) {
  const listOfSubfieldsAsString = listSubfieldsWorthKeeping(tag);
  // If nothing is listed, everything is good:
  if (listOfSubfieldsAsString === '') {
    return true;
  }
  return listOfSubfieldsAsString.indexOf(subfieldCode) > -1;
}

function listDroppableSubfields(tag) {
  // NB! Should we drop the here, or already on the preprocessor?
  const entry = excludeSubfieldsFromMerge.filter(currEntry => tag === currEntry.tag);
  if (entry.length > 0 && 'subfields' in entry[0]) {
    debug(`droppables: ${tag}‡${entry[0].subfields}`);
    return entry[0].subfields;
  }
  //debug(`NO DROPPABLE SUBFIELDS FOUND FOR ${tag}.`);
  return '';
}

function isDroppableSubfield(tag, subfieldCode) {
  const droppings = listDroppableSubfields(tag);
  return droppings.indexOf(subfieldCode) > -1;
}

function isSubfieldGood(tag, subfieldCode) {
  if (isDroppableSubfield(tag, subfieldCode)) {
    debug(`BAD SF: ${tag}$${subfieldCode} is droppable.`);
    return false;
  }
  if (!isKeptableSubfield(tag, subfieldCode)) {
    debug(`BAD SF: ${tag}$${subfieldCode} is unkeptable.`);
    return false;
  }
  return true;
}

export function isSubfieldGoodForMerge(tag, subfieldCode) {
  return isSubfieldGood(tag, subfieldCode);
}

// Rename function? Should this function be moved to mergeSubfield.js?
function mergeSubfieldNotRequired(targetField, candSubfield) {
  const targetSubfieldsAsStrings = targetField.subfields.map(sf => sf.code + normalizeStringValue(sf.value));
  const cand = candSubfield.code + normalizeStringValue(candSubfield.value);
  if (targetSubfieldsAsStrings.some(existingValue => cand === existingValue)) {
    // Subfield with identical normalized valueexists. Do nothing
    return true;
  }
  if (targetField.tag === '040' && candSubfield.code === 'd' &&
    targetSubfieldsAsStrings.some(existingValue => `a${cand.substring(1)}` === existingValue)) {
    debug('040$d matched 040$a');
    return true;
  }

  // Check whether we really want this subfield:
  return !isSubfieldGood(targetField.tag, candSubfield.code);
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
  const loopAgain = field.subfields.some((sf, index) => {
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

  if (loopAgain) {
    return swapSubfields(field, sortOrder);
  }

  return;
}

const defaultSortOderString = '8673abcdefghijklmnopqrstuvwxyz420159';
export function bottomUpSortSubfields(field) {
  // Features:
  // - Swap only sort adjacent pairs.
  // - No sorting over unlisted subfield codes. Thus a given subfield can not shift to wrong side of 700$t...

  const sortOrder = getSubfieldSortOrder(field);


  /*
  // Currently always sort:
  if (sortOrder === null) {
    return field;
  }
  */

  swapSubfields(field, sortOrder || defaultSortOderString);

  return field;
}

/*
export function prepareSubfieldForMerge(tag, originalSubfield) {
  const subfield = JSON.parse(JSON.stringify(originalSubfield));
  if (tag === '040' && subfield.code === 'a') {
    subfield.code = 'd'; // eslint-disable-line functional/immutable-data
    return subfield;
  }
  return subfield;
}
*/

export function mergeSubfield(record, targetField, candSubfield) {

  if (mergeSubfieldNotRequired(targetField, candSubfield)) {
    debug(`    No need to add subfield '‡${candSubfield.code} ${candSubfield.value}'`);
    return;
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
