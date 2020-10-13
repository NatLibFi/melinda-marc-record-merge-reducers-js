/**
 * Erätuonnit: MARC-kenttien käsittely tuonnissa
 * https://workgroups.helsinki.fi/pages/viewpage.action?pageId=154377436
 *
 */
import foo from './foo';
import {reducers} from '@natlibfi/marc-record-merge';
import {MarcRecord} from '@natlibfi/marc-record';

const {select} = reducers;

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
const normalizeTest = normalizeSync('åéäè');
debug(`normalizeTest: ${normalizeTest}`);

const base = new MarcRecord(getFixture('base.json'));
const source = new MarcRecord(getFixture('source.json'));

const baseLeader = JSON.stringify(base.leader);
const sourceLeader = JSON.stringify(source.leader);
debug(`baseLeader: ${baseLeader}`);
debug(`sourceLeader: ${sourceLeader}`);
const baseControlfields = base.getControlfields();
const sourceControlfields = source.getControlfields();
debug(`baseControlfields: ${JSON.stringify(baseControlfields, undefined, 2)}`);
debug(`sourceControlfields: ${JSON.stringify(sourceControlfields, undefined, 2)}`);
const baseDatafields = base.getDatafields();
const sourceDatafields = source.getDatafields();
debug(`baseDatafields: ${JSON.stringify(baseDatafields, undefined, 2)}`);
debug(`sourceDatafields: ${JSON.stringify(sourceDatafields, undefined, 2)}`);


// Jos alla olevat kentät ovat tulevalla tietueella ja Melindassa jo olevalla tietueella erilaiset, tietueita ei yhdistetä lainkaan:
// 000/06 (nimiö, tietueen tyyppi)
// 000/07(nimiö, tietueen bibliografinen taso)

if (baseLeader(6) !== sourceLeader(6) || baseLeader(7) !== sourceLeader(7)) {
  return base;
}

// 02X-standardinumerot

const base02X = baseDatafields.map(field => field.tag.slice(0, 2) === '02');
const source02X = sourceDatafields.map(field => field.tag.slice(0, 2) === '02');
debug(`base02X: ${JSON.stringify(base02X, undefined, 2)}`);
debug(`source02X: ${JSON.stringify(source02X, undefined, 2)}`);

if (base02X.some(field => field !== source02X.field)) {
  return base;
}

// 036 tiedoston rekisterinumero
// Otetaanko tässä huomioon vain osakenttä a vai pitääkö kaikkien osakenttien olla samat?

const base036 = base.get(/^036$/);
const source036 = source.get(/^036$/);

if (base036.subfields.some(subfield => subfield !== source036.subfields)) {
  return base;
}

// 1XX

const base1XX = baseDatafields.map(field => field.tag.slice(0, 1) === '1');
const source1XX = sourceDatafields.map(field => field.tag.slice(0, 1) === '1');

if (base1XX.some(field => field !== source1XX.field)) {
  return base;
}

// 245‡a ‡b ... (HUOM. kenttien "normalisointi" ja erojen pisteytys)
// Miten tämä toteutetaan?

// jos 245-kentän 2. indikaattorin arvo poikkeaa Melindassa jo olevan tietueen indikaattin arvosta,
// Melindassa olevan tietueen arvo voittaa

const base245 = base.get(/^245$/);
const source245 = source.get(/^245$/);

if (base245.ind2 !== source245.ind2) {
  return base;
}


return [
  select(/^500$/),
  foo
];


// 000 NIMIÖ
// Tutkitaan erätuonnissa
// If 000/06 or 000/07 is different, do not combine records

// 001 - TIETUEEN KONTROLLINUMERO (ET)
// Keep Melinda/Aleph ID

// 003 - TIETUEEN KONTROLLINUMERON TUNNISTE (ET)
// Remove from the source record

// 005 - VIIMEISIMMÄN PÄIVITYKSEN AJANKOHTA (ET)
// No specifications for this?

// 006 - LISÄINFORMAATIOKOODIT--YLEISTÄ TIETOA (T)
// Tutkitaan erätuonnissa
// If Melinda already has 006, keep it
// If Melinda does not have 006, get it from source if Leader 000/06=o or p

