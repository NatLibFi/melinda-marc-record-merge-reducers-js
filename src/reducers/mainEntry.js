import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';

import {
  controlSubfieldsPermitMerge,
  fieldHasSubfield,
  fieldToString,
  normalizeStringValue
} from './utils.js';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw
// Field 240 is handled independently before this.

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
// All fields used for main entry, 1XX and 240 are unrepeatable
const fieldTag = /^(?:100|110|111|130|700|710|711|730)$/u; // Tag in regexp format (for use in MarcRecord functions)

const counterpartRegexps = {'100': /^[17]00$/u, '110': /^[17]10$/u, '111': /^[17]11$/u, '130': /^[17]30$/u,
  '700': /^[17]00$/u, '710': /^[17]10$/u, '711': /^[17]11$/u, '730': /^[17]30$/u};

function tagToRegexp(tag) {
  if (tag in counterpartRegexps) {
    const regexp = counterpartRegexps[tag];
    debug(`regexp for ${tag} found: ${regexp}`);
    return regexp;
  }
  debug(`WARNING: TagToRegexp(${tag}): no precompiled regexp found.`);
  return new RegExp(`^${tag}$`, 'u');
}


// Test 01: Same 100 in both source and base => do not copy
// Test 02: Base has 100, source has 100 with more subfields => copy additional subfields to base 100
// Test 03: Base has 100, source has 110 => copy source 110 as 710 to base
// Test 04: Base has no 1XX/7XX, source has 110 => copy source 110 as 710 to base
// Test 05: Base has 100 and 710, source has same 110 as base 710 => do not copy
// Test 06: Base has 100 and 710, source has 110 with more subfields => copy additional subfields to base 710
// ### tästä eteenpäin ei tehty valmiiksi
// Test 07: Combine fx00 with and without $0
// Test 08: Combine identical fx00
// Test 09: Combine fx00 with identical static name subfields, $d missing from base (Punctuation change)
// Test 10: Combine fx00 with identical static name subfields, $d missing from source (Punctuation change)
// Test 11: Combine fx00 with differing $e (Punctuation change)
// Test 12: Combine fx00 with missing $e (Punctuation change)
// Test 13: Combine fx00 with missing $e, multiple $e  (Punctuation change)
// Test 14: Combine fx00 with $d missing year of death in base
// Test 15: Combine fx00 with $d missing year of death in source
// Test 16: Combine fx00 with $d missing year of death in base

/*


  // ### Keskeneräinen


  // 100/110/111/130 -kenttiä käsitellään ryhmänä niin, että ryhmä otetaan basesta.
  // Jos basessa ei ole 1xx-kenttää, mitään 1xx-kenttää ei myöskään tuoda siihen,
  // tässä tapauksessa sourcen 1xx-kenttä tuodaan baseen
  // vastaavaksi 7xx-sarjan kentäksi. (100→700, 110→710, 111→711, 130→730).
  // Samoin jos sourcessa on 'eri' 1xx-kenttä kuin basessa,
  // sourcen 1xx-kenttä tuodaan baseen vastaavaksi 7xx-sarjan kentäksi.
  // Näissä vielä toki sitten se, että jos basessa on jo 'sama' 7xx-kenttä, kentät pitää yhdistää.

  // 100/110/111/130 ovat toisensa poissulkevia, eli tietueessa voi olla vain yksi näistä kerrallaan
  // Tietueessa voi olla 700/710/711/730-kenttiä silloinkin, jos siinä EI ole mitään 100/110/111/130-kenttiä


  // Case 3: Base (base) has 7XX fields but not 1XX fields
  // ### Onko tämä edes mahdollista?
  if (checkTagGroup(baseTags, field1XX) === false && checkTagGroup(baseTags, field7XX) === true) {
    debug(`Case 3`);
  }

  // Case 4: Base (base) has both 1XX and 7XX fields
  if (checkTagGroup(baseTags, field1XX) === true && checkTagGroup(baseTags, field7XX) === true) {
    debug(`Case 4`);
  }


  function checkTagGroup(tags, group) {
    if (tags.every(tag => group.indexOf(tag) === -1)) {
      debug(`Record does not contain fields: ${group}`);
      return false;
    }
    debug(`Record contains one or more fields: ${group}`);
    return true;
  }

  return base;
}
*/

function subfieldsAreEqualish(sf1, sf2) {
  return sf1.code === sf2.code && normalizeStringValue(sf1.value) === normalizeStringValue(sf2.value);
}

function equalishSubfieldExists(field, candSubfield) {
  return field.subfields.some(sf => subfieldsAreEqualish(sf, candSubfield));
}


function acceptEntrySubfieldA(field, candSubfield) {
  if (equalishSubfieldExists(field, candSubfield)) {
    return true;
  }
  debug(`Subfield ‡a check failed: '${candSubfield.value}' vs '${fieldToString(field)}'.`);
  return false;
}

