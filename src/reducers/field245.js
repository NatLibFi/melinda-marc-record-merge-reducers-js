import createDebugLogger from 'debug';

import {
  checkIdenticalness
} from './utils.js';

// Test 31: Identical fields in source and base => keep base
// Test 32: Source has more subfields => replace base with source (but keep base ind2)
// Test 33: Same number of subfields (but different content) => keep base

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^245$/u); // Get array of base fields
  const sourceFields = source.get(/^245$/u); // Get array of source fields

  // Test 31
  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  // Field 245 is non-repeatable
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // Run the function to get the base record to return
  return mergeField245(base, baseField, sourceField);

  function mergeField245(base, baseField, sourceField) {
    debug(`Working on field 245`);
    const baseSubs = baseField.subfields;
    const sourceSubs = sourceField.subfields;
    // If the source field has more subfields, replace base with source (Test 32)
    if (sourceSubs.length > baseSubs.length) {
      const newBaseField = JSON.parse(JSON.stringify(sourceField));
      // But indicator 2 is always taken from the base record
      newBaseField.ind2 = baseField.ind2;
      /* eslint-disable */
      base.removeField(baseField); // remove old baseField
      base.insertField(newBaseField); // insert newBaseField
      /* eslint-enable */
      debug(`Source 245 is longer, replacing base field with source field`);
      return base;
    }
    // Otherwise keep existing base field (Test 33)
    debug(`Keeping base field 245`);
    return base;
  }
};
