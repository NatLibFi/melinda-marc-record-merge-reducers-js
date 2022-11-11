import {fieldFixPunctuation} from './punctuation';
import {fieldToString, nvdebug, subfieldToString} from './utils';

// NB! Make this a marc-record-validators-melinda validator/fixer eventually!

export default () => (base, source) => {
  recordHandleRelatorTermAbbreviations(base);
  recordHandleRelatorTermAbbreviations(source);
  const result = {base, source};
  return result;
};


// Partial source: https://marc21.kansalliskirjasto.fi/funktiot_koodit.htm
// https://wiki.helsinki.fi/display/MARC21svenska/Funktions-+och+relationskoder+-+alfabetiskt+efter+funktion


const relatorTerms = [
  {'code': 'arr', 'eng': 'arranger', 'fin': 'sovittaja', 'swe': 'arrangör av musikalisk komposition'},
  {'code': 'aui', 'eng': 'author of introduction', 'fin': 'esipuheen tekijä'},
  {'code': 'aut', 'eng': 'author', 'fin': 'kirjoittaja', 'swe': 'författare'},
  {'code': 'cmp', 'eng': 'composer', 'fin': 'säveltäjä', 'swe': 'kompositör'},
  {'code': 'drt', 'eng': 'director', 'fin': 'ohjaaja', 'swe': 'regissör'},
  {'code': 'edt', 'eng': 'editor', 'fin': 'toimittaja'},
  {'code': 'ill', 'eng': 'illustrator', 'fin': 'kuvittaja', 'swe': 'illustratör'},
  {'code': 'lyr', 'eng': 'lyricist', 'fin': 'sanoittaja'},
  {'code': 'nrt', 'eng': 'narrator', 'fin': 'kertoja'},
  {'code': 'pbl', 'eng': 'publisher', 'fin': 'julkaisuja'},
  {'code': 'pht', 'eng': 'photographer', 'fin': 'valokuvaaja', 'swe': 'fotograf'},
  {'code': 'prf', 'eng': 'performer', 'fin': 'esittäjä'},
  {'code': 'pro', 'eng': 'producer', 'fin': 'tuottaja'},
  {'code': 'trl', 'eng': 'translator', 'fin': 'kääntäjä', 'swe': 'översättare'}
];


export function getCatalogingLanguage(record) {
  const [field040] = record.get(/^040$/u);
  if (!field040) {
    return null;
  }
  const [b] = field040.subfields.filter(sf => sf.code === 'b');
  if (!b) {
    return null;
  }
  return b.value;
}


/*
function recordNormalizeRelatorTerms(record, defaultLanguageCode = undef) {
  const languageCode = defaultLanguageCode ? defaultLanguageCode : getCatalogingLanguage(record);
  if  (!languageCode || ['eng', 'fin', 'swe'].includes(languageCode)) {
    return;
  }

}
*/
const finnishAbbreviations = {
  'esitt.': 'esittäjä',
  'käänt.': 'kääntäjä',
  'näytt.': 'näyttelijä',
  'san.': 'sanoittaja',
  'sov.': 'sovittaja',
  'säv.': 'säveltäjä',
  'toim.': 'toimittaja'
};

function subfieldHandleRelatorTermAbbreviation(subfield, language) {
  if (subfield.code !== 'e') {
    return;
  }
  nvdebug(`Relator cand subfield: ${subfieldToString(subfield)}`);
  const value = subfield.value.replace(/,$/u, '');
  const punc = value === subfield.value ? '' : ',';

  const lcValue = value.toLowerCase(); // Check Å, Ä, Ö...

  // NB: Policy: if no language or multi-language: apply all rules! (Not much overlap I hope...)
  if (language === null || language === 'fin' || language === 'mul') {
    nvdebug(`Relator try Finnish...`);
    if (lcValue in finnishAbbreviations) {
      const hit = `${finnishAbbreviations[lcValue]}${punc}`;
      nvdebug(`Relator hit: ${hit}`);
      // NB! 'esitt.' => 'esittäjä'
      subfield.value = hit; // eslint-disable-line functional/immutable-data
      return;
    }
  }
}


export function isRelatorField(field) {
  // List might be incomplete!
  return field.tag.match(/^(?:100|110|600|610|700|710|720|800|810)$/u);
}

function fieldHandleRelatorTermAbbreviations(field, language) {
  if (!isRelatorField(field)) {
    return;
  }

  const originalValue = fieldToString(field);
  field.subfields.forEach(sf => subfieldHandleRelatorTermAbbreviation(sf, language));
  const modifiedValue = fieldToString(field);
  if (modifiedValue === originalValue) {
    return;
  }
  // Changes have happened... Try to punctuate.
  // (NB! We need punctuation as a module, if we are to make abbr expansion a marc-record-validators-melinda validator/fixer)
  fieldFixPunctuation(field);
}


export function recordHandleRelatorTermAbbreviations(record, defaultCatLanguage = undefined) {
  const catalogingLanguage = defaultCatLanguage ? defaultCatLanguage : getCatalogingLanguage(record);
  record.fields.forEach(field => fieldHandleRelatorTermAbbreviations(field, catalogingLanguage));
}

function translateRelatorTerm(originalTerm, fromLanguage, toLanguage) {
  if (fromLanguage === toLanguage) {
    return;
  }
  // originalTerm is supposed to be normal version (abbrs have been expanded), possibly with punctuation
  const term = originalTerm.replace(/[,.]$/u, '');
  const [candRow] = relatorTerms.filter(row => fromLanguage in row && toLanguage in row && row[fromLanguage] === term);
  if (candRow) {
    const punc = term === originalTerm ? '' : originalTerm.slice(-1);
    return `${candRow[toLanguage]}${punc}`;
  }
  return originalTerm;
}

function subfieldTranslateRelatorTerm(subfield, fromLanguage, toLanguage) {
  if (subfield.code !== 'e') {
    return;
  }
  subfield.value = translateRelatorTerm(subfield.value, fromLanguage, toLanguage); // eslint-disable-line functional/immutable-data
}

export function fieldTranslateRelatorTerm(field, fromLanguage, toLanguage) {
  if (!isRelatorField(field) || fromLanguage === toLanguage) {
    return;
  }
  field.subfields.forEach(sf => subfieldTranslateRelatorTerm(sf, fromLanguage, toLanguage));
}


export function translateRecord(record, toLanguage = null) {
  const fromLanguage = getCatalogingLanguage(record);
  if (toLanguage === null || fromLanguage === toLanguage) {
    return;
  }
  record.fields.forEach(field => translateField(field, fromLanguage, toLanguage));

  function translateField(field, from, to) {
    fieldTranslateRelatorTerm(field, from, to);
  }
}