const birthYearRegexp = /^(?<by>[1-9][0-9]*)-(?:[1-9][0-9]*)?(?:[^0-9]*)$/u;
function subfieldDToBirthYear(content) {
  const min = 1000;
  const max = 2021;
  const result = birthYearRegexp.exec(content);
  if (result && min <= result.groups.by && result.groups.by <= max) {
    return result.groups.by;
  }
  return -1;
}

const deathYearRegexp = /^(?:[1-9][0-9]*)-(?<dy>[1-9][0-9]*)(?:[^0-9]*)$/u;
function subfieldDToDeathYear(content) {
  const min = 1000;
  const max = 2029; // This should be dynamic value. Current year etc.
  const result = deathYearRegexp.exec(content);
  if (result && min <= result.groups.dy && result.groups.dy <= max) {
    return result.groups.dy;
  }
  return -1;
}

function birthYearsAgree(sf1, sf2) {
  const b1 = subfieldDToBirthYear(sf1.value);
  const b2 = subfieldDToBirthYear(sf2.value);
  return b1 !== -1 && b1 === b2; // We want a proper birth year. Period. Everything else is too noisy to handle.
}

function deathYearsAgree(sf1, sf2) {
  const b1 = subfieldDToDeathYear(sf1.value);
  const b2 = subfieldDToDeathYear(sf2.value);
  if (b1 === -1 || b2 === -1) {
    return true;
  }
  return b1 === b2;
}

const legalX00d = /^[1-9][0-9]*-(?:[1-9][0-9]*)?[,.]?$/u;

function acceptEntrySubfieldD(field, candSubfield) {
  if (field.tag !== '100' && field.tag !== '700') {
    debug(`NB! Subfield f is currently only checked for X00 fields.`);
    return true; // We are currently interested only in X00
  }
  const relevantSubfields = field.subfields.filter(subfield => subfield.code === 'd');

  if (relevantSubfields.length > 1) {
    return false;
  } // Cannot accept as field is crappy
  if (relevantSubfields.length === 0 || subfieldsAreEqualish(relevantSubfields[0], candSubfield)) {
    return true;
  }
  if ( !legalX00d.test(candSubfield.value)) { debug(`D-FAIL ${candSubfield.value}`); return false; }
  return legalX00d.test(candSubfield.value) && legalX00d.test(relevantSubfields[0].value) &&
    birthYearsAgree(relevantSubfields[0], candSubfield) && deathYearsAgree(relevantSubfields[0], candSubfield);
}

function acceptEntrySubfield0(field, candSubfield) {
  if (equalishSubfieldExists(field, candSubfield) || !fieldHasSubfield(field, '0')) {
    return true;
  }
  //if ( field.subfields.forEach(sf => { })

  debug(`TODO: Implement proper ‡0 check.`);
  return false;
}

function acceptEntrySubfield(field, candSubfield, index) { // Accept X00 and X10 equality
  // semantic check
  switch (candSubfield.code) {
  case 'a':
    return acceptEntrySubfieldA(field, candSubfield);
  case 'd':
    return acceptEntrySubfieldD(field, candSubfield);
  case '0':
    return acceptEntrySubfield0(field, candSubfield);
  default:
    debug(`Accepted entry subfield ‡${candSubfield.code} without checking it.`);
    return true;
  }


}


//// Everything below this point should be fine...

function mergablePairA(field1, field2) {
  if (!fieldHasSubfield(field1, 'a') || !fieldHasSubfield(field2, 'a')) {
    return false;
  }
  return true;
}

function mergablePairT(field1, field2) {

  // Both fields must either contain or not contain ‡t
  if (fieldHasSubfield(field1, 't')) {
    if (!fieldHasSubfield(field2, 't')) {

      debug('‡t issues. Won\'t try to merge.');
      return false;
    }
    return true;
  }

  if (fieldHasSubfield(field2, 't')) {
    return false;
  }
  return true;
}


function mergablePair(field1, field2) {
  // Indicators *must* be equal:
  if (field1.ind1 !== field2.ind1 || field1.ind2 !== field2.ind2) {
    debug('indicator check failed');
    return false;
  }
  if ( !controlSubfieldsPermitMerge(field1, field2) ) {
    debug('control subfield check failed');
    return false;
  }
  // field vs field -level checks (mostly syntactic stuff)
  if (!mergablePairA(field1, field2) || // eg. both fields must contain subfield a.
      !mergablePairT(field1, field2) ) { // both field must either have 't' or not have it
    return false;
  }

  // check that individual subfields from source/field2 are acceptable:
  if (field2.subfields.every((subfield, index) => acceptEntrySubfield(field1, subfield, index))) {
    debug('MERGABLE :-)');
    return true;
  }

  // Compare $a, $d ja $0
  debug(`mergablePair(f1, f2) not fully implemented yet!`);
  return false;
}


