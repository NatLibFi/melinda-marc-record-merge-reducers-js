import createDebugLogger from 'debug';
import {checkIdenticalness, copyNonIdenticalFields} from './utils.js';

// Test 01: Identical LOW, CAT, SID (2x each) --> keep base
// Test 02: Some identical, some different --> copy different from source to base

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  // ?<internal> lisätty koska muuten eslint herjaa: Capture group '(LOW|CAT|SID)' should be converted to a named or non-capturing group  prefer-named-capture-group
  const internalFields = /^(?<internal>LOW|CAT|SID)$/u;
  const baseFields = base.get(internalFields);
  const sourceFields = source.get(internalFields);

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
    return copyNonIdenticalFields(base, nonIdenticalFields);
  }
};
