import createDebugLogger from 'debug';
import {partsAgree, subfieldContainsPartData} from '@natlibfi/marc-record-validators-melinda/dist/normalizeSubfieldValueForComparison';
import {valueCarriesMeaning} from './worldKnowledge';
import {nvdebug} from './utils';
import {tagAndSubfieldCodeReferToIsbn} from '@natlibfi/marc-record-validators-melinda/dist/normalizeFieldForComparison.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeSubfield');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

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
  return ['kierreselkä', 'spiral bound', 'spiral-bound', 'spiralrygg'].includes(value);
}

function isKovakantinen(value) {
  return ['hardback', 'hardcover', 'hårda pärmar', 'kovakantinen'].includes(value);
}

function isPehmeakantinen(value) {
  return ['mjuka pärmar', 'paperback', 'pehmeäkantinen', 'softcover'].includes(value);
}

function isItsenainenJatkoOsa(value) {
  if (value.match(/^Fristående fortsättning på verket[^a-z]*$/ui)) {
    return true;
  }
  if (value.match(/^Itsenäinen jatko-osa teokselle[^a-z]*$/ui)) {
    return true;
  }
  return false;
}

function isSisaltaaTeos(value) {
  if (value.match(/^Innehåller \(verk\)[^a-z]*$/ui)) {
    return true;
  }
  if (value.match(/^Sisältää \(teos\)[^a-z]*$/ui)) {
    return true;
  }
  return false;
}
function relationInformationMatches(candSubfield, relevantSubfields) {
  if (isSisaltaaTeos(candSubfield.value) && relevantSubfields.some(sf => isSisaltaaTeos(sf.value))) {
    return true;
  }
  if (isItsenainenJatkoOsa(candSubfield.value) && relevantSubfields.some(sf => isItsenainenJatkoOsa(sf.value))) {
    return true;
  }

  return false;
}

function coverTypesMatch(candSubfield, relevantSubfields) {
  if (isPehmeakantinen(candSubfield.value) && relevantSubfields.some(sf => isPehmeakantinen(sf.value))) {
    return true;
  }
  if (isKovakantinen(candSubfield.value) && relevantSubfields.some(sf => isKovakantinen(sf.value))) {
    return true;
  }
  if (isKierreselka(candSubfield.value) && relevantSubfields.some(sf => isKierreselka(sf.value))) {
    return true;
  }
  return false;
}

function httpToHttps(val) {
  return val.replace(/http:\/\//ug, 'https://');
}

function pairHttpAndHttps(candSubfield, relevantSubfields) {
  const a = httpToHttps(candSubfield.value);
  const bs = relevantSubfields.map(sf => httpToHttps(sf.value));
  return bs.includes(a);
}

function isSynonym(field, candSubfield, relevantSubfields) {
  if (candSubfield.code === 'q' && ['015', '020', '024', '028'].includes(field.tag)) {
    return coverTypesMatch(candSubfield, relevantSubfields);
  }

  if (candSubfield.code === 'i') {
    return relationInformationMatches(candSubfield, relevantSubfields);
  }
  if (pairHttpAndHttps(candSubfield, relevantSubfields)) {
    return true;
  }

  return false;
}

function preferHyphenatedISBN(field, candSubfield, relevantSubfields) {
  if (!tagAndSubfieldCodeReferToIsbn(field.tag, candSubfield.code) || candSubfield.value.includes('-') === -1) {
    return false;
  }

  // Must not already exist:
  if (relevantSubfields.some(sf => sf.value === candSubfield.value)) {
    return false;
  }

  const hyphenlessSubfields = relevantSubfields.filter(sf => sf.value.includes('-') > -1);
  const pair = hyphenlessSubfields.find(sf => sf.value === candSubfield.value.replace(/-/gu, ''));
  if (!pair) {
    return false;
  }
  pair.value = candSubfield.value; // eslint-disable-line functional/immutable-data
  return true;
}

function preferHttpsOverHttp(candSubfield, relevantSubfields) {
  if (candSubfield.value.substring(0, 8) !== 'https://') {
    return false;
  }

  const httpVersion = `http://${candSubfield.value.substring(8)}`;
  const pair = relevantSubfields.find(sf => sf.value === httpVersion);

  if (!pair) {
    return false;
  }
  pair.value = candSubfield.value; // eslint-disable-line functional/immutable-data
  return true;
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

  // There's nothing to replace the incoming subfield with. Thus abort:
  if (relevantSubfields.length === 0) {
    return false;
  }

  nvdebug(`Got ${relevantSubfields.length} sf-cand(s) for field ${targetField.tag}‡${candSubfield.code}`, debugDev);


  if (replaceDatesAssociatedWithName(targetField, candSubfield, relevantSubfields) ||
      preferHyphenatedISBN(targetField, candSubfield, relevantSubfields) ||
      preferHttpsOverHttp(candSubfield, relevantSubfields) ||
      isSynonym(targetField, candSubfield, relevantSubfields)) {
    return true;
  }

  // We found a crappy empty subfield: replace that with a meaningful one.
  // 260 $a value "[S.l]" is the main type for this.
  const meaninglessSubfields = relevantSubfields.filter(sf => !valueCarriesMeaning(targetField.tag, sf.code, sf.value));
  if (meaninglessSubfields.length > 0) {
    meaninglessSubfields[0].value = candSubfield.value; // eslint-disable-line functional/immutable-data
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
