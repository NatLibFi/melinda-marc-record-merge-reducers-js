import createDebugLogger from 'debug';
import {checkIdenticalness, copyNonIdenticalFields} from './utils.js';

// Test 01: Identical LOW, CAT, SID (2x each) --> keep base
// Test 02: Some identical, some different --> copy different from source to base

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/(LOW|CAT|SID)$/u);
  const sourceFields = source.get(/^(LOW|CAT|SID)$/u);

  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);
  debug(`### nonIdenticalFields: ${JSON.stringify(nonIdenticalFields, undefined, 2)}`);

  // Test 01
  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  // Test 02
  return mergeInternal();

  // ### Pitäisikö kenttiä järjestää tässä jotenkin?
  function mergeInternal() {
    return copyNonIdenticalFields(base, nonIdenticalFields);
  }
}
