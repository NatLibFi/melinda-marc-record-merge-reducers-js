import createDebugLogger from 'debug';
import {
  fieldHasSubfield,
  fieldIsRepeatable,
  fieldToString,
  normalizeStringValue
} from './utils.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

const excludeSubfieldsFromMerge = [
  {'tag': '020', 'subfields': 'c'},
  {'tag': '022' },
  {'tag': '024', 'subfields': 'c'}
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

function insertSubfieldAllowed(targetField, candSubfield) {
  // NB! If insert is not allowed, the candicate subfield can still replace the original. (Not handled by this function though.)

  // Subfields missing from the original can be added:
  if (!fieldHasSubfield(targetField, candSubfield.code)) { //
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
  debug(`NO DROPPABLES FOUND FOR ${field.tag}.`);
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
  // Hey! We don't want this subfield:
  const droppableSubfieldsAsString = listDroppableSubfields(targetField);
  if (droppableSubfieldsAsString.includes(candSubfield.code)) {
    return true;
  }

  return false;
}

export function mergeSubfield(record, targetField, candSubfield) {
  const str = `${candSubfield.code} ${candSubfield.value}`;
  if (mergeSubfieldNotRequired(targetField, candSubfield)) {
    debug(`    No need to add '‡${candSubfield.code} ${candSubfield.value}'`);
    return;
  }

  if (insertSubfieldAllowed(targetField, candSubfield)) {
    debug(` Added subfield ‡'${str}' to field`);
    // Add subfield to the end of all subfields. NB! Implement a separate function that does this + subfield reordering somehow...
    targetField.subfields.push(JSON.parse(JSON.stringify(candSubfield))); // eslint-disable-line functional/immutable-data
    return;
  }
  if (replaceSubfield(targetField, candSubfield)) {
    return;
  }
  debug(`TODO: Handle merging/adding subfield '‡${str}' to field`);
}
