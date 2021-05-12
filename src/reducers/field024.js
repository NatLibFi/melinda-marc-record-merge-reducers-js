import createDebugLogger from 'debug';

import {
  checkIdenticalness,
  compareAllSubfields,
  getRepSubs,
  getNonRepSubs,
  sortSubfields,
  makeNewBaseField
} from './utils.js';

// Test 15: Copy new field from source to base record (case 1) (2x)
// Test 16: Copy subfields from source field to base field (case 2)
// Test 17: Both cases in the same record: copy a new field (case 1) and add subfields to an existing field (case 2)

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^024$/u; // Tag in regexp format (for use in MarcRecord functions)
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields

  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  // Define repeatable and non-repeatable subfield codes
  const repCodes = ['q', 'z', '8'];
  const nonRepCodes = ['a', 'c', 'd', '2'];

  function mergeField024(base, baseField, sourceField, repCodes, nonRepCodes) {
    debug(`Working on field 024`);
    // First check whether the values of identifying subfields are equal
    const idCodes = ['a'];

    // Case 1: If all identifying subfield values are not equal the entire source field is copied to base as a new field
    if (compareAllSubfields(baseField, sourceField, idCodes) === false) {
      base.insertField(sourceField);
      idCodes.forEach(code => debug(`Subfield (${code}) not matching, source field copied as new field to base`));
      return base; // Base record returned in case 1
    }

    // Case 2: If identifying subfield values are equal, continue with the merge process
    idCodes.forEach(code => debug(`Matching subfield (${code}) found in source and base, continuing with merge`));

    // Copy other subfields from source field to base field
    // For non-repeatable subfields, the value existing in base (base) is preferred
    // Non-repeatable subfields are copied from source only if missing completely in base
    const nonRepSubsToCopy = getNonRepSubs(sourceField, nonRepCodes, idCodes);

    // Repeatable subfields are copied if the value is different
    const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes, idCodes);

    // Create new base field to replace old one
    // Copy subfield sort order from source field
    const orderFromSource = sourceField.subfields.map(subfield => subfield.code);
    const sortedSubfields = sortSubfields([...baseField.subfields, ...nonRepSubsToCopy, ...repSubsToCopy], orderFromSource);
    return makeNewBaseField(base, baseField, sortedSubfields);
  }

  if (sourceFields.every(sourceField => baseFields.some(baseField => mergeField024(base, baseField, sourceField, repCodes, nonRepCodes)))) {
    // No filtering needed here since mergeField024 does it in a customized way
    return base;
  }
};
