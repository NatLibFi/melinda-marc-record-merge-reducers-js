import createDebugLogger from 'debug';
//import {/*fieldToString,*/ nvdebug} from './utils';

import {fieldRemoveDuplicateSubfields} from './removeDuplicateSubfields';
import {fieldToString, getCatalogingLanguage, nvdebug, uniqArray} from './utils';

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

function isQualifierInformationTag(tag) {
  return ['015', '020', '024', '028'].includes(tag);
}

function fixMtsQualifyingInformationAbbreviation(value) {
  if (value.match(/^mp3[.,]?$/iu)) {
    return 'MP3';
  }
  if (value.match(/^\(?pdf\)?[.,]?$/iu)) {
    return 'PDF';
  }
  return value;
}

function fixMtsQualifyingInformationAbbreviationSubfield(subfield) {
  subfield.value = fixMtsQualifyingInformationAbbreviation(subfield.value);
}

const translationTable = [
  {'fin': 'sidottu', 'swe': 'inbunden'},
  {'fin': 'nidottu', 'swe': 'häftad'},
  {'eng': 'hardback', 'fin': 'kovakantinen', 'swe': 'hårda pärmar'},
  {'eng': 'paperback', 'fin': 'pehmeäkantinen', 'swe': 'mjuka pärmar'},
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
    fixMtsQualifyingInformationAbbreviationSubfield(subfield);
    nvdebug(`Translate $q term '${subfield.value}' to ${catalogingLanguage}`, debugDev);
    subfield.value = translateMtsTerm(subfield.value, catalogingLanguage, 'all');
    return;
  }

  /* // Commented this after discussion with MH. We can have both Finnish and Swedish version in same record.
  if (tag === '600' && subfield.code === 'c') { // (fiktiivinen hahmo) vs (fiktiv gestalt)
    const modValue = translateMtsTerm(subfield.value, catalogingLanguage, 'all');
    nvdebug(`MTS: ${subfield.value} => ${modValue}`, debugDev);

    subfield.value = modValue;
    return;
  }
  */
}

function fixQualifierInformation(field, catalogingLanguage) {
  if (!isQualifierInformationTag(field.tag)) {
    return;
  }

  const qs = field.subfields.filter(sf => sf.code === 'q');
  if (qs.length === 0) {
    return;
  }

  if (catalogingLanguage) {
    qs.forEach(sf => mtsCaseSubfield(field.tag, sf, catalogingLanguage));
    return;
  }

  // Multiple $q values and no language specifed... see if translation reduces the number of entries..
  const mappings = uniqArray(qs.map(sf => translateMtsTerm(sf.value, 'fin')));
  if (mappings.length < qs.length) {
    // Translate all the values to Finnish (iffy, some other language might be better),
    // so that the duplicates can be removed elsewhere...
    // Not the best way to do this, but doing it properly is an overkill...
    qs.forEach(sf => mtsCaseSubfield(field.tag, sf, 'fin'));
    return;
  }

}

function mtsCaseField(field, catalogingLanguage) {
  if (!field.subfields) {
    return;
  }
  const originalValue = fieldToString(field);

  fixQualifierInformation(field, catalogingLanguage);

  if (originalValue === fieldToString(field)) {
    return;
  }
  fieldRemoveDuplicateSubfields(field);
  const modifiedValue = fieldToString(field);
  nvdebug(`MODIFY FIELD:\n  ${originalValue} =>\n  ${modifiedValue}`, debugDev);
}


export function mtsProcessRecord(record) {
  const catalogingLanguage = getCatalogingLanguage(record);
  record.fields.forEach(field => mtsCaseField(field, catalogingLanguage));
}
