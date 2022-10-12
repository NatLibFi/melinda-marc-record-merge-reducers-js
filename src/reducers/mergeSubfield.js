import createDebugLogger from 'debug';
import clone from 'clone';
import {cloneAndRemovePunctuation} from './normalize.js';
//import {mayContainControlNumberIdentifier, normalizeControlSubfieldValue} from './normalizeIdentifier';
import {normalizeAs, normalizeControlSubfieldValue} from '@natlibfi/marc-record-validators-melinda/dist/normalize-identifiers';
import {
  fieldHasSubfield,
  fieldToString, isControlSubfieldCode, nvdebug,
  subfieldIsRepeatable, subfieldsAreIdentical
} from './utils.js';
import {sortAdjacentSubfields} from './sortSubfields.js';

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

function replaceSubfieldWithBetterValue(targetField, candSubfield) {
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


function insertSubfieldAllowed(targetField, candSubfield) {
  // NB! If insert is not allowed, the candicate subfield can still replace the original. (Not handled by this function though.)

  // Subfield codes missing from the original record can be added by default:
  if (!fieldHasSubfield(targetField, candSubfield.code)/* && okToInsertTagCode(targetField.tag, candSubfield.code)*/) {
    return true;
  }
  // melindaCustomMergeFields.json tells us whether the subfield is repeatable or not:
  return subfieldIsRepeatable(targetField.tag, candSubfield.code);
}

function mergeSubfieldNotRequiredSpecialCases(targetField, candSubfield) {
  // Add hard-coded exceptions here
  if (targetField.tag === '040' && candSubfield.code === 'd' &&
      targetField.subfields.some(sf => sf.code === 'a' && sf.value === candSubfield.value)) {
    debug('040‡d matched 040‡a');
    return true;
  }
  if (candSubfield.code === 'g' && candSubfield.value === 'ENNAKKOTIETO.') {
    // Skip just ‡g subfield or the whole field?
    // We decided to skip just this subfield. We want at least $0 and maybe more even from ennakkotieto.
    debug('Skip ‡g ENNAKKOTIETO.');
    return true;
  }
  // Don't add $0 subfields that mean the same even if they look different:
  const alephIdentifierType = normalizeAs(targetField.tag, candSubfield.code);
  if (alephIdentifierType !== undefined) {
    const normalizedSubfieldValue = normalizeControlSubfieldValue(candSubfield.value, alephIdentifierType);
    if (targetField.subfields.some(sf => normalizeControlSubfieldValue(sf.value) === normalizedSubfieldValue && sf.code === candSubfield.code)) {
      return true;
    }
  }
  return false;
}

function mergeSubfieldNotRequired(targetField, candSubfield) {
  // candSubfield has been stripped of punctuation.
  const normalizedTargetField = cloneAndRemovePunctuation(targetField);

  nvdebug(`     Look for identical subfields in '${fieldToString(normalizedTargetField)}'`);

  if (normalizedTargetField.subfields.some(sf => subfieldsAreIdentical(sf, candSubfield))) {
    // Subfield with identical normalized value exists. Do nothing.
    // Not ideal 382‡n subfields, I guess... Nor 505‡trg repetitions... These need to be fixed...
    return true;
  }
  if (mergeSubfieldNotRequiredSpecialCases(targetField, candSubfield)) {
    return true;
  }

  return false; // (note that this is a double negation: not required is false)
}

function addSubfield(targetField, candSubfield) {
  const str = `${candSubfield.code} ${candSubfield.value}`;
  nvdebug(` Added subfield ‡'${str}' to field`, debug);
  // Add subfield to the end of all subfields. NB! Implement a separate function that does this + subfield reordering somehow...
  targetField.subfields.push(candSubfield); // eslint-disable-line functional/immutable-data
  if (!isControlSubfieldCode(candSubfield.code)) { // eslint-disable-line functional/no-conditional-statement
    targetField.punctuate = 1; // eslint-disable-line functional/immutable-data
  }
  targetField.merged = 1; // eslint-disable-line functional/immutable-data
  sortAdjacentSubfields(targetField);
}

export function mergeSubfield(record, targetField, candSubfield) {
  nvdebug(`   Q: mergeSubfield '‡${candSubfield.code} ${candSubfield.value}'`, debug);
  nvdebug(`      with field '${fieldToString(targetField)}'?`, debug);
  if (mergeSubfieldNotRequired(targetField, clone(candSubfield))) {
    nvdebug(`    A: No. No need to merge subfield '‡${candSubfield.code} ${candSubfield.value}'`, debug);
    return;
  }

  if (insertSubfieldAllowed(targetField, candSubfield)) {
    nvdebug(`    A: Yes. Add subfield '‡${candSubfield.code} ${candSubfield.value}'`, debug);

    addSubfield(targetField, candSubfield);
    return;
  }

  // Currently only X00$d 1984- => 1984-2000 type of changes.
  // It all other cases the original subfield is kept.
  if (replaceSubfieldWithBetterValue(targetField, candSubfield)) {
    nvdebug(`    A: Yes. Subfield '‡${candSubfield.code} ${candSubfield.value}' replaces and original subfield.`, debug);
    targetField.merged = 1; // eslint-disable-line functional/immutable-data
    targetField.punctuate = 1; // eslint-disable-line functional/immutable-data
    return;
  }

  // Didn't do anything, but thinks something should have been done:
  nvdebug(`    A: Could not decide. Add decision rules. 'Til then, do nothing to '‡${candSubfield.code} ${candSubfield.value}'`, debug);
}
