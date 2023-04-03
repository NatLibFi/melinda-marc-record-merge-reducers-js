import clone from 'clone';
//import {MarcRecord} from '@natlibfi/marc-record';
//import createDebugLogger from 'debug';
//import {getEncodingLevelRanking, getNonIdenticalFields} from './utils.js';

//const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:field008');
const regexp008 = /^008$/u;

/*
function yearLanguageAndCountryAgree(field1, field2) {
  // First check that these character positions are the same in source and base:
  // 008/07-10 (year of publication), 008/15-17 (country), 008/35-37 (language)
  // Then select the 008 field from the record with the higher base level code
  const basePubYear = field1.value.slice(7, 11);
  const baseLanguage = field1.value.slice(35, 38);
  const baseCountry = field1.value.slice(15, 18);
  const sourcePubYear = field2.value.slice(7, 11);
  const sourceCountry = field2.value.slice(15, 18);
  const sourceLanguage = field2.value.slice(35, 38);
  return basePubYear === sourcePubYear && baseCountry === sourceCountry && baseLanguage === sourceLanguage;
}
*/

/*
function requiresModification(baseRecord, sourceRecord) {
  if (getEncodingLevelRanking(baseRecord) <= getEncodingLevelRanking(sourceRecord)) { // smaller is better!
    // The original version is better than or as good as the alternative version.
    return false;
  }

  const baseFields = baseRecord.get(regexp008);
  const sourceFields = sourceRecord.get(regexp008);


  if (sourceFields.length !== 1) {
    // debugDev('Identical fields in source and base');
    return false;
  }
  if (baseFields.length === 0) {
    return true;
  }
  // Field 008 is (or at least it should be) non-repeatable. Examine only the 1st elements:
  return yearLanguageAndCountryAgree(baseFields[0], sourceFields[0]);

}
*/

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
  if (!base008) { // eslint-disable-line functional/no-conditional-statement
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

  setLanguage(base008, source008); // 008/35-37

  setCatalogingSource(base008, source008); // 008/39

}

export default () => (base, source) => {

  //const baseRecord = new MarcRecord(base, {subfieldValues: false});
  //const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  process008(base, source);

  /*
  if (requiresModification(baseRecord, sourceRecord)) {
    const baseFields = baseRecord.get(regexp008);
    const sourceFields = sourceRecord.get(regexp008);
    // Test 06: If the level code of the source record is better (smaller number)
    // Replace base field 008 with field 008 from source
    debugDev(`Replacing base field ${baseFields[0].tag}`);
    // Field 008 is non-repeatable. This [0] is/should be a safe approach:
    //return {base: recordReplaceField(baseRecord, baseFields[0], sourceFields[0]), source};
    baseFields[0].value = `${baseFields[0].value.substring(0, 6)}${sourceFields[0].value.substring(6)}`; // eslint-disable-line functional/immutable-data
    return {base, source};
  }
  // Test 07: If the level code of the base record is better or the same, keep existing 008
  // Test 08: If the character positions for year, language and country are not the same, keep existing 008
  debugDev('Keeping base field 008');
  */
  return {base, source};
};