// 007 - ULKOASUA KOSKEVAT INFORMAATIOKOODIT--YLEISTÄ TIETOA (T)
// Tutkitaan erätuonnissa
// Two first characters must be the same (007/00-01) in base and source
// Or prefer the field already in Melinda, if it is better?

// 008 - INFORMAATIOKOODIT--YLEISTÄ TIETOA (ET)
// Tutkitaan erätuonnissa
// 008/07 year of publication
// 008/15-17 country
// 008/35-37 language
// If all these are equal, select the 008 field from the record with the better level code(?) (tasokoodi)
// tarkista pisteytyssäännöt

// 010 - LIBRARY OF CONGRESS KONTROLLINUMERO (ET)
// Get from source if missing in base
// Merge:
// 010": { "action": "copy", "options": { "compareWithout": ["9"] } },

// 013 - PATENTTINUMERO (T)
// Get from source

// 015 - NBN-TUNNUS, NATIONAL BIBLIOGRAPHY NUMBER (T)
// Get from source
// Merge:
// "015": { "action": "copy", "options": { "compareWithout": ["9"] } },

// 016 - KANSALLISBIBLIOGRAFIAN KONTROLLINUMERO (T)
// Tutkitaan erätuonnissa
// Get from source

// 017 - TEKIJÄNOIKEUS- TAI VAPAAKAPPALETUNNUS (T)
// Get from source

// 018 - ARTIKKELIN TEKIJÄNOIKEUSMAKSUN KOODI (ET)
// Get from source if missing in base

// 020 - ISBN-TUNNUS, INTERNATIONAL STANDARD BOOK NUMBER (T)
// Tutkitaan erätuonnissa
// Compare subfield a, if it is different, do not combine but import the source as a new record
// Hyphens are skipped in the comparison
// Merge:
// "020": { "action": "copy", "options": { "compareWithout": ["z", "c", "q", "9"], "combine": ["c"] } },

// 022 - ISSN-TUNNUS, INTERNATIONAL STANDARD SERIAL NUMBER (T)
// Tutkitaan erätuonnissa
// Compare subfield a, if it is different, do not combine but import the source as a new record
// Merge:
// "022": { "action": "copy", "options": { "compareWithout": ["9"], "compareWithoutIndicators": true } },

// 024 - MUUT STANDARDITUNNUKSET (T)
// Tutkitaan erätuonnissa
// Compare subfield a, if it is different, do not combine but import the source as a new record
// If there are multiple 024 fields, all are checked
// Merge:
// "024": { "action": "copy", "options": { "compareWithout": ["z", "c", "q", "9"], "combine": ["c"] } },

// 025 - ULKOMAINEN HANKINTANUMERO (T)
// Remove from source

// 026 - SORMENJÄLKITUNNISTE (T)
// Remove from source

// 027 - ISRN-TUNNUS TAI MUU STANDARDOITU RAPORTTINUMERO (T)
// Get from source if missing in base
// Merge:
// "027": { "action": "copy", "options": { "compareWithout": ["z", "c", "q", "9"], "combine": ["c"] } },

// 028 - JULKAISIJAN TUNNUS (T)
// Compare the whole field, also indicators, if there are differences, do not combine
// Merge:
// "028": { "action": "copy", "options": { "compareWithout": ["q", "9"], "compareWithoutIndicators": true } },

// 030 - CODEN-TUNNUS (T)
// Get from source if missing in base

// 031 - MUSIIKKIAINEISTON INCIPIT-TIEDOT (T)
// Tutkitaan erätuonnissa
// Get from source if missing in base
// Merge:
// "031": { "action": "copy", "options": { "compareWithout": ["9"] } },

// 032 - POSTIREKISTERINUMERO (T)
// Remove

// 033 - TAPAHTUMAN AIKA JA PAIKKA (T)
// Tutkitaan erätuonnissa
// Compare, use the more complete field (with more subfields)
// Merge:
// "033": { "action": "copy", "options": { "compareWithout": ["9"] } },
