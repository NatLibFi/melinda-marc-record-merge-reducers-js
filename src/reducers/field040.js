import createDebugLogger from 'debug';

import {
  checkIdenticalness,
  getRepSubs,
  getNonRepSubs,
  sortSubfields,
  makeNewBaseField,
  fieldRenameSubfieldCodes
} from './utils.js';

// Define repeatable and non-repeatable subfield codes
const repCodes = ['d', 'e', '8'];
const nonRepCodes = ['a', 'b', 'c', '6'];
// Custom subfield sort order for field 040
const sortOrder040 = ['8', '6', 'a', 'b', 'c', 'e', 'd'];

// Test 18: Copy new field from source to base record (case 1)
// Note: Test 18 base has a dummy 010 field because if fields=[], it is not a valid MarcRecord
// Test 19: Copy subfields from source field to base field (case 2)

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
const fieldTag = /^040$/u; // Tag in regexp format (for use in MarcRecord functions)

export default () => (base, source) => {
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields

  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }


  // Run the function to get the base record to return
  return mergeField040(base, baseFields, sourceFields);

  function mergeField040(record, baseFields, sourceFields) {
    debug(`Working on field 040`);
    // In all cases, source $a value is copied to a new $d and $a is removed.
    // NB! Feature: If base has no 040, the added 040 field won't have $a subfield.
    sourceFields.map(field => fieldRenameSubfieldCodes(field, 'a', 'd'));

    // Since 040 is a non-repeatable field, there *should* be only one instance in both source and base
    // The arrays can be destructured into objects right away
    const [baseField] = baseFields;
    const [sourceField] = sourceFields;


    //sourceField = fieldRenameSubfieldCodes(sourceField, 'a', 'd');
    sourceField.subfields = sortSubfields(sourceField.subfields, sortOrder040);
    // NV: Just my opinion, but I think sortSubfields should be passed a field, not an array of it's subfields...

    // Case 1: If field 040 is missing completely from base, copy it from source as a new field.
    //         Assume that the sort order is decent as well.
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
