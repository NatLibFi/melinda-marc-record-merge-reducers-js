import createDebugLogger from 'debug';

import {
  checkIdenticalness,
//  getRepCodes,
//  getNonRepCodes,
  getRepSubs,
  getNonRepSubs,
  sortSubfields
} from './utils.js';

// Test 18: Copy new field from source to base record (case 1)
// Note: Test 18 base has a dummy 010 field because if fields=[], it is not a valid MarcRecord
// Test 19: Copy subfields from source field to base field (case 2)

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^040$/u; // Tag in regexp format (for use in MarcRecord functions)
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields
  debug(`### sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);
  debug(`### nonIdenticalFields: ${JSON.stringify(nonIdenticalFields, undefined, 2)}`);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  // Get arrays of repeatable and non-repeatable subfield codes from melindaCustomMergeFields.json
//  const repCodes = getRepCodes('040');
//  const nonRepCodes = getNonRepCodes('040');
    const repCodes = ['d', 'e', '8'];
    const nonRepCodes = ['a', 'b', 'c', '6'];

  // Since 040 is a non-repeatable field, there can be only one instance in both source and base
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  debug(`### baseField: ${JSON.stringify(baseField, undefined, 2)}`);
  const [sourceField] = sourceFields;
  debug(`### sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);
  // Custom subfield sort order for field 040
  const sortOrder040 = ['8', '6', 'a', 'b', 'c', 'e', 'd'];

  // Run the function to get the base record to return
  return mergeField040(base, baseField, sourceField, repCodes, nonRepCodes);

  function mergeField040(base, baseField, sourceField, repCodes, nonRepCodes) {
    debug(`Working on field 040`);

    // In all cases, source $a value is copied to a new $d and $a is removed
    transferSubfieldValue(sourceField, 'a', 'd');
    debug(`### sourceField final: ${JSON.stringify(sourceField, undefined, 2)}`);
    debug(`### sourceFields final: ${JSON.stringify(sourceFields, undefined, 2)}`);

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
    // 040: $a, $b, $c, $8
    const nonRepSubsToCopy = getNonRepSubs(sourceField, nonRepCodes);
    debug(`### nonRepSubsToCopy: ${JSON.stringify(nonRepSubsToCopy, undefined, 2)}`);

    // Repeatable subfields are copied if the value is different
    // 040: $d, $e, $8
    const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes);
    //debug(`repSubsToCopy: ${JSON.stringify(repSubsToCopy, undefined, 2)}`);

    // Create new base field to replace old one
    // Copy subfield sort order from source field
    //const orderFromSource = sourceField.subfields.map(subfield => subfield.code);
    //debug(`### orderFromSource: ${JSON.stringify(orderFromSource, undefined, 2)}`);
    const newBaseField = JSON.parse(JSON.stringify(baseField));
    const sortedSubfields = sortSubfields([...baseField.subfields, ...nonRepSubsToCopy, ...repSubsToCopy], sortOrder040);
    newBaseField.subfields = sortedSubfields;
    // ### Tarvitaanko tähän eslint-disable?
    /* eslint-disable */
    base.removeField(baseField); // remove old baseField
    debug(`### Base after removing old baseField: ${JSON.stringify(base, undefined, 2)}`);
    base.insertField(newBaseField); // insert newBaseField
    debug(`### Base after inserting newBaseField: ${JSON.stringify(base, undefined, 2)}`);
    /* eslint-enable */
    return base; // Base returned in case 2
  }
};
