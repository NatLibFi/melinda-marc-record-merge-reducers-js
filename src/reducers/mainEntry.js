import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';

import {
  getTags,
  checkIdenticalness,
  fieldToString
} from './utils.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
// All fields used for main entry, 1XX and 240 are unrepeatable
const fieldTag = /^(?:100|110|111|130|240|700|710|711|730)$/u; // Tag in regexp format (for use in MarcRecord functions)

/*
function has1XX(record) {
  const fields = record.get(/^1..$/u);
  return fields.length !== 0;
}
*/

function is1XXOr7XX(str) {
  const c = str.charAt(0);
  return c === '1' || c === '7';
}

function is7XX(str) {
  const c = str.charAt(0);
  return c === '7';
}

function is1XX(str) {
  const c = str.charAt(0);
  return c === '1';
}

function fieldAlreadyExists(existingFieldsAsStrings, candFieldAsString) {
  const candIs1Or7 = is1XXOr7XX(candFieldAsString);
  return existingFieldsAsStrings.some((existingFieldAsString) => {
    if (candIs1Or7 && is1XXOr7XX(existingFieldAsString)) {
      return existingFieldAsString.substring(1) === candFieldAsString.substring(1);
    }
    return existingFieldAsString === candFieldAsString;
  });
}


function insertField7XX(record, field) {
  const newField = JSON.parse(JSON.stringify(field));
  // The source field is copied to base as 7XX even if it is 1XX.
  if (newField.tag.charAt(0) === '7') {
    record.insertField(newField);
    debug(`case 1: add ${fieldToString(newField)}`);
    return record;
  }
  newField.tag = `7${newField.tag.substring(1)}`; // eslint-disable-line functional/immutable-data
  record.insertField(newField);
  debug(`case 1: add "${fieldToString(newField)}" (source was 1XX)`);
  return record;
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

function isMainOrAddedEntryAndConditionsApply(existingFieldsAsStrings, candFieldAsString) {
  // field must be a main entry (1XX) or added entry (7XX)
  if (!is1XXOr7XX(candFieldAsString)) {
    return false;
  }
  return true; // simplify, hopefully we will merge 1XX and 7XX fields later on...
  /*
  // Case 1: Base (base) has no 1XX/7XX fields
  if (!existingFieldsAsStrings.some((str) => is1XXOr7XX(str))) {
      return true;
  }
  // Case 2: Base (base) has 1XX fields but not 7XX fields
  if (existingFieldsAsStrings.some((str) => is1XX(str)) && !existingFieldsAsStrings.some((str) => is7XX(str))) {
    return true;
  }
  return false;
  */
}

function handleCandidateField(record, existingFieldsAsStrings, candField) {
  const candFieldAsString = fieldToString(candField);
  if (fieldAlreadyExists(existingFieldsAsStrings, candFieldAsString)) {
    // No action required
    debug(`No need to add ${candFieldAsString}`);
    return record;
  }

  // Case 1: Base (base) has no 1XX/7XX fields
  if (isMainOrAddedEntryAndConditionsApply(existingFieldsAsStrings, candFieldAsString)) {
    return insertField7XX(record, candField);
  }
  debug(`TODO: handle ${fieldToString(candFieldAsString)}`);

  return record;
}

/*
  const copyFromSourceToBase = []; // Array for collecting fields to finally copy from source to base
  const field1XX = ['100', '110', '111', '130']; // 1XX fields are non-repeatable and mutually exclusive
  const field7XX = ['700', '710', '711', '730']; // 7XX fields are repeatable

  //const tagString = getTags(baseFields, sourceFields);
  //debug(`tagString: ${tagString}`);
  //const baseTags = getTags(baseFields);
  //debug(`baseTags: ${JSON.stringify(baseTags, undefined, 2)}`);
  //const sourceTags = getTags(sourceFields);
  //debug(`sourceTags: ${JSON.stringify(sourceTags, undefined, 2)}`);

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


  // Case 3: Base has 7XX fields but not 1XX fields
  // ### Onko tämä edes mahdollista?
  if (checkTagGroup(baseTags, field1XX) === false && checkTagGroup(baseTags, field7XX) === true) {
    debug(`Case 3`);
    return;
  }

  // Case 4: Base (base) has both 1XX and 7XX fields
  if (checkTagGroup(baseTags, field1XX) === true && checkTagGroup(baseTags, field7XX) === true) {
    debug(`Case 4`);
    return;
  }

  copy240(source, sourceTags, baseTags);
  debug(`copyFromSourceToBase: ${JSON.stringify(copyFromSourceToBase, undefined, 2)}`);

  // Field 240 is copied from source only if base does not contain 240 or 130
  function copy240(source, sourceTags, baseTags) {
    if (sourceTags.indexOf('240') !== -1 && baseTags.indexOf('240') === -1 && baseTags.indexOf('130') === -1) {
      // Get an array containing field 240 from the source MarcRecord object
      const source240 = source.get(/^240$/);
      // Field 240 is non-repeatable so the source240 array can be destructured into obj240
      const [obj240] = source240;
      // Push obj240 into the array of fields to be copied at the end
      copyFromSourceToBase.push(obj240);
      debug(`Field 240 copied from source to base`);

    }
    // If the conditions are not fulfilled, nothing happens

  }

  // Checks whether a set of tags contains tags belonging to the chosen group (here, field1XX or field7XX)
  // Returns true or false
  function checkTagGroup(tags, group) {
    debug(`### tags: ${tags}`);
    const tagsByGroup = tags.filter(tag => group.indexOf(tag));
    debug(`### tagsByGroup: ${tagsByGroup}`); // ### tarkista tämä, pitäisi olla 2 tagia test 00:ssa
    if (tags.every(tag => group.indexOf(tag) === -1)) {
      debug(`Fields not in record: ${group}`);
      return false;
    }
    debug(`Fields in record: ${tagsByGroup}`);
    return true;
  }

  return base;
}
*/

function mergeMainAndAddedEntries(record) {
  // Postprocess record here.

  // Step 1: Process 7XX fields against 1XX field (if any). If match, enrich 1XX and remove 7XX

  // Step 2: Process 1XX fields agains each other
}

function processMainEntryFields(record, existingFields, candidateFields) {
  //debug("pmef("+existingFields.length+") in...");
  //existingFields.forEach(function(field) { debug(fieldToString(field)); });
  //debug("pmef("+existingFields.length+") wp1...");
  const existingFieldsAsStrings = existingFields.length === 0 ? [] : existingFields.map(field => fieldToString(field));
  candidateFields.forEach(candField => handleCandidateField(record, existingFieldsAsStrings, candField));
  return mergeMainAndAddedEntries(record);
}

export default () => (base, source) => {
  const baseFields = base.get(fieldTag); // Get array of base fields
  //debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  const sourceFields = source.get(fieldTag); // Get array of source fields
  //debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);
  //debug(`### nonIdenticalFields: ${JSON.stringify(nonIdenticalFields, undefined, 2)}`);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }
  return processMainEntryFields(base, baseFields, nonIdenticalFields);

};
