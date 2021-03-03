import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {
  modifyBaseField,
  checkIdenticalness
} from './utils.js';

// Test 22: Base has no 830, source has 830 with $x => copy source 830 to base
// Test 23: Base already has 830 with $x, source has different 830 with $x => keep base
// Test 24: Base has no 830, source 830 does not have $x => keep base
// Test 25: Base has 830 with no $x, source has same 830 with $x => copy source 830 to base
// Test 26: Base has 2x 830, one with $x and one without, source has both with $x => copy missing 830 with $x
// Test 27: Identical 830 in base and source => keep base
// Test 28: Source has longer 830 but no $x => keep base
// Test 29: 2x identical 830 fields in source and base in different order => keep both base fields

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^830$/u; // Tag in regexp format (for use in MarcRecord functions)
  const baseFields = base.get(fieldTag); // Get array of base fields
  debug(`### baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  const sourceFields = source.get(fieldTag); // Get array of source fields
  debug(`### sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  // Test 27 (identical) and 29 (2x identical fields in different order)
  if (checkIdenticalness(baseFields, sourceFields) === true) {
    return base;
  }

  // Field 830 is repeatable
  // If there are multiple instances of the field in source and/or base
  if (sourceFields.length > 1 || baseFields.length > 1) {
    // Iterate through all fields in base and source arrays
    const outerLoop = sourceFields.map(sourceField => {
      const innerLoop = baseFields.map(baseField => getField830(base, baseField, sourceField));
      // Destructure array returned by innerLoop into object to pass to outerLoop
      const [tempObj] = innerLoop;
      return tempObj;
    });
    // The outer loop returns an array with as many duplicate objects as there are fields
    // Filter out duplicates and return only one result object in MarcRecord format
    const stringified = outerLoop.map(obj => JSON.stringify(obj));
    const filtered = JSON.parse(stringified.filter((item, index) => stringified.indexOf(item) >= index));
    return new MarcRecord(filtered);
  }

  // Default case: there is just one instance of the field in both source and base
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // Run the function to get the base record to return
  return getField830(base, baseField, sourceField);

  function getField830(base, baseField, sourceField) {
    debug(`Working on field 830`);

    // First, check whether base has 830
    if (baseFields.length > 0) {
      // Then check whether base 830 has $x, if yes, nothing needs to be done (Test 23)
      if (baseField.subfields.map(sub => sub.code).indexOf('x') !== -1) {
        debug(`Base 830 has subfield x (ISSN), keeping base 830`);
        return base;
      }
      // If not, check whether source 830 has $x (Test 25)
      if (sourceField.subfields.map(sub => sub.code).indexOf('x') !== -1) {
        // If source 830 has $x, replace base 830 with source 830
        debug(`Source 830 has subfield x (ISSN), copying source 830 to base`);
        modifyBaseField(base, baseField, sourceField);
        debug(`### Base after modification: ${JSON.stringify(base, undefined, 2)}`);
        return base;
      }
      // Base has 830 without $x, source does not have $x either (Test 28)
      debug(`Source 830 has no subfield x (ISSN), keeping base 830`);
      return base;
    }
    // If base has no 830, source 830 is copied if it has $x (Test 22)
    if (sourceField.subfields.map(sub => sub.code).indexOf('x') !== -1) {
      debug(`Source 830 has subfield x (ISSN), copying source 830 to base`);
      base.insertField(sourceField);
      debug(`### Base after copying: ${JSON.stringify(base, undefined, 2)}`);
      return base;
    }
    // If source 830 does not have $x either, nothing is copied (Test 24)
    debug(`Source 830 has no ISSN, keeping existing field`);
    return base;
  }
};
