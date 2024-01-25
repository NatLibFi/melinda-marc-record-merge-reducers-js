import clone from 'clone';
import {genericControlFieldCharPosFix as genericFix} from './controlFieldUtils';

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


export function setFormOfItem(baseField, sourceField, typeOfRecord) {
  const formOfItemPosition = getFormOfItemPosition();
  const baseFormOfItem = baseField.value.charAt(formOfItemPosition);
  // Use more specific value. o=online and q=direct electronic are better than generic s=electronic
  if (baseFormOfItem === 's') {
    const sourceFormOfItem = sourceField.value.charAt(formOfItemPosition);
    if (['o', 'q'].includes(sourceFormOfItem)) {
      baseField.value = `${baseField.value.substring(0, formOfItemPosition)}${sourceFormOfItem}${baseField.value.substring(formOfItemPosition + 1)}`; // eslint-disable-line functional/immutable-data
      return;
    }
  }

  function getFormOfItemPosition() {
    const f008Pos = ['VM', 'MP'].includes(typeOfRecord) ? 29 : 23;
    if (baseField.tag === '006') {
      return f008Pos - 17;
    }
    return f008Pos;
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


const singleCharacterPositionRules = [ // (Also fixed-value longer units)
  {types: ['MU'], prioritizedValues: goodFormsOfComposition, startPosition: 18, valueForUnknown: 'uu', noAttemptToCode: '||', description: 'Form of Composition (MU) 00/18-19'},
  {types: ['CR'], prioritizedValues: [' ', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'm', 'q', 's', 't', 'w', 'z'], startPosition: 18, valueForUnknown: 'u', noAttemptToCode: '|', description: 'CR frequency'},
  {types: ['CR'], prioritizedValues: ['n', 'r', 'x'], startPosition: 19, valueForUnknown: 'u', noAttemptToCode: '|'}, // CR regularity
  {types: ['MU'], prioritizedValues: ['a', 'b', 'c', 'd', 'e', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'p', 'z'], startPosition: 20, valueForUnknown: 'u', noAttemptToCode: '|'}, // Format of music
  {types: ['MU'], prioritizedValues: [' ', 'd', 'e', 'f', 'n'], startPosition: 21, valueForUnknown: 'u', noAttemptToCode: '|'}, // Music parts
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
  {types: ['BK'], prioritizedValues: [' ', 'a', 'b', 'c', 'd'], startPosition: 34, noAttemptToCode: '|'},
  {types: ['CR'], prioritizedValues: ['0', '1', '2'], startPosition: 34, noAttemptToCode: '|'}, // Entry convention
  {types: ['VM'], prioritizedValues: ['a', 'c', 'l', 'n', 'z'], startPosition: 34, valueForUnknown: 'u', noAttemptToCode: '|'} // VM technique
];

export function getSingleCharacterPositionRules() {
  return singleCharacterPositionRules;
}

function process008(base, source) {
  const [source008] = source.get(regexp008);
  // Stick with base if source if missing or no good:
  if (!source008 || source008.value.length !== 40) {
    return;
  }

  const [base008] = base.get(regexp008);
  // Copy missing 008 from source (theoretical)
  if (!base008) { // eslint-disable-line functional/no-conditional-statements
    const clonedField = clone(source008);
    base.insertField(clonedField);
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

  // Non-generic rules:
  if (baseTypeOfMaterial !== sourceTypeOfMaterial) {
    return;
  }
  setFormOfItem(base008, source008, baseTypeOfMaterial, sourceTypeOfMaterial); // 008/23 or 008/29: 'o' and 'q' are better than 's'. Sort of Item also uses generic fix. See above.

  // I haven't yet worked out how to do char=val&&multiple char positions combos.
  // Some of the positions we still need to think about are listed below:
  // NB! What about MP 009/33-34 Special format characteristics?
  // MU 008/24-29, 008/30-31
  // NB! We could theoretically have specific rule for BK 008/33 [defhijmps] > '1', couldn't we?


}

export default () => (base, source) => {

  process008(base, source);

  return {base, source};
};
