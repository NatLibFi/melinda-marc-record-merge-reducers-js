import createDebugLogger from 'debug';

import {
  checkIdenticalness,
  getRepSubs,
  modifyBaseField,
  sortSubfields
} from './utils.js';

// Test 30: Base has one $a, source has 2x different $a
// Test 31: Identical field 995 in source and base => keep base

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^995$/u; // Tag in regexp format (for use in MarcRecord functions)
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields

  if (checkIdenticalness(baseFields, sourceFields) === true) {
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

  // Create modified base field and replace old base record in base with it
  // Copy subfield sort order from source field
  const orderFromSource = sourceField.subfields.map(subfield => subfield.code);
  const modifiedBaseField = JSON.parse(JSON.stringify(baseField));
  const sortedSubfields = sortSubfields([...baseField.subfields, ...repSubsToCopy], orderFromSource);
  /* eslint-disable functional/immutable-data */
  modifiedBaseField.subfields = sortedSubfields;
  modifyBaseField(base, baseField, modifiedBaseField);
  debug(`### Base after modification: ${JSON.stringify(base, undefined, 2)}`);
  return base;
};
