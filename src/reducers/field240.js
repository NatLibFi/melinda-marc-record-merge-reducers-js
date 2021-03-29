import createDebugLogger from 'debug';

import {
  checkIdenticalness
} from './utils.js';

//### 240-kenttä tuodaan ei-preferoitavasta tietueesta vain, jos preferoitavassa tietueessa ei ole 240-kenttää tai 130-kenttää.
//### Jos molemmissa tietuesissa on 240-kenttä, ja ne ovat samat, voidaan preferoitavan tietueen 240-kenttää täydentää ei-preferoitavan kentän täydentävillä osakentillä.

// #### Keskeneräinen

// Test 34: Base does not contain 240 or 130 => copy 240 from source
// Test 35:

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^240$/u); // Get array of base fields
  debug(`### baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  const sourceFields = source.get(/^240$/u); // Get array of source fields
  debug(`### sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  // Test 31
  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);
  debug(`### nonIdenticalFields: ${JSON.stringify(nonIdenticalFields, undefined, 2)}`);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  // Field 240 is non-repeatable
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
