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

// Test 09: Copy new field from source to base record
// Test 10: Copy subfields from source field to base field
// Test 11: Both cases together: copy new field and subfields to the existing field in base

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^020$/; // Tag in regexp format (for use in MarcRecord functions)
  const tagString = fieldTag.source.slice(1, 4); // Tag number as string
  const baseFields = base.get(fieldTag); // Get array of base fields
  debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  const sourceFields = source.get(fieldTag); // Get array of source fields
  debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  // Get arrays of repeatable and non-repeatable subfield codes from melindaCustomMergeFields.json
  const repCodes = getRepCodes(tagString);
  debug(`repCodes: ${JSON.stringify(repCodes, undefined, 2)}`);
  const nonRepCodes = getNonRepCodes(tagString);
  debug(`nonRepCodes: ${JSON.stringify(nonRepCodes, undefined, 2)}`);

  // Iterate through all fields in base and source arrays
  const loopSource = sourceFields.map(sourceField => {
    const loopBase = baseFields.map(baseField => {
      debug(`Working on field ${tagString}`);
      // First check whether the values of identifying subfields are equal
      // 020: $a (ISBN)
      const idCodes = ['a'];

      // If identifying subfield values are not equal, the source field is copied to base as a new field
      if (compareAllSubfields(baseField, sourceField, idCodes) === false) {
        debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);
        base.insertField(sourceField);
        debug(`Base after copying: ${JSON.stringify(base, undefined, 2)}`);
        debug(`Field ${tagString}: One or more subfields (${idCodes}) not matching, source copied as new field to Melinda`);
        return base;
      }

      // If identifying subfield values are equal, continue with the merge process
      debug(`Field ${tagString}: Matching subfields (${idCodes}) found in source and Melinda, continuing with merge`);

      // If there are subfields to drop, define them first (020: $c)
      const dropCodes = ['c'];

      // Copy other subfields from source field to base field
      // Non-repeatable subfields are copied only if missing from base
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
      modifiedBaseField.subfields = sortedSubfields;
      modifyBaseField(base, baseField, modifiedBaseField);
      debug(`Base after modification: ${JSON.stringify(base, undefined, 2)}`);
      return base;
    }); // loopBase end
    debug(`loopBase: ${JSON.stringify(loopBase, undefined, 2)}`);
    // Destructure array returned by loopBase into object to pass to loopSource
    const [obj] = loopBase;
    debug(`obj: ${JSON.stringify(obj, undefined, 2)}`);
    return obj;
  }); // loopSource end
  debug(`loopSource: ${JSON.stringify(loopSource, undefined, 2)}`);
  // Destructure array returned by loopSource into the final result object
  const [result] = loopSource;
  debug(`result: ${JSON.stringify(result, undefined, 2)}`);
  return result; // This is the final MarcRecord object
}; // export default end
