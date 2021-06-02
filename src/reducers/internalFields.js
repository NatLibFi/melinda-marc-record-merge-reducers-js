import createDebugLogger from 'debug';
import {checkIdenticalness, copyFields} from './utils.js';

// Test 01: Identical LOW, CAT, SID (2x each) --> keep base
// Test 02: Some identical, some different --> copy different from source to base
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
const fieldTag = /^(?:LOW|CAT|SID)$/u;

export default () => (base, source) => {
  const baseFields = base.get(fieldTag);
  const sourceFields = source.get(fieldTag);

  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);

  // Test 01
  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  // Test 02
  return mergeInternal();

  function mergeInternal() {
    // If specific conditions are applied to copying internal fields, they are defined here
    return copyFields(base, nonIdenticalFields);
  }
};
