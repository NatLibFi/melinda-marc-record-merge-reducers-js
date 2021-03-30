import createDebugLogger from 'debug';

import {
  checkIdenticalness,
  getRepSubs,
  getNonRepSubs,
  sortSubfields,
  makeNewBaseField
} from './utils.js';

// Test 18: Copy new field from source to base record (case 1)
// Note: Test 18 base has a dummy 010 field because if fields=[], it is not a valid MarcRecord
// Test 19: Copy subfields from source field to base field (case 2)

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^040$/u; // Tag in regexp format (for use in MarcRecord functions)
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields

  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }
  // Define repeatable and non-repeatable subfield codes
  const repCodes = ['d', 'e', '8'];
  const nonRepCodes = ['a', 'b', 'c', '6'];
  // Custom subfield sort order for field 040
  const sortOrder040 = ['8', '6', 'a', 'b', 'c', 'e', 'd'];

  // Since 040 is a non-repeatable field, there can be only one instance in both source and base
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // Run the function to get the base record to return
  return mergeField040(base, baseField, sourceField, repCodes, nonRepCodes);

  function mergeField040(base, baseField, sourceField, repCodes, nonRepCodes) {
    debug(`Working on field 040`);

    // In all cases, source $a value is copied to a new $d and $a is removed
    transferSubfieldValue(sourceField, 'a', 'd');

    // Transfer the value of one subfield to another
    // For 040: transfer source $a value to $d to prepare for copying to base
    function transferSubfieldValue(field, origSub, targetSub) {
      // Get string value of original subfield
      const transferredValue = String(field.subfields
        .filter(sub => sub.code === origSub)
        .map(sub => sub.value));
      // Add new target subfield instance with value transferred from original subfield
      /* eslint-disable functional/immutable-data */
      field.subfields.push({code: targetSub, value: transferredValue});
      // Remove old original subfield completely (filter to new array without it) and sort subfields
      const filteredSubfields = field.subfields.filter(subfield => subfield.code !== origSub);
      const newSubfields = sortSubfields(filteredSubfields, sortOrder040);
      // Replace subfields with new array
      /* eslint-disable functional/immutable-data */
      field.subfields = newSubfields;
    }

    // Case 1: If field 040 is missing completely from base, copy it from source as a new field
    if (baseFields.length === 0) {
      debug(`Missing field 040 copied from source to base`);
      sourceFields.forEach(f => base.insertField(f));
      return base;
    }

    // Case 2: If field 040 exists in base, copy missing subfields from source

    // Copy other subfields from source field to base field
    // For non-repeatable subfields, the value existing in base (base) is preferred
    // Non-repeatable subfields are copied from source only if missing completely in base
    const nonRepSubsToCopy = getNonRepSubs(sourceField, nonRepCodes);

    // Repeatable subfields are copied if the value is different
    const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes);

    // Create new base field to replace old one
    const sortedSubfields = sortSubfields([...baseField.subfields, ...nonRepSubsToCopy, ...repSubsToCopy], sortOrder040);
    return makeNewBaseField(base, baseField, sortedSubfields);
  }
};
