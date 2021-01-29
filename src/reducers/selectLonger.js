import createDebugLogger from 'debug';
import {MarcRecord} from '@natlibfi/marc-record';
import {normalizeSubfieldValue} from './utils.js';

// These rules apply to fields:
// Repeatable: 033, 034, 046, 257, 300
// Non-repeatable: 039, 045
// If source field is longer, replace Melinda field with source field
// Longer means fulfilling either (but not both) of these conditions:
// a) Subfield values in source are supersets of subfield values Melinda
// b) Source has more subfields than Melinda
// Test 01: 033 and 039: case a)
// Test 02: 033 and 039: case b)
// Test 03: 033 and 033: Two instances of the same repeatable field, one a) and one b)
// Test 04: 033 and 033: Same as 03 but fields are in different order

const fieldTags = /^(?<tags>033|034|039|045|046|257|300)$/u;

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(fieldTags);
  debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  const sourceFields = source.get(fieldTags);
  debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  // If there are multiple instances of the field in source and/or base
  if (sourceFields.length > 1 || baseFields.length > 1) {
    // Iterate through all fields in base and source arrays
    const outerLoop = sourceFields.map(sourceField => {
      const innerLoop = baseFields.map(baseField => selectLongerField(baseField, sourceField));
      // Destructure array returned by innerLoop into object to pass to outerLoop
      const [tempObj] = innerLoop;
      return tempObj;
    });
    // The outer loop returns an array with as many duplicate objects as there are fields
    // Filter out duplicates and return only one result object in MarcRecord format
    const stringified = outerLoop.map(obj => JSON.stringify(obj));
    //debug(`stringified: ${JSON.stringify(stringified, undefined, 2)}`);
    const filtered = JSON.parse(stringified.filter((item, index) => stringified.indexOf(item) >= index));
    debug(`filtered: ${JSON.stringify(filtered, undefined, 2)}`);
    return new MarcRecord(filtered);
  }

  // Default case: there is just one instance of the field in both source and base
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // Run the function to get the base record to return
  return selectLongerField(baseField, sourceField);

  function selectLongerField(baseField, sourceField) {
    if (baseField.tag === sourceField.tag === false) {
      //debug(`Base tag ${baseField.tag} is not equal to source tag ${sourceField.tag}`);
      //debug(`No changes to base`);
      return base;
    }
    debug(`Comparing field ${baseField.tag}`);
    const baseSubs = baseField.subfields;
    const sourceSubs = sourceField.subfields;

    const baseSubsNormalized = baseSubs
      .map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}));

    const sourceSubsNormalized = sourceSubs
      .map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}));

    // Returns the base subfields for which a matching source subfield is found
    const equalSubfieldsBase = baseSubsNormalized
      .filter(baseSubfield => sourceSubsNormalized
        .some(sourceSubfield => subsetEquality(baseSubfield, sourceSubfield)));
    //debug(`equalSubfieldsBase: ${JSON.stringify(equalSubfieldsBase, undefined, 2)}`);

    // Returns the source subfields for which a matching base subfield is found
    const equalSubfieldsSource = sourceSubsNormalized
      .filter(sourceSubfield => baseSubsNormalized
        .some(baseSubfield => subsetEquality(sourceSubfield, baseSubfield)));
    //debug(`equalSubfieldsSource: ${JSON.stringify(equalSubfieldsSource, undefined, 2)}`);

    if (baseSubs.length === sourceSubs.length && equalSubfieldsBase.length < baseSubs.length) {
      debug(`Melinda and source subfields are not equal`);
      debug(`No changes to Melinda`);
      return base;
    }

    if (baseSubs.length === sourceSubs.length && equalSubfieldsBase.length === equalSubfieldsSource.length) {
      debug(`Checking subfield equality`);
      const totalSubfieldLengthBase = baseSubsNormalized
        .map(({value}) => value.length)
        .reduce((acc, value) => acc + value);
      const totalSubfieldLengthSource = sourceSubsNormalized
        .map(({value}) => value.length)
        .reduce((acc, value) => acc + value);

      if (totalSubfieldLengthSource > totalSubfieldLengthBase) {
        return replaceBasefieldWithSourcefield(base);
      }
    }

    if (sourceSubs.length > baseSubs.length && equalSubfieldsBase.length === baseSubs.length) {
      return replaceBasefieldWithSourcefield(base);
    }

    debug(`No changes to Melinda`);
    return base;

    // Subset equality function from marc-record-merge select reducer
    function subsetEquality(subfieldA, subfieldB) {
      return subfieldA.code === subfieldB.code &&
      (subfieldA.value.indexOf(subfieldB.value) !== -1 || subfieldB.value.indexOf(subfieldA.value) !== -1);
    }
    function replaceBasefieldWithSourcefield(base) {
      const index = base.fields.findIndex(field => field === baseField);
      base.fields.splice(index, 1, sourceField); // eslint-disable-line functional/immutable-data
      debug(`Source field ${sourceField.tag} is longer, replacing Melinda field with source field`);
      return base;
    }

  } // selectLongerField end
}; // export default end
