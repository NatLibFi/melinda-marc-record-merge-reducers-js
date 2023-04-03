import createDebugLogger from 'debug';
//import {/*fieldToString,*/ nvdebug} from './utils';

import {fieldRemoveDuplicateSubfields} from './removeDuplicateSubfields';
import {fieldToString, getCatalogingLanguage, nvdebug} from './utils';

// Handle various MTS terms: open abbreviations, normalize to MTS format, translate


// Do later: 300/773$h, X00$e Relator term...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:preprocessMetatietosanasto');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

export default () => (base, source) => {
  mtsProcessRecord(base);
  mtsProcessRecord(source);
  return {base, source};
};

function fixMtsQualifyingInformationAbbreviations(value) {
  if (value.match(/^hft[.,]?$/iu)) { // nidottu
    return 'häftad';
  }
  if (value.match(/^inb[.,]?$/iu)) {
    return 'inbunden';
  }
  if (value.match(/^mp3[.,]?$/iu)) {
    return 'MP3';
  }
  if (value.match(/^nid[.,]?$/iu)) {
    return 'nidottu';
  }
  if (value.match(/^\(?pdf\)?[.,]?$/iu)) {
    return 'PDF';
  }
  if (value.match(/^sid[.,]?$/iu)) {
    return 'sidottu';
  }

  return value;
}

const translationTable = [
  {'eng': 'hardback', 'fin': 'sidottu', 'swe': 'inbunden'},
  {'eng': 'paperback', 'fin': 'nidottu', 'swe': 'häftad'},
  {'fin': '(fiktiivinen hahmo)', 'swe': '(fiktiv gestalt)'}
];

// const supportedLanguages = ['eng', 'fin', 'swe'];

function translateMtsTerm(term, to, from = 'all') {
  if (translationTable.some(entry => entry[to] === term)) {
    return term;
  }

  // A bit of copypaste coding below. Not sure how to loop it properly and functionally.
  if (to !== 'eng' && ['all', 'eng'].includes(from)) {
    const row = translationTable.find(currRow => currRow.eng && currRow.eng === term);
    if (row && row[to]) {
      return row[to];
    }
  }

  if (to !== 'fin' && ['all', 'fin'].includes(from)) {
    const row = translationTable.find(currRow => currRow.fin && currRow.fin === term);
    if (row && row[to]) {
      return row[to];
    }
  }

  if (to !== 'swe' && ['all', 'swe'].includes(from)) {
    const row = translationTable.find(currRow => currRow.swe && currRow.swe === term);
    if (row && row[to]) {
      return row[to];
    }
  }

  return term;
}


function mtsCaseSubfield(tag, subfield, catalogingLanguage) {
  if (['015', '020', '024', '028'].includes(tag) && subfield.code === 'q') {
    const tmpValue = fixMtsQualifyingInformationAbbreviations(subfield.value);
    nvdebug(`Translate $q term '${tmpValue}' to ${catalogingLanguage}`, debugDev);
    subfield.value = translateMtsTerm(tmpValue, catalogingLanguage, 'all'); // eslint-disable-line functional/immutable-data
    return;
  }

  /* // Commented this after discussion with MH. We can have both Finnish and Swedish versio in same record.
  if (tag === '600' && subfield.code === 'c') { // (fiktiivinen hahmo) vs (fiktiv gestalt)
    const modValue = translateMtsTerm(subfield.value, catalogingLanguage, 'all');
    nvdebug(`MTS: ${subfield.value} => ${modValue}`, debugDev);

    subfield.value = modValue; // eslint-disable-line functional/immutable-data
    return;
  }
  */
}

function mtsCaseField(field, catalogingLanguage) {
  if (!field.subfields) {
    return;
  }
  const originalValue = fieldToString(field);
  field.subfields.forEach(sf => mtsCaseSubfield(field.tag, sf, catalogingLanguage));
  if (originalValue === fieldToString(field)) {
    return;
  }
  fieldRemoveDuplicateSubfields(field);
  const modifiedValue = fieldToString(field);
  nvdebug(`MODIFY FIELD:\n  ${originalValue} =>\n  ${modifiedValue}`, debugDev);
}


export function mtsProcessRecord(record) {
  const catalogingLanguage = getCatalogingLanguage(record) || 'fin';
  record.fields.forEach(field => mtsCaseField(field, catalogingLanguage));
}
