import clone from 'clone';
import {genericControlFieldCharPosFix as genericFix, hasLegalLength} from './controlFieldUtils';
import {uniqArray} from './utils';

// NB! Used by field 006 as well as 008/18-34 = 006/01-17...

//import {MarcRecord} from '@natlibfi/marc-record';
//import createDebugLogger from 'debug';

//const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:field008');
const regexp008 = /^008$/u;

function getDateEnteredOnFile(field008) {
  return field008.value.substring(0, 6);
}

function getLanguage(field008) {
  return field008.value.substring(35, 38);
}


function setOlderDateToBase(base008, source008) { // 008/00-05
  // Base's LDR/17 should (almost) always be better than sources, so I'm not checking it
  const baseDate = getDateEnteredOnFile(base008);
  const sourceDate = getDateEnteredOnFile(source008);

  // Add century-prefix '19' or '20':
  const baseDate2 = `${getCentury(baseDate)}${baseDate}`;
  const sourceDate2 = `${getCentury(sourceDate)}${sourceDate}`;

  // Keep base's 008/00-05 date if it is older:
  if (parseInt(baseDate2, 10) <= parseInt(sourceDate2, 10)) {
    return;
  }

  // Use 008/00-05 date from source
  base008.value = `${sourceDate}${base008.value.substring(6)}`; // eslint-disable-line functional/immutable-data

  function getCentury(decadeString) {
    if (['5', '6', '7', '8', '9'].includes(decadeString.charAt(0))) {
      return '19';
    }
    return '20';
  }
}

function sourceTypeOfDateIsBetter(base008Value, source008Value) {
  const typeOfDateB = base008Value.substring(6, 7);
  const typeOfDateS = source008Value.substring(6, 7);
  // Source knows that CR has ended, base does not...
  if (typeOfDateS === 'd' && ['c', 'u', '|'].includes(typeOfDateB)) {
    return true;
  }
  return false;
}

function setDates(base008, source008) { // 008/06-14 (stub, extend later on)
  if (sourceTypeOfDateIsBetter(base008.value, source008.value)) {
    base008.value = `${getDateEnteredOnFile(base008)}${source008.value.substring(6, 15)}${base008.value.substring(15)}`; // eslint-disable-line functional/immutable-data
    return;
  }
}

