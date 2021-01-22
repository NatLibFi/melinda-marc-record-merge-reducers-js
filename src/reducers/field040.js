import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';

import {
  getRepCodes,
  getNonRepCodes,
  compareAllSubfields,
  getRepSubs,
  getNonRepSubs,
  modifyBaseField,
  sortSubfields
} from './utils.js';

// Test 18: Copy new field from source to base record (case 1)
// Test 19: Copy subfields from source field to base field (case 2)

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^040$/u; // Tag in regexp format (for use in MarcRecord functions)
  const tagString = fieldTag.source.slice(1, 4); // Tag number as string
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields
  debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  // Get arrays of repeatable and non-repeatable subfield codes from melindaCustomMergeFields.json
  const repCodes = getRepCodes(tagString);
  const nonRepCodes = getNonRepCodes(tagString);

  // Since 040 is a non-repeatable field, there can be only one instance in both source and base
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  debug(`baseField: ${JSON.stringify(baseField, undefined, 2)}`);
  const [sourceField] = sourceFields;
  debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);

  // Run the function to get the base record to return
  return field040(base, tagString, baseField, sourceField, repCodes, nonRepCodes);

  function field040(base, tagString, baseField, sourceField, repCodes, nonRepCodes) {
    debug(`Working on field ${tagString}`);

    // In all cases, source $a value is copied to a new $d and $a is removed

    // ### tee tästä funktio, jolla yhden osakentän arvon voi siirtää toiseen
    // ### tsekkaa vielä sisältöihmisiltä oliko tämä nyt oikea tapa tehdä 040
    // Get string value of source $a
    const valueA = String(sourceField.subfields
      .filter(sub => sub.code === 'a')
        .map(sub => sub.value));
    // Add new $d with value of $a to source field
    sourceField.subfields.push({code: 'd', value: valueA});
    // Remove old $a completely (filter to new array without $a) and sort subfields
    const newSubs = sortSubfields(sourceField.subfields.filter(subfield => subfield.code !== 'a'));
    // Replace source subfields with new array
    // ###Changes to the destructured sourceField object are directly reflected in the sourceFields array(?)
    sourceField.subfields = newSubs;
    debug(`sourceField final: ${JSON.stringify(sourceField, undefined, 2)}`);
    debug(`sourceFields final: ${JSON.stringify(sourceFields, undefined, 2)}`);

    // Case 1: If field 040 is missing completely from Melinda, copy it from source as a new field
    if(baseFields.length === 0) {
      debug(`Missing field ${tagString} copied from source to Melinda`);
      sourceFields.forEach(f => base.insertField(f));
      return base;
    }

    // Case 2: If field 040 exists in Melinda, copy missing subfields from source



    // First check whether the values of identifying subfields are equal
    // 020: $a (ISBN)
    const idCodes = ['a'];

    // Case 1: If all identifying subfield values are not equal the entire source field is copied to base as a new field
    if (compareAllSubfields(baseField, sourceField, idCodes) === false) {
      //debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);
      base.insertField(sourceField);
      debug(`Base after copying: ${JSON.stringify(base, undefined, 2)}`);
      debug(`Field ${tagString}: One or more subfields (${idCodes}) not matching, source field copied as new field to Melinda`);
      return base; // Base record returned in case 1
    }

    // Case 2: If identifying subfield values are equal, continue with the merge process
    debug(`Field ${tagString}: Matching subfields (${idCodes}) found in source and Melinda, continuing with merge`);

    // If there are subfields to drop, define them first
    // 020: $c
    const dropCodes = ['c'];

    // Copy other subfields from source field to base field
    // For non-repeatable subfields, the value existing in base (Melinda) is preferred
    // Non-repeatable subfields are copied from source only if missing completely in base
    // 020: $a, $c, $6 (but $a was already checked and $c dropped, so only $6 is copied here)
    const nonRepSubsToCopy = getNonRepSubs(sourceField, nonRepCodes, dropCodes, idCodes);
    //debug(`nonRepSubsToCopy: ${JSON.stringify(nonRepSubsToCopy, undefined, 2)}`);

    // Repeatable subfields are copied if the value is different
    // 020: $q, $z, $8
    const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes, dropCodes, idCodes);
    //debug(`repSubsToCopy: ${JSON.stringify(repSubsToCopy, undefined, 2)}`);

    // Create modified base field and replace old base record in Melinda with it (exception to general rule of data immutability)
    // Subfields in the modified base field are arranged by default in alphabetical order (a-z, 0-9)
    // To use a different sorting order, set it as the second parameter in sortSubfields
    // Example: copy subfield sort order from source field
    // const orderFromSource = sourceField.subfields.map(subfield => subfield.code);

    const modifiedBaseField = JSON.parse(JSON.stringify(baseField));
    const sortedSubfields = sortSubfields([...baseField.subfields, ...nonRepSubsToCopy, ...repSubsToCopy]);
    /* eslint-disable functional/immutable-data */
    modifiedBaseField.subfields = sortedSubfields;
    modifyBaseField(base, baseField, modifiedBaseField);
    debug(`Base after modification: ${JSON.stringify(base, undefined, 2)}`);
    return base; // Base record returned in case 2
  }
};
