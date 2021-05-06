import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';

import {
  getTags,
  checkIdenticalness
} from './utils.js';

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  // All fields used for main entry, all non-repeatable
  const fieldTag = /^(?:100|110|111|130|240|700|710|711|730)$/u; // Tag in regexp format (for use in MarcRecord functions)
  const baseFields = base.get(fieldTag); // Get array of base fields
  debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  const sourceFields = source.get(fieldTag); // Get array of source fields
  debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);
  const tagString = getTags(baseFields, sourceFields);
  debug(`tagString: ${tagString}`);

  const baseTags = getTags(baseFields);
  debug(`baseTags: ${JSON.stringify(baseTags, undefined, 2)}`);
  const sourceTags = getTags(sourceFields);
  debug(`sourceTags: ${JSON.stringify(sourceTags, undefined, 2)}`);

  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);
  debug(`### nonIdenticalFields: ${JSON.stringify(nonIdenticalFields, undefined, 2)}`);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  // ### Keskeneräinen

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
  100/110/111/130 -kenttiä käsitellään ryhmänä niin, että ryhmä otetaan basesta.
  Jos basessa ei ole 1xx-kenttää, mitään 1xx-kenttää ei myöskään tuoda siihen,
  tässä tapauksessa sourcen 1xx-kenttä tuodaan baseen
  vastaavaksi 7xx-sarjan kentäksi. (100→700, 110→710, 111→711, 130→730).
  Samoin jos sourcessa on 'eri' 1xx-kenttä kuin basessa,
  sourcen 1xx-kenttä tuodaan baseen vastaavaksi 7xx-sarjan kentäksi.
  Näissä vielä toki sitten se, että jos basessa on jo 'sama' 7xx-kenttä, kentät pitää yhdistää.

  100/110/111/130 ovat toisensa poissulkevia, eli tietueessa voi olla vain yksi näistä kerrallaan
  Tietueessa voi olla 700/710/711/730-kenttiä silloinkin, jos siinä EI ole mitään 100/110/111/130-kenttiä
  */

  const copyFromSourceToBase = []; // Array for collecting fields to finally copy from source to base
  const field1XX = ['100', '110', '111', '130']; // 1XX fields are non-repeatable and mutually exclusive
  const field7XX = ['700', '710', '711', '730']; // 7XX fields are repeatable

  // Case 1: Base (base) has no 1XX/7XX fields
  if (checkTagGroup(baseTags, field1XX) === false && checkTagGroup(baseTags, field7XX) === false) {
    // If source has 1XX, it is copied to base as 7XX
    if (checkTagGroup(sourceTags, field1XX) === true) {

    }
    // If source has 7XX, it is copied to base as is
    // ### 7XX kentät menee nyt perus-copyllä
    if (checkTagGroup(sourceTags, field7XX) === true) {

    }
    debug(`Case 1`);
  }

  // Case 2: Base (base) has 1XX fields but not 7XX fields
  if (checkTagGroup(baseTags, field1XX) === true && checkTagGroup(baseTags, field7XX) === false) {
    // If source has 1XX, it is copied to base as 7XX
    if (checkTagGroup(sourceTags, field1XX) === true) {

    }
    // If source has 7XX, it is copied to base as is
    // ### 7XX kentät menee nyt perus-copyllä
    if (checkTagGroup(sourceTags, field7XX) === true) {

    }
    debug(`Case 2`);
  }

  // Case 3: Base (base) has 7XX fields but not 1XX fields
  // ### Onko tämä edes mahdollista?
  if (checkTagGroup(baseTags, field1XX) === false && checkTagGroup(baseTags, field7XX) === true) {
    debug(`Case 3`);
  }

  // Case 4: Base (base) has both 1XX and 7XX fields
  if (checkTagGroup(baseTags, field1XX) === true && checkTagGroup(baseTags, field7XX) === true) {
    debug(`Case 4`);
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

  function checkTagGroup(tags, group) {
    if (tags.every(tag => group.indexOf(tag) === -1)) {
      debug(`Record does not contain fields: ${group}`);
      return false;
    }
    debug(`Record contains one or more fields: ${group}`);
    return true;
  }

  return base;
};
