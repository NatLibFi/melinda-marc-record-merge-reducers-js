import createDebugLogger from 'debug';

import {
  getRepCodes,
  getNonRepCodes,
  compareAllSubfields,
  getNonRepSubs,
  getRepSubs,
  modifyBaseField,
  sortSubfields
} from './utils.js';

// Test 09: Copy new field from source to base record (case 1)
// Test 10: Copy subfields from source field to base field (case 2)
// Test 11: Both cases in the same record: copy a new field (case 1) and add subfields to an existing field (case 2)

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^020$/u; // Tag in regexp format (for use in MarcRecord functions)
  const tagString = fieldTag.source.slice(1, 4); // Tag number as string
  const baseFields = base.get(fieldTag); // Get array of base fields
  //debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  const sourceFields = source.get(fieldTag); // Get array of source fields
  //debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  // Get arrays of repeatable and non-repeatable subfield codes from melindaCustomMergeFields.json
  const repCodes = getRepCodes(tagString);
  //debug(`repCodes: ${JSON.stringify(repCodes, undefined, 2)}`);
  const nonRepCodes = getNonRepCodes(tagString);
  //debug(`nonRepCodes: ${JSON.stringify(nonRepCodes, undefined, 2)}`);

  // Iterate through all fields in source and base arrays
  function loopSource(sourceFields) {
    debug(`Entering loopSource`);
    sourceFields.map(sourceField => {
      return loopBase(baseFields);
    }); // loopSource end
  }

  function loopBase(baseFields) {
    baseFields.map(baseField => {
    debug(`Entering loopBase`);
    debug(`Working on field ${tagString}`);
    // First check whether the values of identifying subfields are equal
    // 020: $a (ISBN)
    const idCodes = ['a'];

    // Case 1: If all identifying subfield values are not equal the entire source field is copied to base as a new field
    if (compareAllSubfields(baseField, sourceField, idCodes) === false) {
      debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);
      base.insertField(sourceField);
      debug(`Base after copying: ${JSON.stringify(base, undefined, 2)}`);
      debug(`Field ${tagString}: One or more subfields (${idCodes}) not matching, source copied as new field to Melinda`);
      return base; // This is returned in case 1
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
    debug(`nonRepSubsToCopy: ${JSON.stringify(nonRepSubsToCopy, undefined, 2)}`);

    // Repeatable subfields are copied if the value is different
    // 020: $q, $z, $8
    const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes, dropCodes, idCodes);
    debug(`repSubsToCopy: ${JSON.stringify(repSubsToCopy, undefined, 2)}`);

    // Create modified base field and replace old base record in Melinda with it (exception to general rule of data immutability)
    // Subfields in the modified base field are arranged by default in alphabetical order (a-z, 0-9)
    // To use a custom sorting order, set it as the second parameter in sortSubfields
    const modifiedBaseField = JSON.parse(JSON.stringify(baseField));
    const sortedSubfields = sortSubfields([...baseField.subfields, ...nonRepSubsToCopy, ...repSubsToCopy]);
    /* eslint-disable functional/immutable-data */
    modifiedBaseField.subfields = sortedSubfields;
    modifyBaseField(base, baseField, modifiedBaseField);
    debug(`Base after modification: ${JSON.stringify(base, undefined, 2)}`);
    return base; // This is returned in case 2
    });
  } // loopBase end
const result = loopSource(sourceFields);
debug(`result: ${JSON.stringify(result, undefined, 2)}`);
return result; // This is the final MarcRecord object
}; // export default end