// NB! good, not all, since uu/unknown and '||' are not listed:
const goodFormsOfComposition = ['an', 'bd', 'bg', 'bl', 'bt', 'ca', 'cb', 'cc', 'cg', 'ch', 'cl', 'cn', 'co', 'cp', 'cr', 'cs', 'ct', 'cy', 'cz', 'df', 'dv', 'fg', 'fl', 'fm', 'ft', 'gm', 'hy', 'jz', 'mc', 'md', 'mi', 'mo', 'mp', 'mr', 'ms', 'mu', 'mz', 'nc', 'nn', 'op', 'or', 'ov', 'pg', 'pm', 'po', 'pp', 'pr', 'ps', 'pt', 'rc', 'rd', 'rg', 'ri', 'rp', 'rq', 'sd', 'sg', 'sn', 'sp', 'st', 'su', 'sy', 'tc', 'tl', 'ts', 'vi', 'vr', 'wz', 'za', 'zz'];
const goodProjections = ['aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'am', 'an', 'ap', 'au', 'az', 'ba', 'bb', 'bc', 'bd', 'be', 'bf', 'bg', 'bh', 'bi', 'bj', 'bk', 'bl', 'bo', 'br', 'bs', 'bu', 'bz', 'ca', 'cb', 'cc', 'ce', 'cp', 'cu', 'cz', 'da', 'db', 'dc', 'dd', 'de', 'df', 'dg', 'dh', 'dl', 'zz']; // MP 008-22/23

export function setFormOfItem(baseField, sourceField, baseTypeOfMaterial, sourceTypeOfMaterial) {
  const baseFormOfItemPosition = getFormOfItemPosition(baseTypeOfMaterial);
  const baseFormOfItem = baseField.value.charAt(baseFormOfItemPosition);
  // Use more specific value. o=online and q=direct electronic are better than generic s=electronic
  if (baseFormOfItem === 's') {
    const sourceFormOfItemPosition = getFormOfItemPosition(sourceTypeOfMaterial);
    const sourceFormOfItem = sourceField.value.charAt(sourceFormOfItemPosition);
    if (['o', 'q'].includes(sourceFormOfItem)) {
      baseField.value = `${baseField.value.substring(0, baseFormOfItemPosition)}${sourceFormOfItem}${baseField.value.substring(baseFormOfItemPosition + 1)}`; // eslint-disable-line functional/immutable-data
      return;
    }
  }

  function getFormOfItemPosition(typeOfMaterial) {
    const f008Pos = ['VM', 'MP'].includes(typeOfMaterial) ? 29 : 23;
    if (baseField.tag === '006') {
      return f008Pos - 17;
    }
    return f008Pos;
  }
}

export function isSpecificLiteraryForm(literaryFormCharacter) {
  return ['d', 'e', 'f', 'h', 'i', 'j', 'm', 'p', 's', 'u'].includes(literaryFormCharacter);
}

export function setLiteraryForm(baseField, sourceField, baseTypeOfMaterial, sourceTypeOfMaterial) {
  if (baseTypeOfMaterial !== 'BK' || sourceTypeOfMaterial !== 'BK') {
    return;
  }
  const literaryFormPosition = baseField.tag === '006' ? 16 : 33;
  const baseLiteraryForm = baseField.value.charAt(literaryFormPosition);
  // Use more specific value. o=online and q=direct electronic are better than generic s=electronic
  if (baseLiteraryForm === '1') {
    const sourceLiteraryForm = sourceField.value.charAt(literaryFormPosition);
    if (isSpecificLiteraryForm(sourceLiteraryForm)) {
      baseField.value = `${baseField.value.substring(0, literaryFormPosition)}${sourceLiteraryForm}${baseField.value.substring(literaryFormPosition + 1)}`; // eslint-disable-line functional/immutable-data
      return;
    }
  }
}


function getPlaceOfPublication(field008) {
  return field008.value.substring(15, 18);
}

function setPlaceOfPublication(base008, source008) { // 008/15-17
  const basePlaceOfPub = getPlaceOfPublication(base008);
  if (['xx ', '|||'].includes(basePlaceOfPub)) {
    base008.value = `${base008.value.substring(0, 15)}${getPlaceOfPublication(source008)}${base008.value.substring(18)}`; // eslint-disable-line functional/immutable-data
    return;
  }
}


function setLanguage(base008, source008) {
  const langB = getLanguage(base008);
  const langS = getLanguage(source008);

  if (langB === '|||' && langS.match(/^[a-z]{3}$/u)) {
    base008.value = `${base008.value.substring(0, 35)}${langS}${base008.value.substring(38)}`; // eslint-disable-line functional/immutable-data
    return;
  }
}

function setCatalogingSource(base008, source008) {
  const catSource = getBetterCatalogingSource(base008, source008);
  base008.value = `${base008.value.substring(0, 39)}${catSource}`; // eslint-disable-line functional/immutable-data

  function getBetterCatalogingSource(base008, source008) {
    const b39 = base008.value.substring(39);
    const s39 = source008.value.substring(39);
    if (b39 === ' ' || s39 === ' ') {
      return ' ';
    }
    if (b39 === 'c' || s39 === 'c') {
      return 'c';
    }
    if (b39 === 'd' || s39 === 'd') {
      return 'd';
    }
    if (b39 === 'u' || s39 === 'u') {
      return 'u';
    }
    return '|';
  }
}

const BIG_BAD_VALUE = 999999999;

function sortChars(string, reallySort = true) { // similiar code is in validator side. Refactor and export that code and use it later on.
  // NB! If reallySort is false, we only move '#' and '|' to the end, and meaningful data to the front, even if reallySort is false.
  const charArray = string.split('');

  charArray.sort(function(a, b) { // eslint-disable-line functional/immutable-data, prefer-arrow-callback
    return scoreChar(a) - scoreChar(b);
  });

  return charArray.join('');

  function scoreChar(c) {
    if (c === '|' || c === ' ') {
      return BIG_BAD_VALUE; // Max value, these should code last
    }
    if (!reallySort) {
      return 1;
    }
    const asciiCode = c.charCodeAt(0);
    // a-z get values 1-26:
    if (asciiCode >= 97 && asciiCode <= 122) {
      return asciiCode - 96;
    }
    // 0-9 get values 100-109 (sorting numbers *after* alphabets might not always be right...)
    if (asciiCode >= 48 && asciiCode <= 57) {
      return asciiCode + 52;
    }
    // Others (=crap) return something between '9' and BIG BAD VALUE
    return asciiCode + 200;
  }
}

function keepOnlyUniqueMeaningfulChars(str, dataChars = undefined) {
  //console.info(`CONC: '${str}'`); // eslint-disable-line no-console
  const arr = uniqArray(str.split('')).filter(c => !dataChars || dataChars.indexOf(c) > -1); // Remove blanks '|', '#' and erronous values
  return arr.join('');
}

function mergeStrings(str1, str2) {
  //console.info(`STR1: '${str1}'\nSTR2: '${str2}'`); // eslint-disable-line no-console
  const concatenatedStrings = `${str1}${str2}`;
  return keepOnlyUniqueMeaningfulChars(concatenatedStrings);
}

function resizeNewValue(str, targetLength) {
  const origLength = str.length;
  if (origLength > targetLength) {
    return str.substring(0, targetLength);
  }
  if (origLength < targetLength) {
    return `${str}${' '.repeat(targetLength - origLength)}`;
  }
  return str;
}

function extractLegalValues(string, startPosition, length, legalValuesAsString) {
  const originalValue = string.substring(startPosition, startPosition + length);
  return keepOnlyUniqueMeaningfulChars(originalValue, legalValuesAsString);
}

// Export, so that field006.js can use this!
export function mergeNatureOfContents(baseField, sourceField, baseTypeOfMaterial, sourceTypeOfMaterial) {
  // Can't use generic code, as BK and CR behave a bit differently and have slightly different values
  if (!['BK', 'CR'].includes(baseTypeOfMaterial) || !['BK', 'CR'].includes(sourceTypeOfMaterial)) {
    return;
  }
  const baseString = getNatureOfContentsString(baseField, baseTypeOfMaterial);
  const sourceString = getNatureOfContentsString(sourceField, baseTypeOfMaterial);
  const mergedString = mergeStrings(baseString, sourceString);
  if (baseString.length === mergedString.length) { // No additions
    return;
  }
  const finalValue = tuneNatureOfContentValue(mergedString);
  console.info(`B: '${baseString}' +\nS: '${sourceString}' =\n   '${finalValue}'`); // eslint-disable-line no-console
  const startPosition = getNatureOfContentsStartPosition(baseField);
  baseField.value = `${baseField.value.substring(0, startPosition)}${finalValue}${baseField.value.substring(startPosition + 4)}`; // eslint-disable-line functional/immutable-data
  return;

  function tuneNatureOfContentValue(string) {
    if (baseTypeOfMaterial === 'BK') {
      return sortChars(resizeNewValue(string, 4), true);
    }
    // SE is way trickier: one value goes to 008/24 and multivals go to 008/25-27. However, 008/24-27 can be '#a##', and we want to keep it that way.
    // Base side has already been handled above (by keeping the original). Source side happens only if base contains no information:
    if (baseString.length === 0) {
      const startPosition = getNatureOfContentsStartPosition(sourceField);
      return sourceField.value.substring(startPosition, startPosition + 4);
    }
    // At this point 008/24 should be handled, and only 008/25-27 remains, so 008/24=# and rest goes to 008/25-27:
    return ` ${sortChars(resizeNewValue(string, 3), true)}`;
  }

  function getNatureOfContentsStartPosition(field) {
    return field.tag === '006' ? 7 : 24;
  }

  function getNatureOfContentsString(field, baseTypeOfMaterial) {
    // Bit of overhead here (rechecking the start position). I'm thinking of theoretical situaion where we want to enrich base 008, using data from corresponding
    // source 006. This is unlikely to happen, but this makes things more robust.
    const startPosition = getNatureOfContentsStartPosition(field);
    // Pick only the values that are supported by base type of material ()
    // Only BK: j/patert document and 2/offprints
    // Only SE: h/Biography
    const legalVals = baseTypeOfMaterial === 'BK' ? 'abcdefgijklmnopqrstuvwyz256' : 'abcdefghiklmnopqrstuvwyz56';
    //                                                                              'abcdefghiklmnopqrstuvwyz56'
    return extractLegalValues(field.value, startPosition, 4, legalVals);
  }

}


// Export, so that field006.js can use this!
export function genericMergeMultiCharRule(baseField, sourceField, rule) {
  // Type of material has already been checked at this point.
  const baseString = getMultiCharString(baseField);
  const sourceString = getMultiCharString(sourceField);
  const mergedString = mergeStrings(baseString, sourceString);
  if (mergedString.length === baseString.length) { // No new data
    return;
  }

  const finalValue = sortChars(resizeNewValue(mergedString, rule.length), rule.sort);
  const startPosition = getMultiCharStartPosition(baseField);
  baseField.value = `${baseField.value.substring(0, startPosition)}${finalValue}${baseField.value.substring(startPosition + rule.length)}`; // eslint-disable-line functional/immutable-data
  return;

  function getMultiCharStartPosition(field) {
    return field.tag === '006' ? rule.startPosition - 16 : rule.startPosition;
  }

  function getMultiCharString(field) {
    // Very theoretically we might merge data from 006 and 008. Thus start position is checked for both fields.
    const startPosition = getMultiCharStartPosition(field);
    return extractLegalValues(field.value, startPosition, rule.length, rule.relevantValues);
  }
}

const singleCharacterPositionRules = [ // (Also fixed-value longer units)
  {types: ['MU'], prioritizedValues: goodFormsOfComposition, startPosition: 18, valueForUnknown: 'uu', noAttemptToCode: '||', description: 'Form of Composition (MU) 00/18-19'},
  {types: ['CR'], prioritizedValues: [' ', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'm', 'q', 's', 't', 'w', 'z'], startPosition: 18, valueForUnknown: 'u', noAttemptToCode: '|', description: 'CR frequency'},
  {types: ['CR'], prioritizedValues: ['n', 'r', 'x'], startPosition: 19, valueForUnknown: 'u', noAttemptToCode: '|', description: 'CR regularity'},
  {types: ['MU'], prioritizedValues: ['a', 'b', 'c', 'd', 'e', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'p', 'z'], startPosition: 20, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Format of music'},
  {types: ['MU'], prioritizedValues: [' ', 'd', 'e', 'f', 'n'], startPosition: 21, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Music parts'}, // Music parts
  {types: ['CR'], prioritizedValues: [' ', 'd', 'g', 'h', 'j', 'l', 'm', 'n', 'p', 'r', 's', 't', 'w'], startPosition: 21, noAttemptToCode: '|'}, // Music parts
  {types: ['BK', 'CF', 'MU', 'VM'], prioritizedValues: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'j'], startPosition: 22, valueForUnknown: ' ', noAttemptToCode: '|', description: 'Target audience, 008/22'},
  {types: ['MP'], prioritizedValues: goodProjections, startPosition: 22, valueForUnknown: '  ', noAttemptToCode: '||'}, // MP projection 008/22-23
  {types: ['CR'], prioritizedValues: [' ', 'a', 'b', 'c', 'd', 'e', 'f', 'o', 'q', 's'], startPosition: 22, noAttemptToCode: '|'}, // CR 008/22
  {types: ['BK', 'CR', 'MU', 'MX'], prioritizedValues: [' ', 'a', 'b', 'c', 'd', 'f', 'o', 'q', 'r', 's'], startPosition: 23, noAttemptToCode: '|', description: 'Non-CF form of item'},
  {types: ['CF'], prioritizedValues: [' ', 'o', 'q'], startPosition: 23, noAttemptToCode: '|'}, // CF form of item
  {types: ['CR'], prioritizedValues: [' ', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '5', '6'], startPosition: 24, noAttemptToCode: '|', description: 'Music parts'},
  {types: ['MP'], prioritizedValues: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'z'], startPosition: 25, valueForUnknown: 'u', noAttemptToCode: '|'}, // MP type of cartographic material
  {types: ['CF'], prioritizedValues: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'm', 'z'], startPosition: 26, valueForUnknown: 'u', noAttemptToCode: '|'}, // Type of computer file 008/23
  {types: ['BK', 'CF', 'CR', 'MP', 'VM'], prioritizedValues: [' ', 'a', 'c', 'f', 'i', 'l', 'm', 'o', 's', 'z'], startPosition: 28, valueForUnknown: 'u', noAttemptToCode: '|'}, // Government publication
  {types: ['BK', 'CR'], prioritizedValues: ['0', '1'], startPosition: 29, noAttemptToCode: '|'}, // Conference publication
  {types: ['MP', 'VM'], prioritizedValues: [' ', 'a', 'b', 'c', 'd', 'f', 'o', 'q', 'r', 's'], startPosition: 29, noAttemptToCode: '|'}, // BK form of item
  {types: ['BK'], prioritizedValues: ['0', '1'], startPosition: 30, noAttemptToCode: '|'}, // Festschrift
  {types: ['BK', 'MP'], prioritizedValues: ['0', '1'], startPosition: 31, noAttemptToCode: '|'}, // Index
  {types: ['BK'], prioritizedValues: ['0', '1', 'd', 'e', 'f', 'h', 'i', 'j', 'm', 'p', 's'], startPosition: 33, valueForUnknown: 'u', noAttemptToCode: '|'},
  {types: ['MU'], prioritizedValues: [' ', 'a', 'b', 'c', 'n'], startPosition: 33, valueForUnknown: 'u', noAttemptToCode: '|'},
  {types: ['CR'], prioritizedValues: [' ', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'z'], startPosition: 33, valueForUnknown: 'u', noAttemptToCode: '|'}, // CR original alphabet or script of title
  {types: ['VM'], prioritizedValues: ['a', 'b', 'c', 'd', 'f', 'g', 'i', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'v', 'w', 'z'], startPosition: 33, noAttemptToCode: '|'}, // VM type of visual material
  {types: ['BK'], prioritizedValues: [' ', 'a', 'b', 'c', 'd'], startPosition: 34, noAttemptToCode: '|', description: 'biography'},
  {types: ['CR'], prioritizedValues: ['0', '1', '2'], startPosition: 34, noAttemptToCode: '|'}, // Entry convention
  {types: ['VM'], prioritizedValues: ['a', 'c', 'l', 'n', 'z'], startPosition: 34, valueForUnknown: 'u', noAttemptToCode: '|'} // VM technique
];

