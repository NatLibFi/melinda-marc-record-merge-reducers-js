import createDebugLogger from 'debug';
import {partsAgree, subfieldContainsPartData} from './normalizePart';

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

// use array.includes(value) for easy extendability (Swedish, other languages, abbrs, etc.()
function isKierreselka(value) {
  return ['kierreselkä'].includes(value);
}

function isKovakantinen(value) {
  return ['kovakantinen'].includes(value);
}

function isPehmeakantinen(value) {
  return ['pehmeäkantinen'].includes(value);
}

function isRengaskirja(value) {
  return ['rengaskirja'].includes(value);
}

function isSidottu(value) {
  return ['sid.', 'sidottu'].includes(value);
}

function isNidottu(value) {
  return ['nid.', 'nidottu'].includes(value);
}


function pairKovakantinen(candidateSubfields) {
  return candidateSubfields.find(sf => sf.code === 'q' && isSidottu(sf.value));
}

function pairPehmeakantinen(candidateSubfields) {
  return candidateSubfields.find(sf => sf.code === 'q' && isNidottu(sf.value));
}

function pairKierreselka(candidateSubfields) {
  return candidateSubfields.find(sf => sf.code === 'q' && isRengaskirja(sf.value));
}


function findCounterpartForCoverType(coverType, candidateSubfields) {
  if (isKovakantinen(coverType)) {
    return pairKovakantinen(candidateSubfields);
  }
  if (isPehmeakantinen(coverType)) {
    return pairPehmeakantinen(candidateSubfields);
  }
  if (isKierreselka(coverType)) {
    return pairKierreselka(candidateSubfields);
  }
  return null;
}


function mapBindingToCoverType(field, candSubfield, relevantSubfields) {
  if (field.tag !== '020' || candSubfield.code !== 'q') {
    return false;
  }
  // See if base's field has a binding and source subfield has a cover. If so, replace subfield value:
  const originalSubfieldQ = findCounterpartForCoverType(candSubfield.value, relevantSubfields);
  if (originalSubfieldQ) {
    originalSubfieldQ.value = candSubfield.value; // eslint-disable-line functional/immutable-data
    return true;
  }
  // Vice versa: if original value is cover type nad new value is ye olde binding, return true.
  // Then change is considered to have happenened.
  if (isNidottu(candSubfield.value) && relevantSubfields.some(sf => isPehmeakantinen(sf.value))) {
    return true;
  }
  if (isSidottu(candSubfield.value) && relevantSubfields.some(sf => isKovakantinen(sf.value))) {
    return true;
  }
  if (isRengaskirja(candSubfield.value) && relevantSubfields.some(sf => isKierreselka(sf.value))) {
    return true;
  }


  return false;
}

export function mergeSubfield(targetField, candSubfield) {
  // Replace existing subfield with the incoming field. These replacements are by name rather hacky...
  // Currenty we only select the better X00$d.
  // In future we might do more things here. Examples:
  // - "FOO" gets replaced by "Foo" in certain fields.
  // - "Etunimi Sukunimi" might lose to "Sukunimi, Etunimi" in X00 fields.
  // - [put your ideas here]
  // Return true, if replace is done.
  // However, replacing/succeeding requires a sanity check, that the new value is a better one...
  // Thus, typically this function fails...

  const relevantSubfields = targetField.subfields.filter(subfield => subfield.code === candSubfield.code);
  if (relevantSubfields.length === 0) { // There must be something that gets replaced.
    return false;
  }
  debug(`Got ${relevantSubfields.length} sf-cands for field ${targetField.tag}‡${candSubfield.code}`);

  if (replaceDatesAssociatedWithName(targetField, candSubfield, relevantSubfields) ||
      mapBindingToCoverType(targetField, candSubfield, relevantSubfields)) {
    return true;
  }


  // Mark 490$v "osa 1" vs "1" as merged (2nd part of MET-53).
  // NB! Keeps the original value and drops the incoming value. (Just preventing it from going to add-part...)
  // NB! We could improve this and choose the longer value later on.
  if (subfieldContainsPartData(targetField.tag, candSubfield.code)) {
    if (relevantSubfields.some(sf => partsAgree(sf.value, candSubfield.value, targetField.tag, candSubfield.code))) {
      return true;
    }
  }
  return false; // default to failure
}
