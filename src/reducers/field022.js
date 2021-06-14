import createDebugLogger from 'debug';

import {
  fieldToString
} from './utils.js';

// TODO: test where subfield order neeeds to be reset.
import {
  getCounterpart,
  mergeField
} from './mergeField.js';
/*
import {
  getNonIdenticalFields,
  compareAllSubfields,
  getRepSubs,
  getNonRepSubs,
  sortSubfields,
  makeNewBaseField
} from './utils.js';
*/

// Test 12: Copy new field from source to base record (case 1) (2x)
// Test 13: Copy subfields from source field to base field (case 2)
// Test 14: Both cases in the same record: copy a new field (case 1) and add subfields to an existing field (case 2)

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');


const fieldTag = /^022$/u; // Tag in regexp format (for use in MarcRecord functions)
/*
// Define repeatable and non-repeatable subfield codes
const repCodes = ['m', 'y', 'z', '8'];
const nonRepCodes = ['a', 'l', '2', '6'];
// First check whether the values of identifying subfields are equal
const idCodes = ['a'];

function mergeField022Step2(base, baseField, sourceField) {
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

function mergeField022(base, baseField, sourceField) {
  debug(`Working on field 022`);

  // Case 1: If all identifying subfield values are not equal the entire source field is copied to base as a new field
  if (compareAllSubfields(baseField, sourceField, idCodes) === false) {
    base.insertField(sourceField);
    idCodes.forEach(code => debug(`Subfield (${code}) not matching, source field copied as new field to base`));
    return base; // Base record returned in case 1
  }

  return mergeField022Step2(base, baseField, sourceField);
}
*/
function mergeOrAddField(record, field) {
  const counterpartField = getCounterpart(record, field);
  if (counterpartField) {
    debug(`Got counterpart: '${fieldToString(counterpartField)}'`);
    mergeField(record, counterpartField, field);
    return record;
  }
  // NB! Counterpartless field is inserted to 7XX even if field.tag says 1XX:
  debug(`No counterpart found for '${fieldToString(field)}'.`);
  return record.insertField(field);
}


export default () => (record, record2) => {
  const candidateFields = record2.get(fieldTag); // Get array of source fields
  candidateFields.forEach(candField => mergeOrAddField(record, candField));
  return record;
};

/*
export default () => (base, source) => {
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields

  const nonIdenticalFields = getNonIdenticalFields(baseFields, sourceFields);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  if (sourceFields.every(sourceField => baseFields.some(baseField => mergeField022(base, baseField, sourceField)))) {
    // No filtering needed here since mergeField022 does it in a customized way
    return base;
  }
};
*/