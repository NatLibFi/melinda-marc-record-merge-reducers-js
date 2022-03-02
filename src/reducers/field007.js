import createDebugLogger from 'debug';
import {copyFields, fieldToString} from './utils.js';

// Test 04: If 007/00-01 are different in base and source, copy 007 from source to base as new field (2x)
// Test 05: If 007/00-01 are the same, keep existing field 007 in base (2x)

// NB: handle merging better.ns
export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^007$/u);
  const sourceFields = source.get(/^007$/u);

  const mergableFields = sourceFields.filter(sf => baseFields.every(bf => allowCopy(bf, sf)));

  //const nonIdenticalFields = getNonIdenticalFields(baseFields, sourceFields);

  if (mergableFields.length > 0) {
    debug(`${mergableFields.length} copyable field(s)`);
    return copyFields(base, mergableFields);
  }

  return base;

  function allowCopy(baseField, sourceField) {
    // Copy source field if source 007/00 and/or 007/01 are different from base
    if (baseField.value[0] === sourceField.value[0]) {
      if (baseField.value[1] === sourceField.value[1] || sourceField.value[1] === '|') {
        // If 007/00 and 01 are identical, keep base field
        debug(`Don't copy ${fieldToString(sourceField)}`);
        return false;
      }
    }
    return true;
  }
};
