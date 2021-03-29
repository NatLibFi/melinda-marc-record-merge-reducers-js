import createDebugLogger from 'debug';

import {
  checkIdenticalness,
  getRepSubs,
  sortSubfields
} from './utils.js';

// Test 20: Copy new field from source to base record (case 1)
// Test 21: Copy subfields from source field to base field (case 2)

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^042$/u; // Tag in regexp format (for use in MarcRecord functions)
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields

  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);
  debug(`### nonIdenticalFields: ${JSON.stringify(nonIdenticalFields, undefined, 2)}`);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  // 042 has only one subfield, $a, which is repeatable
  const repCodes = ['a'];

  // Since 042 is a non-repeatable field, there can be only one instance in both source and base
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // Run the function to get the base record to return
  return mergeField042(base, baseField, sourceField, repCodes);

  function mergeField042(base, baseField, sourceField, repCodes) {
    debug(`Working on field 042`);

    // Case 1: If field 042 is missing completely from base, copy it from source as a new field
    if (baseFields.length === 0) {
      debug(`Missing field 042 copied from source to base`);
      sourceFields.forEach(f => base.insertField(f));
      return base; // Base returned in case 1
    }

    // Case 2: If field 042 exists in base, copy missing subfields from source
    // Repeatable subfields are copied if the value is different
    // 042: $a
    const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes);

    const newBaseField = JSON.parse(JSON.stringify(baseField));
    const sortedSubfields = sortSubfields([...baseField.subfields, ...repSubsToCopy]);
    newBaseField.subfields = sortedSubfields;
    /* eslint-disable */
    base.removeField(baseField); // remove old baseField
    debug(`### Base after removing old baseField: ${JSON.stringify(base, undefined, 2)}`);
    base.insertField(newBaseField); // insert newBaseField
    debug(`### Base after inserting newBaseField: ${JSON.stringify(base, undefined, 2)}`);
    /* eslint-enable */
    return base; // Base returned in case 2
  }
};
