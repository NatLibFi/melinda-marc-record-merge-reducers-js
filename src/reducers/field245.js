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
  debug(`### baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  const sourceFields = source.get(/^245$/u); // Get array of source fields
  debug(`### sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  // Test 31
  if (checkIdenticalness(baseFields, sourceFields) === true) {
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
    debug(`### baseSubs: ${JSON.stringify(baseSubs, undefined, 2)}, length: ${baseSubs.length}`);
    const sourceSubs = sourceField.subfields;
    debug(`### sourceSubs: ${JSON.stringify(sourceSubs, undefined, 2)}, length: ${sourceSubs.length}`);
    // If the source field has more subfields, replace base with source (Test 32)
    if (sourceSubs.length > baseSubs.length) {
      const newBaseField = JSON.parse(JSON.stringify(sourceField));
      // But indicator 2 is always taken from the base record
      newBaseField.ind2 = baseField.ind2;
      debug(`### newBaseField: ${JSON.stringify(newBaseField, undefined, 2)}`);
      /* eslint-disable */
      base.removeField(baseField); // remove old baseField
      debug(`### Base after removing old baseField: ${JSON.stringify(base, undefined, 2)}`);
      base.insertField(newBaseField); // insert newBaseField
      debug(`### Base after inserting newBaseField: ${JSON.stringify(base, undefined, 2)}`);
      /* eslint-enable */
      debug(`Source 245 is longer, replacing base field with source field`);
      return base;
    }
    // Otherwise keep existing base field (Test 33)
    debug(`Keeping base field 245`);
    return base;
  }
};
