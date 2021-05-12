import createDebugLogger from 'debug';
import {checkIdenticalness, copyNonIdenticalFields} from './utils.js';

// Test 02: If Leader 000/06 is 'o' or 'p' in source, copy 006 from source to base as new field (2x)
// Test 03: If Leader 000/06 is something else, do nothing

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^006$/u);
  const sourceFields = source.get(/^006$/u);

  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  if (source.leader[6] === 'o' || source.leader[6] === 'p') {
    return copyNonIdenticalFields(base, nonIdenticalFields);
  }
  debug(`Keeping base field 006`);
  return base;
};
