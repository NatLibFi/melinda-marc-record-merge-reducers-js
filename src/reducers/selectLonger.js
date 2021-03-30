import createDebugLogger from 'debug';
import {
  checkIdenticalness,
  selectLongerField
} from './utils.js';

/**
 * These rules apply to fields:
 * Repeatable: 033, 034, 046, 257, 300
 * Non-repeatable: 039, 045
 * If source field is longer, replace base field with source field
 * Longer means fulfilling either (but not both) of these conditions:
 *   a) Source has more subfields than base
 * Or if source and base have the same number of subfields:
 *   b) Subfield values in source are supersets of subfield values in base
 * Test 01: 033 and 039: case a) (2x 033)
 * Test 02: 033 and 039: case b) (2x 033)
 * Test 03: 033 and 033: Two instances of the same repeatable field, one a) and one b)
 * Test 04: 033 and 033: Same as 03 but fields are in different order
 * Test 05: Identical 033 and 039 in source and base => keep base
 * Test 06: Same as 05 but fields in different order => keep base
 *  */

export default ({tagPattern}) => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(tagPattern);
  const sourceFields = source.get(tagPattern);
  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  // Run the function to get the base record to return
  return mergeLongerField();

  function mergeLongerField() {
    if (sourceFields.every(sourceField => baseFields.every(baseField => selectLongerField(base, baseField, sourceField)))) {
      return base;
    }
  }
};
