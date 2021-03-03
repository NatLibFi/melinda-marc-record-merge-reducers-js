import createDebugLogger from 'debug';

import {
  checkIdenticalness,
  getRepCodes,
  getNonRepCodes,
  getRepSubs,
  getNonRepSubs,
  modifyBaseField,
  sortSubfields
} from './utils.js';

// Test 20: Copy new field from source to base record (case 1)
// Test 21: Copy subfields from source field to base field (case 2)

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^042$/u; // Tag in regexp format (for use in MarcRecord functions)
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields

  if (checkIdenticalness(baseFields, sourceFields) === true) {
    return base;
  }

  // Get arrays of repeatable and non-repeatable subfield codes from melindaCustomMergeFields.json
  const repCodes = getRepCodes('042');
  const nonRepCodes = getNonRepCodes('042');

  // Since 042 is a non-repeatable field, there can be only one instance in both source and base
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // Run the function to get the base record to return
  return getField042(base, baseField, sourceField, repCodes, nonRepCodes);

  function getField042(base, baseField, sourceField, repCodes, nonRepCodes) {
    debug(`Working on field 042`);

    // Case 1: If field 042 is missing completely from base, copy it from source as a new field
    if (baseFields.length === 0) {
      debug(`Missing field 042 copied from source to base`);
      sourceFields.forEach(f => base.insertField(f));
      return base;
    }

    // Case 2: If field 042 exists in base, copy missing subfields from source

    // Copy other subfields from source field to base field
    // For non-repeatable subfields, the value existing in base (base) is preferred
    // Non-repeatable subfields are copied from source only if missing completely in base
    // 042: none
    const nonRepSubsToCopy = getNonRepSubs(sourceField, nonRepCodes);

    // Repeatable subfields are copied if the value is different
    // 042: $a
    const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes);

    // Create modified base field and replace old base record in base with it
    const modifiedBaseField = JSON.parse(JSON.stringify(baseField));
    const sortedSubfields = sortSubfields([...baseField.subfields, ...nonRepSubsToCopy, ...repSubsToCopy]);
    /* eslint-disable functional/immutable-data */
    modifiedBaseField.subfields = sortedSubfields;
    modifyBaseField(base, baseField, modifiedBaseField);
    debug(`### Base after modification: ${JSON.stringify(base, undefined, 2)}`);
    return base; // Base record returned in case 2
  }
};
