import createDebugLogger from 'debug';
import {
  checkIdenticalness // , recordReplaceField
} from './utils.js';

// Test 22: Base has no 830, source has 830 with $x => copy source 830 to base (2x)
// Test 23: Base already has 830 with $x, source has different 830 with $x => keep base
// Test 24: Base has no 830, source 830 does not have $x => keep base
// Test 25: Base has 830 with no $x, source has same 830 with $x => copy source 830 to base
// Test 26: Base has 2x 830, one with $x and one without, source has both with $x => copy missing 830 with $x
// Test 27: Identical 830 in base and source => keep base
// Test 28: Source has longer 830 but no $x => keep base
// Test 29: 2x identical 830 fields in source and base in different order => keep both base fields
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
const fieldTag = /^830$/u; // Tag in regexp format (for use in MarcRecord functions)

function noActionRequired(baseFields, sourceFields) {
  // Test 27 (identical) and 29 (2x identical fields in different order)
  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return true;
  }
  // We could check whether any sourceField contains $x here, but not doing it now.
  return false;
}

function copyField(record, field) {
  // If base has no 830, source 830 is copied if it has $x (Test 22)
  if (field.subfields.map(sub => sub.code).indexOf('x') !== -1) {
    debug(`Source 830 has subfield x (ISSN), copying source 830 to base`);
    record.insertField(field);
    return record;
  }
  // If source 830 does not have $x either, nothing is copied (Test 24)
  debug(`Source 830 has no ISSN, keeping existing field`);
  return record;
}

function copyFields(record, fields) {
  fields.every(field => copyField(record, field));
  return record;
}

export default () => (base, source) => {
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields

  // If base does not contain 830 fields, they are copied from source (lightest test first)
  if (baseFields.length === 0) {
    return copyFields(base, sourceFields);
  }

  // reduce the nuber of commands within this function by moving part of the code to a separate function:
  if (noActionRequired(baseFields, sourceFields)) {
    return base;
  }


  // If base contains 830 fields, merge them with source (terms and conditions apply)
  sourceFields.every(sourceField => baseFields.every(baseField => mergeField830(base, baseField, sourceField)));
  return base;

  function mergeField830(base, baseField, sourceField) {
    debug(`Working on field 830`);
    // Check whether base 830 has $x, if yes, nothing needs to be done (Test 23)
    if (baseField.subfields.map(sub => sub.code).indexOf('x') !== -1) {
      debug(`Base 830 has subfield x (ISSN), keeping base 830`);
      return base;
    }
    // If not, check whether source 830 has $x (Test 25)
    if (sourceField.subfields.map(sub => sub.code).indexOf('x') !== -1) {
      // If source 830 has $x, replace base 830 with source 830
      debug(`Source 830 has subfield x (ISSN), copying source 830 to base`);
      /* eslint-disable */
      /* base = recordReplaceField(base, baseField, sourceField); // preserves position */
      base.removeField(baseField);
      base.insertField(sourceField);
      /* eslint-enable */
      return base;
    }
  }

};
