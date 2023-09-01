import clone from 'clone';
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
    base.insertField(clonedField); // Should we clone this?
    return;
  }

  // Switch fields it base has illegal length:
  if (base008.value.length !== 40) {
    base008.value = source008.value; // eslint-disable-line functional/immutable-data
    return;
  }


  setOlderDateToBase(base008, source008); // 008/00-05

  setDates(base008, source008); // 008/06,07-10,11-14
  setPlaceOfPublication(base008, source008); // 008/15-17

  setLanguage(base008, source008); // 008/35-37

  setCatalogingSource(base008, source008); // 008/39

}

export default () => (base, source) => {

  process008(base, source);

  return {base, source};
};