const allGenericMulticharRules = [
  {types: ['BK'], startPosition: 18, length: 4, relevantValues: 'abcdefghijklmop', sort: true, description: 'Illustrations'},
  {types: ['MP'], startPosition: 18, length: 4, relevantValues: 'abcdefgijkmz', sort: false, description: 'Relief'},
  {types: ['MP'], startPosition: 33, length: 2, relevantValues: 'ejklnoprz', sort: false, description: 'Special format characteristics'},
  {types: ['MU'], startPosition: 24, length: 6, relevantValues: 'abcdefghikrsz', sort: true, description: 'Accompanying matter'},
  {types: ['MU'], startPosition: 30, length: 2, relevantValues: 'abcdefghijklmnoprstz', sort: true, description: 'Literary text for sound recordings'}
];

export function getSingleCharacterPositionRules() {
  return singleCharacterPositionRules;
}

export function getMultiCharacterPositionRules() {
  return allGenericMulticharRules;
}

function process008(base, source) {
  const [source008] = source.get(regexp008);
  // Stick with base if source if missing or no good:
  if (!source008 || !hasLegalLength(source008)) {
    return;
  }

  const [base008] = base.get(regexp008);
  // Copy missing 008 from source (theoretical)
  if (!base008) {
    const clonedField = clone(source008);
    base.insertField(clonedField);
    return;
  }
  if (!hasLegalLength(base008)) {
    base008.value = source008.value; // eslint-disable-line functional/immutable-data
    return;
  }

  //console.info(`B: '${base008.value}'\nS: '${source008.value}'`); // eslint-disable-line no-console

  // Switch fields it base has illegal length:
  if (base008.value.length !== 40) {
    base008.value = source008.value; // eslint-disable-line functional/immutable-data
    return;
  }

  //console.info(`${base008.value}\n${source008.value}`); // eslint-disable-line no-console

  // All materials (008/00-17, and 008/35-39)
  setOlderDateToBase(base008, source008); // 008/00-05
  setDates(base008, source008); // 008/06,07-10,11-14
  setPlaceOfPublication(base008, source008); // 008/15-17

  setLanguage(base008, source008); // 008/35-37
  setCatalogingSource(base008, source008); // 008/39
  // Type of material specific code:
  const baseTypeOfMaterial = base.getTypeOfMaterial();
  const sourceTypeOfMaterial = source.getTypeOfMaterial();
  singleCharacterPositionRules.forEach(rule => genericFix(base008, source008, baseTypeOfMaterial, sourceTypeOfMaterial, rule));

  // Non-generic rules that require non-generic code:
  setFormOfItem(base008, source008, baseTypeOfMaterial, sourceTypeOfMaterial); // 008/23 or 008/29: 'o' and 'q' are better than 's'. Sort of Item also uses generic fix. See above.
  setLiteraryForm(base008, source008, baseTypeOfMaterial, sourceTypeOfMaterial); // BK 008/33 and 006/16 (selects more specific value if possible)
  mergeNatureOfContents(base008, source008, baseTypeOfMaterial, sourceTypeOfMaterial); // BK and CR 008/24-27 (with CR 008/24 adn 008/25-27 being in either-or relation)
  // Generic rules:
  const relevantMulticharRules = allGenericMulticharRules.filter(rule => rule.types.includes(baseTypeOfMaterial) && rule.types.includes(sourceTypeOfMaterial));
  relevantMulticharRules.forEach(rule => genericMergeMultiCharRule(base008, source008, rule));

}

export default () => (base, source) => {

  process008(base, source);

  return {base, source};
};
