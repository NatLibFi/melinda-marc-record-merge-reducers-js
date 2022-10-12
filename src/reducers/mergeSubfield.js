import createDebugLogger from 'debug';
//import clone from 'clone';
//import {cloneAndRemovePunctuation} from './normalize.js';
//import {mayContainControlNumberIdentifier, normalizeControlSubfieldValue} from './normalizeIdentifier';
//import {normalizeAs, normalizeControlSubfieldValue} from '@natlibfi/marc-record-validators-melinda/dist/normalize-identifiers';
/*
import {
  fieldHasSubfield,
  fieldToString, isControlSubfieldCode, nvdebug,
  subfieldIsRepeatable, subfieldsAreIdentical
} from './utils.js';
*/

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeSubfield');

// NB! These are X00 specific. Should we somehow parametrize them?
const onlyBirthYear = /^[1-9][0-9]*-[,.]?$/u;
const onlyDeathYear = /^-[1-9][0-9]*[,.]?$/u;
const birthYearAndDeathYear = /^[1-9][0-9]*-[1-9][0-9]*[,.]?$/u;

function getDeathYear(str) {
  return parseInt(str.substring(str.indexOf('-') + 1), 10);
}

function isValidBirthYearAndDeathYear(str) {
  if (!birthYearAndDeathYear.test(str)) {
    return false;
  }
  // We have two years
  const b = parseInt(str, 10);
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

function replaceEntrysBirthAndDeathYear(targetField, candSubfield, relevantSubfields) {
  if (birthYearAndDeathYear.test(candSubfield.value)) {
    if (onlyBirthYear.test(relevantSubfields[0].value) && parseInt(relevantSubfields[0].value, 10) === parseInt(candSubfield.value, 10)) {
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

function replaceDatesAssociatedWithName(targetField, candSubfield, relevantSubfields) {
  // Add also the death year, if the original value only contains birth year.
  // This function treats only with X00$d subfields:
  if (candSubfield.code !== 'd' || !(/^[1678]00$/u).test(targetField.tag)) { // njsscan-ignore: regex_dos
    return false;
  }

  if (!anyYear(relevantSubfields[0].value) && anyYear(candSubfield.value)) {
    relevantSubfields[0].value = candSubfield.value; // eslint-disable-line functional/immutable-data
    return true;
  }

  if (replaceEntrysBirthAndDeathYear(targetField, candSubfield, relevantSubfields)) {
    return true;
  }
  return false;
}

export function mergeSubfield(targetField, candSubfield) {
  // Return true, if replace succeeds.
  // However, replacing/succeeding requires a sanity check, that the new value is a better one...
  // Thus, typically this function fails...
  const relevantSubfields = targetField.subfields.filter(subfield => subfield.code === candSubfield.code);
  if (relevantSubfields.length === 0) { // There must be something that gets replaced.
    return false;
  }
  debug(`Got ${relevantSubfields.length} sf-cands for field ${targetField.tag}‡${candSubfield.code}`);

  if (replaceDatesAssociatedWithName(targetField, candSubfield, relevantSubfields)) {
    return true;
  }
  return false; // default to failure
}
