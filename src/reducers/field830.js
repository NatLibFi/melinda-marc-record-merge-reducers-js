import createDebugLogger from 'debug';
import {
  getNonIdenticalFields, mapDatafield // , recordReplaceField
} from './utils.js';

// Test 22: Base has no 830, source has 830 with $x => copy source 830 to base (2x)
// Test 23: removed, did not agree with specs.
// Test 24: Base has no 830, source 830 does not have $x => do nothing.
// Test 25: Base has 830 with no $x, source has same 830 with $x => copy source 830 to base
// Test 26: Base has 2x 830, one with $x and one without, source has both with $x => copy missing 830 with $x, don't remove the missing one
// Test 27: Identical 830 in base and source => keep base
// Test 28: Source has longer 830 but no $x => keep base
// Test 29: 2x identical 830 fields in source and base in different order => keep both base fields
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
const fieldTag = /^830$/u; // Tag in regexp format (for use in MarcRecord functions)


function conditionallyCopyField(record, field) {
  // If base has no 830, source 830 is copied if it has $x (Test 22)
  debug(' inspect "'+mapDatafield(field)+'"');
  if (field.subfields.map(sub => sub.code).indexOf('x') !== -1) {
    debug(' Source 830 has subfield x (ISSN), copying source 830 to base');
    record.insertField(field);
    return record;
  }
  // If source 830 does not have $x either, nothing is copied (Test 24)
  debug(' Source 830 has no ISSN, not adding it');
  return record;
}

function conditionallyCopyFields(record, candFields) {
  debug('Copy '+candFields.length+' fields?');
  candFields.forEach(field => conditionallyCopyField(record, field));
  return record;
}

export default () => (base, source) => {
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields
  // Test 27 (identical) and 29 (2x identical fields in different order)
  const nonIdenticalFields = getNonIdenticalFields(baseFields, sourceFields);
  return conditionallyCopyFields(base, nonIdenticalFields);
};
