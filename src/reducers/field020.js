import createDebugLogger from 'debug';

import {
  getFieldSpecs,
  compareAllSubfields,
  getNonRepSubs,
  getRepSubs,
  modifyBaseField,
  sortSubfields
} from './utils.js';

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^020$/);
  const sourceFields = source.get(/^020$/);

  // Since the arrays contain only one field at a time, they can be destructured into objects
  const [baseField] = baseFields;
  debug(`baseField: ${JSON.stringify(baseField, undefined, 2)}`);
  const [sourceField] = sourceFields;
  debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);

  // Get arrays of repeatable and non-repeatable subfield codes from melindaCustomMergeFields.json
  const repCodes = getFieldSpecs(baseField.tag).subfields
    .filter(sub => sub.repeatable === "true")
    .map(sub => sub.code);
  debug(`repCodes: ${JSON.stringify(repCodes, undefined, 2)}`);
  const nonRepCodes = getFieldSpecs(baseField.tag).subfields
    .filter(sub => sub.repeatable === "false")
    .map(sub => sub.code);
  debug(`nonRepCodes: ${JSON.stringify(nonRepCodes, undefined, 2)}`);

  // First check whether the values of identifying subfields are equal
  // Identifying subfields define the uniqueness of the record
  // If they are different, the records cannot be merged
  // 020: $a (ISBN)
  const idCodes = ["a"];

  // Test 09: If values are not equal, fields do not match and records are not merged at all
  if (compareAllSubfields(baseField, sourceField, idCodes) === false) {
    debug(`Field ${baseField.tag}: One or more subfields (${idCodes}) not matching in base and source, records not merged`);
    return base;
  }
  // If values are equal, continue with the merge process
  debug(`Field ${baseField.tag}: Matching subfields (${idCodes}) found in source and base, continuing with merge`);

  // Test 10:
  // If values of identifying subfields are equal, copy other subfields from source field to base field
  // If there are subfields to drop, do that first (020: $c)
  const dropCodes = ["c"];

  // Non-repeatable subfields are copied only if missing from base
  // 020: $a, $c, $6 (but $a was already checked and $c dropped, so only $6 is copied here)
  const nonRepSubsToCopy = getNonRepSubs(sourceField, nonRepCodes, dropCodes, idCodes);
  debug(`nonRepSubsToCopy: ${JSON.stringify(nonRepSubsToCopy, undefined, 2)}`);

  // Repeatable subfields are copied if the value is different
  // 020: $q, $z, $8
  const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes, dropCodes, idCodes);
  debug(`repSubsToCopy: ${JSON.stringify(repSubsToCopy, undefined, 2)}`);

  // Create modified base field and replace old base record in Melinda with it (exception to general rule of data immutability)
  // Subfields in the modified base field are arranged in alphabetical order (a-z, 0-9)
  // This does not always correspond to correct MARC order
  const modifiedBaseField = JSON.parse(JSON.stringify(baseField));
  const sortedSubfields = sortSubfields([...baseField.subfields, ...nonRepSubsToCopy, ...repSubsToCopy]);
  modifiedBaseField.subfields = sortedSubfields;
  debug(`modifiedBaseField.subfields: ${JSON.stringify(modifiedBaseField.subfields, undefined, 2)}`);
  modifyBaseField(base, baseField, modifiedBaseField);

  // Toiminto jolla otetaan alkuperäisen kentän subfieldit järjestyksessä arrayihin

  return base;
}

// Entä kun kenttä 020 on toistettava, miten otetaan huomioon useampi kpl samaa kenttää samassa tietueessa?
// Tännekin samantyyppinen compareTagsOnly-toiminto kuin copyssä, kun on toistettavia ja ei-toistettavia kenttiä?
// Uusi testi jossa on useampi 020

