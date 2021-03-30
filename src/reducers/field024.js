import createDebugLogger from 'debug';

import {
  checkIdenticalness,
//  getRepCodes,
//  getNonRepCodes,
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
  debug(`### nonIdenticalFields: ${JSON.stringify(nonIdenticalFields, undefined, 2)}`);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  // Get arrays of repeatable and non-repeatable subfield codes from melindaCustomMergeFields.json
//  const repCodes = getRepCodes('024');
//  const nonRepCodes = getNonRepCodes('024');
    const repCodes= ['q', 'z', '8'];
    const nonRepCodes = ['a', 'c', 'd', '2'];

  function mergeField024(base, baseField, sourceField, repCodes, nonRepCodes) {
    debug(`Working on field 024`);
    // First check whether the values of identifying subfields are equal
    // 024: $a (ISSN)
    const idCodes = ['a'];

    // Case 1: If all identifying subfield values are not equal the entire source field is copied to base as a new field
    if (compareAllSubfields(baseField, sourceField, idCodes) === false) {
      //debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);
      base.insertField(sourceField);
      debug(`### Base after copying: ${JSON.stringify(base, undefined, 2)}`);
      idCodes.forEach(code => debug(`Subfield (${code}) not matching, source field copied as new field to base`));
      return base; // Base record returned in case 1
    }

    // Case 2: If identifying subfield values are equal, continue with the merge process
    idCodes.forEach(code => debug(`Matching subfield (${code}) found in source and base, continuing with merge`));

    // If there are subfields to drop, define them first
    // 024: No subfields to drop
    const dropCodes = [];

    // Copy other subfields from source field to base field
    // For non-repeatable subfields, the value existing in base (base) is preferred
    // Non-repeatable subfields are copied from source only if missing completely in base
    // 024: $a, $c, $d, $2
    const nonRepSubsToCopy = getNonRepSubs(sourceField, nonRepCodes, dropCodes, idCodes);
    //debug(`nonRepSubsToCopy: ${JSON.stringify(nonRepSubsToCopy, undefined, 2)}`);

    // Repeatable subfields are copied if the value is different
    // 024: $q, $z, $8
    const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes, dropCodes, idCodes);
    //debug(`repSubsToCopy: ${JSON.stringify(repSubsToCopy, undefined, 2)}`);

    // Create new base field to replace old one
    // Copy subfield sort order from source field
    const orderFromSource = sourceField.subfields.map(subfield => subfield.code);
    const sortedSubfields = sortSubfields([...baseField.subfields, ...nonRepSubsToCopy, ...repSubsToCopy], orderFromSource);
    return makeNewBaseField(base, baseField, sortedSubfields);
  }

  if (sourceFields.every(sourceField => baseFields.some(baseField => mergeField024(base, baseField, sourceField, repCodes, nonRepCodes)))) {
    // No filtering needed here since mergeField024 does it in a customized way
    debug(`### base returned from if loop: ${JSON.stringify(base, undefined, 2)}`);
    return base;
  }
};
