import createDebugLogger from 'debug';

import {
  checkIdenticalness, copyNonIdenticalFields, selectLongerField
} from './utils.js';

//### 240-kenttä tuodaan ei-preferoitavasta tietueesta vain, jos preferoitavassa tietueessa ei ole 240-kenttää tai 130-kenttää.
//### Jos molemmissa tietuesissa on 240-kenttä, ja ne ovat samat, voidaan preferoitavan tietueen 240-kenttää täydentää ei-preferoitavan kentän täydentävillä osakentillä.

// Field 240 is non-repeatable
// Test 34: Base contains 130 => keep base 240
// Test 35: Base does not contain 240 or 130 => copy 240 from source
// Note: Test base has dummy 010 because if fields = [], it is not recognized as a valid MarcRecord object
// Test 36: Base contains different 240 => keep base
// Test 37: Base 240 is subset of source 240 => copy 240 from source

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^240$/u); // Get array of base fields
  const sourceFields = source.get(/^240$/u); // Get array of source fields
  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);
  debug(`### nonIdenticalFields: ${JSON.stringify(nonIdenticalFields, undefined, 2)}`);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }
  // Test 34: If base contains field 130, keep base 240 (no need to even look at source)
  const base130 = base.get(/^130$/u);
  if (base130.length > 0) {
    return base;
  }
  // Test 35: If base does not contain 130 (checked above) or 240, copy source 240 to base
  if (baseFields.length === 0) {
    return copyNonIdenticalFields(base, nonIdenticalFields);
  }

  // Run the function to get the base record to return
  return mergeField240();

  function mergeField240() {
    if (sourceFields.every(sourceField => baseFields.every(baseField => selectLongerField(base, baseField, sourceField)))) {
      return base;
    }
  }
};
