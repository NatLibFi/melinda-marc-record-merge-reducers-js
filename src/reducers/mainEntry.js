import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';

import {
  getTagString,
  checkIdenticalness,
  getRepCodes,
  getNonRepCodes,
  compareAllSubfields,
  getRepSubs,
  getNonRepSubs,
  modifyBaseField,
  sortSubfields
} from './utils.js';

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  // All fields used for main entry, all non-repeatable
  const fieldTag = /^(100|110|111|130|240|700|710|711|730)$/u; // Tag in regexp format (for use in MarcRecord functions)
  const baseFields = base.get(fieldTag); // Get array of base fields
  debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  const sourceFields = source.get(fieldTag); // Get array of source fields
  debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  const baseTags = baseFields.map(field => field.tag);
  debug(`baseTags: ${JSON.stringify(baseTags, undefined, 2)}`);
  const sourceTags = sourceFields.map(field => field.tag);
  debug(`sourceTags: ${JSON.stringify(sourceTags, undefined, 2)}`);

  // ### Toimiiko monella tagilla?
  if (checkIdenticalness(baseFields, sourceFields, tagString) === true) {
    return base;
  }

  // Test 01: Same 100 in both source and base => do not copy
  // Test 02: Base has 100, source has 100 with more subfields => copy additional subfields to base 100
  // Test 03: Base has 100, source has 110 => copy source 110 as 710 to base
  // Test 04: Base has no 1XX/7XX, source has 110 => copy source 110 as 710 to base
  // Test 05: Base has 100 and 710, source has same 110 as base 710 => do not copy
  // Test 06: Base has 100 and 710, source has 110 with more subfields => copy additional subfields to base 710

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

  // Case 1: Base (Melinda) has no 1XX/7XX fields
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

  // Case 2: Base (Melinda) has 1XX fields but not 7XX fields
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

  // Case 3: Base (Melinda) has 7XX fields but not 1XX fields
  // ### Onko tämä edes mahdollista?
  if (checkTagGroup(baseTags, field1XX) === false && checkTagGroup(baseTags, field7XX) === true) {
    debug(`Case 3`);
  }

  // Case 4: Base (Melinda) has both 1XX and 7XX fields
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
      debug(`Field 240 copied from source to Melinda`);

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


  // Get arrays of repeatable and non-repeatable subfield codes from melindaCustomMergeFields.json
  /*  const repCodes = getRepCodes(tagString);
  const nonRepCodes = getNonRepCodes(tagString);

  // If there are multiple instances of the field in source and/or base
  if (sourceFields.length > 1 || baseFields.length > 1) {
    // Iterate through all fields in base and source arrays
    const outerLoop = sourceFields.map(sourceField => {
      const innerLoop = baseFields.map(baseField => repeatableField(base, tagString, baseField, sourceField, repCodes, nonRepCodes));
      // Destructure array returned by innerLoop into object to pass to outerLoop
      const [tempObj] = innerLoop;
      return tempObj;
    });
    // The outer loop returns an array with as many duplicate objects as there are fields
    // Filter out duplicates and return only one result object in MarcRecord format
    const stringified = outerLoop.map(obj => JSON.stringify(obj));
    const filtered = JSON.parse(stringified.filter((item, index) => stringified.indexOf(item) >= index));
    return new MarcRecord(filtered);
  }

  // Default case: there is just one instance of the field in both source and base
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // Run the function to get the base record to return
  return repeatableField(base, tagString, baseField, sourceField, repCodes, nonRepCodes);


  function repeatableField(base, tagString, baseField, sourceField, repCodes, nonRepCodes) {
    debug(`Working on field ${tagString}`);
    // First check whether the values of identifying subfields are equal
    // 020: $a (ISBN)
    const idCodes = ['a'];

    // Case 1: If all identifying subfield values are not equal the entire source field is copied to base as a new field
    if (compareAllSubfields(baseField, sourceField, idCodes) === false) {
      //debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);
      base.insertField(sourceField);
      debug(`Base after copying: ${JSON.stringify(base, undefined, 2)}`);
      debug(`Field ${tagString}: One or more subfields (${idCodes}) not matching, source field copied as new field to Melinda`);
      return base; // Base record returned in case 1
    }

    // Case 2: If identifying subfield values are equal, continue with the merge process
    debug(`Field ${tagString}: Matching subfields (${idCodes}) found in source and Melinda, continuing with merge`);

    // If there are subfields to drop, define them first
    // 020: $c
    const dropCodes = ['c'];

    // Copy other subfields from source field to base field
    // For non-repeatable subfields, the value existing in base (Melinda) is preferred
    // Non-repeatable subfields are copied from source only if missing completely in base
    // 020: $a, $c, $6 (but $a was already checked and $c dropped, so only $6 is copied here)
    const nonRepSubsToCopy = getNonRepSubs(sourceField, nonRepCodes, dropCodes, idCodes);
    //debug(`nonRepSubsToCopy: ${JSON.stringify(nonRepSubsToCopy, undefined, 2)}`);

    // Repeatable subfields are copied if the value is different
    // 020: $q, $z, $8
    const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes, dropCodes, idCodes);
    //debug(`repSubsToCopy: ${JSON.stringify(repSubsToCopy, undefined, 2)}`);

    // Create modified base field and replace old base record in Melinda with it (exception to general rule of data immutability)
    // Subfields in the modified base field are arranged by default in alphabetical order (a-z, 0-9)
    // To use a different sorting order, set it as the second parameter in sortSubfields
    // Example: copy subfield sort order from source field
    // const orderFromSource = sourceField.subfields.map(subfield => subfield.code);

    const modifiedBaseField = JSON.parse(JSON.stringify(baseField));
    const sortedSubfields = sortSubfields([...baseField.subfields, ...nonRepSubsToCopy, ...repSubsToCopy]);
    /* eslint-disable functional/immutable-data */
  /*modifiedBaseField.subfields = sortedSubfields;
    modifyBaseField(base, baseField, modifiedBaseField);
    debug(`Base after modification: ${JSON.stringify(base, undefined, 2)}`);
    return base; // Base record returned in case 2
  }*/
  return base;
};
