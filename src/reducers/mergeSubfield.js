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
  {'tag': '048', 'sortOrder': ['8', '6', 'b', 'a']},
  {'tag': '100', 'sortOrder': ['a', 'b', 'c', 'd', 'e', 'j', '0', '5', '9']},
  {'tag': '110', 'sortOrder': ['a', 'b', 'n']},
  {'tag': '111', 'sortOrder': ['a', 'n', 'd', 'c', 'e', 'g', 'j']},
  {'tag': '240', 'sortOrder': ['a', 'm', 'n', 'p', 's', 'l', '2', '0', '1', '5', '9']},
  {'tag': '245', 'sortOrder': ['a', 'b', 'n', 'p', 'c']},
  {'tag': '382', 'sortOrder': ['a']},
  {'tag': '385', 'sortOrder': ['8', 'm', 'n', 'a']},
  {'tag': '386', 'sortOrder': ['8', 'm', 'n', 'a']},
  {'tag': '490', 'sortOrder': ['a', 'x', 'v', 'l']},
  {'tag': '505', 'sortOrder': ['a']},
  {'tag': '526', 'sortOrder': ['i', 'a']},
  {'tag': '600', 'sortOrder': ['a', 'b', 'c', 'd', 'e', '0', '5', '9']},
  {'tag': '610', 'sortOrder': ['a', 'b', 'n']},
  {'tag': '611', 'sortOrder': ['a', 'n', 'd', 'c', 'e', 'g', 'j']},
  {'tag': '700', 'sortOrder': ['a', 'b', 'c', 'd', 'e', '0', '5', '9']},
  {'tag': '710', 'sortOrder': ['a', 'b', 'n']},
  {'tag': '711', 'sortOrder': ['a', 'n', 'd', 'c', 'e', 'g', 'j']},
  {'tag': '776', 'sortOrder': ['i', 'a']},
  {'tag': '810', 'sortOrder': ['a', 'b', 'n']},
  {'tag': '811', 'sortOrder': ['a', 'n', 'd', 'c', 'e', 'g', 'j']},
  {'tag': '830', 'sortOrder': ['a', 'n', 'x', 'v']}, // INCOMPLETE, SAME AS 490? APPARENTLY NOT...
  {'tag': '880', 'sortOrder': ['a']},
  {'tag': 'SID', 'sortOrder': ['c', 'b']} // Hack, so that default order is not used
];

// NB! These are X00 specific. Should we somehow parametrize them?
//const notYear = /^\([1-9][0-9]*\)[,.]?$/u;
const onlyBirthYear = /^[1-9][0-9]*-[,.]?$/u;
const onlyDeathYear = /^-[1-9][0-9]*[,.]?$/u;
const birthYearAndDeathYear = /^[1-9][0-9]*-[1-9][0-9]*[,.]?$/u;

function getDeathYear(str) {
  return parseInt(str.substring(str.indexOf('-') + 1));
}

function isValidBirthYearAndDeathYear(str) {
  if (!birthYearAndDeathYear.test(str)) {
    return false;
  }
  // We have two years
  const b = parseInt(str);
  const d = getDeathYear(str);
  if (b > d) { // died before birth! Rather unlikely.
    return false;
  }
  if (d - b > 125) { // Over 125 years old. Rather unlikely.
    return false;
  }
  // Possible sanity check: Died after current year?
  return true;
}

function anyYear(str) {
  if (onlyBirthYear.test(str) || onlyDeathYear.test(str) || isValidBirthYearAndDeathYear(str)) {
    return true;
  }
  return false;
}

function replaceDatesAssociatedWithName(targetField, candSubfield, relevantSubfields) {
  // Handle X100$d: add death year, if original value only contains birth year:
  if (candSubfield.code !== 'd' || !(/^[1678]00$/u).test(targetField.tag)) {
    return false;
  }

  //if ( notYear.test(relevantSubfields[0].value) && anyYear(candSubfield.value) ) {
  if (!anyYear(relevantSubfields[0].value) && anyYear(candSubfield.value)) {
    relevantSubfields[0].value = candSubfield.value; // eslint-disable-line functional/immutable-data
    return true;
  }

  if (birthYearAndDeathYear.test(candSubfield.value)) {
    if (onlyBirthYear.test(relevantSubfields[0].value) && parseInt(relevantSubfields[0].value) === parseInt(candSubfield.value)) {
      relevantSubfields[0].value = candSubfield.value; // eslint-disable-line functional/immutable-data
      return true;
    }

    if (onlyDeathYear.test(relevantSubfields[0].value) && getDeathYear(relevantSubfields[0].value) === getDeathYear(candSubfield.value)) {
      relevantSubfields[0].value = candSubfield.value; // eslint-disable-line functional/immutable-data
      return true;
    }
  }

  return false;
}

function replaceSubfieldWithBetterValue(targetField, candSubfield) {
  // Return true, if replace succeeds.
  // However, replacing/succeeding requires a sanity check, that the new value is a better one...
  // Thus, typically this function fails...
  const relevantSubfields = targetField.subfields.filter(subfield => subfield.code === candSubfield.code);
  debug(`Got ${relevantSubfields.length} sf-cands for field ${targetField.tag}‡${candSubfield.code}`);
  if (relevantSubfields.length === 0) { // Can't replace anything, can I...
    return false;
  }

  if (replaceDatesAssociatedWithName(targetField, candSubfield, relevantSubfields)) {
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

function mergeSubfieldNotRequired(targetField, candSubfield) {
  const targetSubfieldsAsStrings = targetField.subfields.map(sf => sf.code + normalizeStringValue(sf.value));
  const cand = candSubfield.code + normalizeStringValue(candSubfield.value);
  if (targetSubfieldsAsStrings.some(existingValue => cand === existingValue)) {
    // Subfield with identical normalized value exists. Do nothing.
    // Not ideal 382$n subfields, I guess...
    return true;
  }
  if (targetField.tag === '040' && candSubfield.code === 'd' &&
    targetSubfieldsAsStrings.some(existingValue => `a${cand.substring(1)}` === existingValue)) {
    debug('040$d matched 040$a');
    return true;
  }
  if (candSubfield.code === 'g' && candSubfield.value === 'ENNAKKOTIETO.') {
    // Skip just $g subfield or the whole field?
    // We decided to skip just this subfield. We want at least $0 and maybe more even from ennakkotieto.
    debug('Skip $g ENNAKKOTIETO.');
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

  // Should we support multiple values?
  const sortOrder = getSubfieldSortOrder(field);

  //// Currently always sort:
  //if (sortOrder === null) { return field; }

  // Handle control subfield order (it never changes):
  swapSubfields(field, ['8', '6', '7', '3', 'a', '4', '2', '0', '1', '5', '9']);
  swapSubfields(field, sortOrder || defaultSortOderString);

  return field;
}

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
  if (replaceSubfieldWithBetterValue(targetField, candSubfield)) {
    return;
  }
  // Didn't do anything, but thinks something should have been done:
  debug(`TODO: Handle merging/adding subfield '‡${str}' to field`);
}
