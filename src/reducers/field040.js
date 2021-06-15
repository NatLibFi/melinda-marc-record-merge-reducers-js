import createDebugLogger from 'debug';
import {mergeOrAddField} from './mergeField.js';

import {
  getNonIdenticalFields,
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
// Test 19: Copy subfields from source field to base field (case 2), NB! has noisy $x field. Should we take or drop it?
// Test 19b: 040 "$a FOO $d BAR" vs 040 "$a BAR $d FOO":
// Test 19c: Transfer source's 040$a to 040$d
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
const fieldTag = /^040$/u; // Tag in regexp format (for use in MarcRecord functions)


export default () => (record, record2) => {
  const candidateFields = record2.get(fieldTag); // Get array of source fields
  candidateFields.forEach(candField => mergeOrAddField(record, candField));
  return record;
};

/*
export default () => (base, source) => {
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields

  const nonIdenticalFields = getNonIdenticalFields(baseFields, sourceFields);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }


  // Run the function to get the base record to return
  return mergeField040(base, baseFields, sourceFields);

  function copyMissingSubfields(base, baseField, sourceField) {
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

  function mergeField040(record, baseFields, sourceFields) {
    debug(`Working on field 040`);
    // Rename subfield $a to $d, dont' remove $a and add $d, since it would mess the original order.
    // NB! Feature (not bug): If base has no 040, the added 040 field won't have $a subfield, which is fine.
    sourceFields.map(field => fieldRenameSubfieldCodes(field, 'a', 'd'));

    // Since 040 is a non-repeatable field, there *should* be only one instance in both source and base
    // The arrays can be destructured into objects right away
    const [baseField] = baseFields;
    const [sourceField] = sourceFields;


    //sourceField = fieldRenameSubfieldCodes(sourceField, 'a', 'd');
    // eslint-disable-next-line functional/immutable-data
    sourceField.subfields = sortSubfields(sourceField.subfields, sortOrder040);
    // NV: Just my opinion, but I think sortSubfields should be passed a field, not an array of it's subfields...

    // Case 1: If field 040 is missing completely from base, copy it from source as a new field.
    //         Assume that the sort order is decent as well.
    // NB! This theoretically copies all, not just one.
    if (baseFields.length === 0) {
      debug(`Missing field 040 copied from source to base`);
      sourceFields.forEach(f => base.insertField(f)); // NB! the can be only one, or at least should
      return base;
    }

    return copyMissingSubfields(base, baseField, sourceField);

  }
};

*/
