import createDebugLogger from 'debug';

import {
  getRepCodes,
  getNonRepCodes,
  repeatableField
} from './utils.js';

// Test 09: Copy new field from source to base record (case 1)
// Test 10: Copy subfields from source field to base field (case 2)
// Test 11: Both cases in the same record: copy a new field (case 1) and add subfields to an existing field (case 2)

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^020$/u; // Tag in regexp format (for use in MarcRecord functions)
  const tagString = fieldTag.source.slice(1, 4); // Tag number as string
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields

  // Get arrays of repeatable and non-repeatable subfield codes from melindaCustomMergeFields.json
  const repCodes = getRepCodes(tagString);
  const nonRepCodes = getNonRepCodes(tagString);

  // If there are multiple instances of the field in source and/or base
  if (sourceFields.length > 1 || baseFields.length > 1) {
    // Iterate through all fields in base and source arrays
    const outerLoop = sourceFields.map(sourceField => {
      const innerLoop = baseFields.map(baseField => {
        return repeatableField(base, tagString, baseField, sourceField, repCodes, nonRepCodes);
      });
      // Destructure array returned by innerLoop into object to pass to outerLoop
      const [tempObj] = innerLoop;
      return tempObj;
    });
    // The outer loop returns an array with as many duplicate objects as there are fields
    // Destructure the array to get only one object (the first) as the MarcRecord to return
    const [result] = outerLoop;
    return result;
  }

  // Default case: there is just one instance of the field in both source and base
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // Run the function to get the base record to return
  return repeatableField(base, tagString, baseField, sourceField, repCodes, nonRepCodes);
};
