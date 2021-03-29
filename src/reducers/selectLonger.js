import createDebugLogger from 'debug';
import {
  checkIdenticalness,
  normalizeStringValue
} from './utils.js';

/**
 * These rules apply to fields:
 * Repeatable: 033, 034, 046, 257, 300
 * Non-repeatable: 039, 045
 * If source field is longer, replace base field with source field
 * Longer means fulfilling either (but not both) of these conditions:
 *   a) Source has more subfields than base
 * Or if source and base have the same number of subfields:
 *   b) Subfield values in source are supersets of subfield values in base
 * Test 01: 033 and 039: case a) (2x 033)
 * Test 02: 033 and 039: case b) (2x 033)
 * Test 03: 033 and 033: Two instances of the same repeatable field, one a) and one b)
 * Test 04: 033 and 033: Same as 03 but fields are in different order
 * Test 05: Identical 033 and 039 in source and base => keep base
 * Test 06: Same as 05 but fields in different order => keep base
 *  */

export default ({tagPattern}) => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(tagPattern);
  debug(`### baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  const sourceFields = source.get(tagPattern);
  debug(`### sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  // Test 05 and 06
  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);
  debug(`### nonIdenticalFields: ${JSON.stringify(nonIdenticalFields, undefined, 2)}`);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  // Run the function to get the base record to return
  return mergeLongerField();

  function mergeLongerField() {
    if (sourceFields.every(sourceField => baseFields.every(baseField => selectLongerField(baseField, sourceField)))) {
      return base;
    }
  }

  function selectLongerField(baseField, sourceField) {
    debug(`Comparing field ${baseField.tag}`);
    const baseSubs = baseField.subfields;
    const sourceSubs = sourceField.subfields;

    const baseSubsNormalized = baseSubs
      .map(({code, value}) => ({code, value: normalizeStringValue(value)}));

    const sourceSubsNormalized = sourceSubs
      .map(({code, value}) => ({code, value: normalizeStringValue(value)}));

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
      debug(`### base and source subfields are not equal`);
      debug(`No changes to base`);
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
    debug(`No changes to base`);
    return base;

    // Subset equality function from marc-record-merge select.js
    function subsetEquality(subfieldA, subfieldB) {
      return subfieldA.code === subfieldB.code &&
      (subfieldA.value.indexOf(subfieldB.value) !== -1 || subfieldB.value.indexOf(subfieldA.value) !== -1);
    }
    function replaceBasefieldWithSourcefield(base) {
      const index = base.fields.findIndex(field => field === baseField);
      base.fields.splice(index, 1, sourceField); // eslint-disable-line functional/immutable-data
      debug(`Source field ${sourceField.tag} is longer, replacing base field with source field`);
      return base;
    }
  } // selectLongerField end
}; // export default end