function mergeSubfieldNotRequired(targetField, candSubfield) {
  const targetSubfieldsAsStrings = targetField.subfields.map(sf => sf.code + normalizeStringValue(sf.value)); // a bit iffy regarding [0]
  const cand = candSubfield.code + normalizeStringValue(candSubfield.value);
  if (targetSubfieldsAsStrings.some(existingValue => cand === existingValue)) {
    // Subfield exists. Do nothing
    return true;
  }
  return false;
}

function insertSubfieldAllowed(targetField, candSubfield) {
  // subfield missing from the original:
  if (!targetField.subfields.some(sf => sf.code === candSubfield.code)) {
    return true;
  }

  // TODO: HOW TO IMPLEMENT REPLACE
  /*
  if ( /00$/u.test(candSubfield.tag) && /^[0-9]+\-[0-9]+/u.test() candSubfield.code === 'd') {
    return true;
  }
  */
  if ( /[10]0$/u.test(candSubfield.tag) && candSubfield.code === 'e') {
    return true;
  }
  debug(`No rule to add '‡${candSubfield.code} ${candSubfield.value}' to '${fieldToString(targetField)}'`)
  return false;
}

const onlyBirthYear = /^[1-9][0-9]*-[,.]?$/u;
const birthYearAndDeathYear = /^[1-9][0-9]*-[1-9][0-9]*[,.]?$/u;

function replaceSubfield(targetField, candSubfield) {
  const relevantSubfields = targetField.subfields.filter(subfield => subfield.code === candSubfield.code);
  debug(`Got ${relevantSubfields.length} sf-cands for field ${targetField.tag}`);
  if ( candSubfield.code === 'd' && /* debug("WP000") && */ /00$/u.test(targetField.tag) && relevantSubfields.length === 1 &&
    onlyBirthYear.test(relevantSubfields[0].value) && birthYearAndDeathYear.test(candSubfield.value) ) {
      relevantSubfields[0].value = candSubfield.value; // eslint-disable-line functional/immutable-data

    return true;
  }
  return false;
}

function mergeSubfield(record, targetField, candSubfield) {
  const str = `${candSubfield.code} ${candSubfield.value}`;
  if (mergeSubfieldNotRequired(targetField, candSubfield)) {
    debug(`    No need to add '‡${candSubfield.code} ${candSubfield.value}'`)
    return;
  }

  if (insertSubfieldAllowed(targetField, candSubfield)) {
    debug(` Added subfield ‡'${str}' to field`);
    // Add subfield to the end of all subfields. NB! Implement a separate function that does this + subfield reordering somehow...
    targetField.subfields.push(JSON.parse(JSON.stringify(candSubfield))); // eslint-disable-line functional/immutable-data
    return;
  }
  if(replaceSubfield(targetField, candSubfield)) {
    return;
  }
  debug(`TODO: Handle merging/adding subfield '‡${str}' to field`);
}


function mergeField(record, targetField, sourceField) {
  sourceField.subfields.forEach(candSubfield => {
    debug(`  CAND4ADDING '‡${candSubfield.code} ${candSubfield.value}'`);
    mergeSubfield(record, targetField, candSubfield);

    // { code: x, value: foo }

  });

  return record;
}


function getCounterpart(record, field) {
  // Get tag-wise relevant 1XX and 7XX fields:
  const counterpartCands = record.get(tagToRegexp(field.tag));
  // debug(counterpartCands);

  if (!counterpartCands || counterpartCands.length === 0) {
    return null;
  }
  const fieldStr = fieldToString(field);
  debug(`Compare incoming '${fieldStr}' with (up to) ${counterpartCands.length + 1} existing field(s)`);
  const index = counterpartCands.findIndex((currCand) => {
    const currCandStr = fieldToString(currCand);
    debug(`  CAND: '${currCandStr}'`);
    if (mergablePair(currCand, field)) {
      debug(`  OK pair found: '${currCandStr}'. Returning it!`);
      return true;
    }
    return false;
  });
  if (index > -1) {
    return counterpartCands[index];
  }
  debug(' No counterpart found!');
  return null;
}

function insertField7XX(record, field) {
  const newField = JSON.parse(JSON.stringify(field));
  // Convert 1XX field to 7XX field (7XX field stays the same):
  newField.tag = `7${newField.tag.substring(1)}`; // eslint-disable-line functional/immutable-data
  record.insertField(newField);
  debug(`case 1: add "${fieldToString(newField)}" (source was 1XX)`);
  return record;
}

function mergeOrAddField(record, field) {
  const counterpartField = getCounterpart(record, field);
  if (counterpartField) {
    debug(`Got counterpart: '${fieldToString(counterpartField)}'`);
    mergeField(record, counterpartField, field);
    return record;
  }
  // NB! Counterpartless field is inserted to 7XX even if field.tag says 1XX:
  debug(`No counterpart found for '${fieldToString(field)}'. Adding it to 7XX.`);
  return insertField7XX(record, field);
}


export default () => (record, record2) => {
  const candidateFields = record2.get(fieldTag); // Get array of source fields
  candidateFields.forEach(candField => mergeOrAddField(record, candField));
  return record;
};
