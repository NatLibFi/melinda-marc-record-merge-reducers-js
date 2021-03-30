import createDebugLogger from 'debug';

import {
  checkIdenticalness,
  getRepSubs,
  makeNewBaseField,
  sortSubfields
} from './utils.js';

// Test 30: Base has one $a, source has 2x different $a
// Test 31: Identical field 995 in source and base => keep base

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^995$/u; // Tag in regexp format (for use in MarcRecord functions)
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields

  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);
  debug(`### nonIdenticalFields: ${JSON.stringify(nonIdenticalFields, undefined, 2)}`);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  // Field 995 is non-repeatable
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  debug(`Working on field 995`);

  // Repeatable subfields are copied if the value is different
  // 995 has only one subfield, $a, which is repeatable
  const repSubsToCopy = getRepSubs(baseField, sourceField, ['a']);

  // Create new base field to replace old one
  // Copy subfield sort order from source field
  const orderFromSource = sourceField.subfields.map(subfield => subfield.code);
  const sortedSubfields = sortSubfields([...baseField.subfields, ...repSubsToCopy], orderFromSource);
  return makeNewBaseField(base, baseField, sortedSubfields);
};
