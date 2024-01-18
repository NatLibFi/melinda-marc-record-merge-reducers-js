import clone from 'clone';
import {genericControlFieldCharPosFix as genericFix} from './controlFieldUtils';

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

function setFormOfItem(base008, source008, typeOfRecord) {
  const formOfItemLocation = ['VM', 'MP'].includes(typeOfRecord) ? 29 : 23;
  const baseFormOfItem = base008.value.charAt(formOfItemLocation);
  // Use more specific value. o=online and q=direct electronic are better than generic s=electronic
  if (baseFormOfItem === 's') {
    const sourceFormOfItem = source008.value.charAt(formOfItemLocation);
    if (['o', 'q'].includes(sourceFormOfItem)) {
      base008.value = `${base008.value.substring(0, formOfItemLocation)}${sourceFormOfItem}${base008.value.substring(formOfItemLocation + 1)}`; // eslint-disable-line functional/immutable-data
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
  const typeOfMaterial = base.getTypeOfMaterial(); // Boldly assume that type of material is same for both...

  //console.info(`TOM: ${typeOfMaterial}`); // eslint-disable-line no-console
  genericFix(base008, source008, typeOfMaterial, ['MU'], goodFormsOfComposition, 18, 'uu', '||'); // Form of Composition (MU) 00/18-19
  genericFix(base008, source008, typeOfMaterial, ['CR'], [' ', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'm', 'q', 's', 't', 'w', 'z'], 18, 'u', '|'); // CR frequency

  genericFix(base008, source008, typeOfMaterial, ['CR'], ['n', 'r', 'x'], 19, 'u', '|'); // CR regularity

  genericFix(base008, source008, typeOfMaterial, ['MU'], ['a', 'b', 'c', 'd', 'e', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'p', 'z'], 20, 'u', '|'); // Format of music

  genericFix(base008, source008, typeOfMaterial, ['MU'], [' ', 'd', 'e', 'f', 'n'], 21, 'u', '|'); // Music parts
  genericFix(base008, source008, typeOfMaterial, ['CR'], [' ', 'd', 'g', 'h', 'j', 'l', 'm', 'n', 'p', 'r', 's', 't', 'w'], 21, undefined, '|'); // Music parts


  genericFix(base008, source008, typeOfMaterial, ['BK', 'CF', 'MU', 'VM'], ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'j'], 22, ' ', '|'); // Target audience, 008/22
  genericFix(base008, source008, typeOfMaterial, ['MP'], goodProjections, 22, '  ', '||'); // MP projection 008/22-23
  genericFix(base008, source008, typeOfMaterial, ['CR'], [' ', 'a', 'b', 'c', 'd', 'e', 'f', 'o', 'q', 's'], 22, undefined, '|'); // CR 008/22

  genericFix(base008, source008, typeOfMaterial, ['BK', 'CR', 'MU', 'MX'], [' ', 'a', 'b', 'c', 'd', 'f', 'o', 'q', 'r', 's'], 23, undefined, '|'); // BK form of item
  genericFix(base008, source008, typeOfMaterial, ['CF'], [' ', 'o', 'q'], 23, undefined, '|'); // CF form of item

  genericFix(base008, source008, typeOfMaterial, ['CR'], [' ', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '5', '6'], 24, undefined, '|'); // Music parts

  genericFix(base008, source008, typeOfMaterial, ['MP'], ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'z'], 25, 'u', '|'); // MP type of cartographic material

  genericFix(base008, source008, typeOfMaterial, ['CF'], ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'm', 'z'], 26, 'u', '|'); // Type of computer file 008/23

  genericFix(base008, source008, typeOfMaterial, ['BK', 'CF', 'CR', 'MP', 'VM'], [' ', 'a', 'c', 'f', 'i', 'l', 'm', 'o', 's', 'z'], 28, 'u', '|'); // Government publication

  genericFix(base008, source008, typeOfMaterial, ['BK', 'CR'], ['0', '1'], 29, undefined, '|'); // Conference publication
  genericFix(base008, source008, typeOfMaterial, ['MP', 'VM'], [' ', 'a', 'b', 'c', 'd', 'f', 'o', 'q', 'r', 's'], 29, undefined, '|'); // BK form of item

  genericFix(base008, source008, typeOfMaterial, ['BK'], ['0', '1'], 30, undefined, '|'); // Festschrift
  genericFix(base008, source008, typeOfMaterial, ['BK', 'MP'], ['0', '1'], 31, undefined, '|'); // Index

  genericFix(base008, source008, typeOfMaterial, ['BK'], ['0', '1', 'd', 'e', 'f', 'h', 'i', 'j', 'm', 'p', 's'], 33, 'u', '|');
  genericFix(base008, source008, typeOfMaterial, ['MU'], [' ', 'a', 'b', 'c', 'n'], 33, 'u', '|');
  genericFix(base008, source008, typeOfMaterial, ['CR'], [' ', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'z'], 33, 'u', '|'); // CR original alphabet or script of title
  genericFix(base008, source008, typeOfMaterial, ['VM'], ['a', 'b', 'c', 'd', 'f', 'g', 'i', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'v', 'w', 'z'], 33, undefined, '|'); // VM type of visual material


  genericFix(base008, source008, typeOfMaterial, ['BK'], [' ', 'a', 'b', 'c', 'd'], 34, undefined, '|');
  genericFix(base008, source008, typeOfMaterial, ['CR'], ['0', '1', '2'], 34, undefined, '|'); // Entry convention
  genericFix(base008, source008, typeOfMaterial, ['VM'], ['a', 'c', 'l', 'n', 'z'], 34, 'u', '|'); // VM technique

  // Non-generic rules:
  setFormOfItem(base008, source008, typeOfMaterial); // 008/23 or 008/29: 'o' and 'q' are better than 's'. Sort of Item also uses generic fix. See above.

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
