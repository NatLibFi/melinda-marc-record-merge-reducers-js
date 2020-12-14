import createDebugLogger from 'debug';
import cloneDeep from 'lodash';
//import {createValidator} from './validate.js';

import {normalizeSubfields, normalizeSubfieldValue, getFieldSpecs, compareSubfields, modifyBaseField} from './utils.js';

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^020$/);
  const sourceFields = source.get(/^020$/);

  /*const validator = await createValidator();
  const validationResults = await validator(source, true, true);
  debug(`validationResults: ${JSON.stringify(validationResults, undefined, 2)}`);*/

  // Since the arrays contain only one field at a time, they can be destructured into objects
  const [baseField] = baseFields;
  debug(`baseField: ${JSON.stringify(baseField, undefined, 2)}`);
  const [sourceField] = sourceFields;
  debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);

  // Get field specs from melindaCustomMergeFields.json
  const fieldSpecs = getFieldSpecs(baseField.tag);
  debug(`fieldSpecs: ${JSON.stringify(fieldSpecs, undefined, 2)}`);
  // Get arrays of repeatable and non-repeatable subfield codes from field specs
  const repCodes = fieldSpecs.subfields.filter(sub => sub.repeatable === "true").map(sub => sub.code);
  debug(`repCodes: ${JSON.stringify(repCodes, undefined, 2)}`);
  const nonRepCodes = fieldSpecs.subfields.filter(sub => sub.repeatable === "false").map(sub => sub.code);
  debug(`nonRepCodes: ${JSON.stringify(nonRepCodes, undefined, 2)}`);

  // Normalize subfield values for comparison
  const baseSubsNormalized = normalizeSubfields(baseField);
  debug(`baseSubsNormalized: ${JSON.stringify(baseSubsNormalized, undefined, 2)}`);
  const sourceSubsNormalized = normalizeSubfields(sourceField);
  debug(`sourceSubsNormalized: ${JSON.stringify(sourceSubsNormalized, undefined, 2)}`);

  // First check whether the values of identifying subfields are equal
  // Identifying subfields define the uniqueness of the record: if they are different, the records cannot be merged
  // 020: $a (ISBN)
  const idCodes = ["a"];

  // Test 09: If values are not equal, fields do not match and records are not merged at all
  if (compareSubfields(baseField, sourceField, idCodes) === false) {
    debug(`Field ${baseField.tag}: One or more subfields (${idCodes}) not matching in base and source, records not merged`);
    return base;
  }
  // If values are equal, continue with the merge process
  debug(`Field ${baseField.tag}: Matching subfields (${idCodes}) found in source and base, continuing with merge`);

  // Test 10: If values of identifying subfields are equal, copy other subfields from source field to base field
  // - If there are subfields to drop, do that first (020: $c)
  // - non-repeatable subfields are copied only if missing from base
  // (020: $a, $c, $6 --> but $a was already checked and $c dropped, so only $6 copied here)
  // - repeatable subfields are copied as additional instances (020: $q, $z, $8)
  // Create modified base field and replace old base record in Melinda with it (exception to general rule of data immutability)

  const dropCodes = ["c"];
  // It doesn't matter whether dropCodes or idCodes are repeatable or not:
  // Both cases are checked and if these subs are found, they are not copied

  const nonreps = getNonRepSubsToCopy(sourceField, nonRepCodes, dropCodes, idCodes);
  debug(`getNonRepSubsToCopy: ${JSON.stringify(getNonRepSubsToCopy(sourceField, nonRepCodes, dropCodes, idCodes), undefined, 2)}`);

  // Non-repeatable subfields to copy: filter out dropped and identifying subfields
  function getNonRepSubsToCopy(sourceField, nonRepCodes, dropCodes, idCodes) {
    const nonRepSubsToCopy = sourceField.subfields
    .filter(subfield => nonRepCodes
      .filter(code => (dropCodes.indexOf(code) === -1) && (idCodes.indexOf(code) === -1)).indexOf(subfield.code) !== -1);
    return nonRepSubsToCopy;
  }

  const reps = getRepSubsToCopy(sourceField, repCodes, dropCodes, idCodes);
  debug(`getRepSubsToCopy: ${JSON.stringify(getRepSubsToCopy(sourceField, repCodes, dropCodes, idCodes), undefined, 2)}`);

  // Repeatable subfields to copy: first filter out dropped and identifying subfields
  function getRepSubsToCopy(sourceField, repCodes, dropCodes, idCodes) {
    const repSubsToCopy = sourceField.subfields
    .filter(subfield => repCodes
      .filter(code => (dropCodes.indexOf(code) === -1) && (idCodes.indexOf(code) === -1)).indexOf(subfield.code) !== -1);
    return repSubsToCopy;
  }

  // Then filter out duplicates already existing in base

  /*const repSubsBase = baseField.subfields.filter(subfield => repCodes
    .filter(code => (dropCodes.indexOf(code) === -1) && (idCodes.indexOf(code) === -1)).indexOf(subfield.code) !== -1);
  debug(`repSubsBase: ${JSON.stringify(repSubsBase, undefined, 2)}`);*/

  /*const nonRepSubsToCopyNormalized = getNonRepSubsToCopy(sourceField, nonRepCodes, dropCodes, idCodes)
  .map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}));
  debug(`nonRepSubsToCopyNormalized: ${JSON.stringify(nonRepSubsToCopyNormalized, undefined, 2)}`);*/

  const repSubsToCopyNormalized = getRepSubsToCopy(sourceField, repCodes, dropCodes, idCodes)
  .map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}));
  debug(`repSubsToCopyNormalized: ${JSON.stringify(repSubsToCopyNormalized, undefined, 2)}`);

  function strictEquality(subfieldA, subfieldB) {
    return subfieldA.code === subfieldB.code &&
    subfieldA.value === subfieldB.value;
  }

  // Returns the base subfields for which a matching source subfield (repSubsToCopyNormalized) is found
  const duplicateRepSubsBase = baseSubsNormalized
    .filter(baseSubfield => repSubsToCopyNormalized
      .some(sourceSubfield => strictEquality(baseSubfield, sourceSubfield)));
  debug(`Match in source found for normalized base subfield: ${JSON.stringify(duplicateRepSubsBase, undefined, 2)}`);

  // Returns the source (repSubsToCopyNormalized) subfields for which a matching base subfield is found
  const duplicateRepSubsSource = repSubsToCopyNormalized
    .filter(sourceSubfield => baseSubsNormalized
      .some(baseSubfield => strictEquality(sourceSubfield, baseSubfield)));
  debug(`Match in base found for normalized source subfield: ${JSON.stringify(duplicateRepSubsSource, undefined, 2)}`);

  // Get non-duplicate repeatable subfields from source
  const nonDupRepSubsToCopy = repSubsToCopyNormalized
    .filter(sub => duplicateRepSubsSource
        .map(sub => sub.value).indexOf(sub.value) === -1);
  debug(`nonDupRepSubsToCopy: ${JSON.stringify(nonDupRepSubsToCopy, undefined, 2)}`);
  // Normalized subfield values have to be used for comparison
  // But how to get the non-normalized values back at this point for the subfields that will be copied to base? (nonDupRepSubsToCopy)

  // Create a modified version of base, add the subfields there and replace original base with modified base
  // Koska marc-recordiin ei voi lisätä pelkkiä subfieldejä, pitää lisätä kokonainen field (record.insertField)
  const modifiedBaseField = cloneDeep(baseField);
  debug(`modifiedBaseField: ${JSON.stringify(modifiedBaseField, undefined, 2)}`);
  //modifiedBaseField.subfields.push(nonreps, reps);
  debug(`baseField.subfields: ${JSON.stringify(baseField.subfields, undefined, 2)}`);
  // miksi tästä tulee undefined vaikka pitäisi tulla sama kuin baseField.subfields?
  debug(`modifiedBaseField.subfields: ${JSON.stringify(modifiedBaseField.subfields, undefined, 2)}`);

  //modifyBaseField(base, baseField, modifiedBaseField);

  return base; // testing
}
