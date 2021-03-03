import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';

import {
  checkIdenticalness,
  getRepCodes,
  getNonRepCodes,
  compareAllSubfields,
  getRepSubs,
  getNonRepSubs,
  modifyBaseField,
  sortSubfields
} from './utils.js';

// Test 31: Identical fields in source and base => keep base

// ### Keskeneräinen

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^245$/u); // Get array of base fields
  debug(`### baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  const sourceFields = source.get(/^245$/u); // Get array of source fields
  debug(`### sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  if (checkIdenticalness(baseFields, sourceFields) === true) {
    return base;
  }

  // Get arrays of repeatable and non-repeatable subfield codes from melindaCustomMergeFields.json
  const repCodes = getRepCodes('245');
  const nonRepCodes = getNonRepCodes('245');

  // If there are multiple instances of the field in source and/or base
  if (sourceFields.length > 1 || baseFields.length > 1) {
    // Iterate through all fields in base and source arrays
    const outerLoop = sourceFields.map(sourceField => {
      const innerLoop = baseFields.map(baseField => getField245(base, baseField, sourceField, repCodes, nonRepCodes));
      // Destructure array returned by innerLoop into object to pass to outerLoop
      const [tempObj] = innerLoop;
      return tempObj;
    });
    // The outer loop returns an array with as many duplicate objects as there are fields
    // Filter out duplicates and return only one result object in MarcRecord format
    const stringified = outerLoop.map(obj => JSON.stringify(obj));
    const filtered = JSON.parse(stringified.filter((item, index) => stringified.indexOf(item) >= index));
    return new MarcRecord(filtered);
  }

  // Default case: there is just one instance of the field in both source and base
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // Run the function to get the base record to return
  return getField245(base, baseField, sourceField, repCodes, nonRepCodes);

  /*
  basessa jo olevaa kenttää suositaan. Yhdistely:
  Tärkeitä: a, b, n, p (jos ovat erilaiset, ei saa yhdistää, ks. johdanto normalisointi)
  SS: Siis jos mikä tahansa näistä osakentistä on tulevan tietueen kentässä erilainen,
  pidetään basessa oleva kenttä 245 sellaisenaan?
  Jos nämä osakentät ovat samat ja sisääntuleva tietue on täydellisempi
  (enemmän osakenttiä tai pidemmät osakenttien arvot),
  korvataanko silloin basen kenttä 245 sisääntulevan tietueen kentällä 245?
  Paitsi että otetaan basesta 2. indikaattorin arvo?
  Tulevan tietueen 245-kentän 2. indikaattorin arvo häviää basessa jo olevan tietueen 2. indikaattorin arvolle.
  */


  function getField245(base, baseField, sourceField, repCodes, nonRepCodes) {
    debug(`Working on field 245`);
    return base;
    // First check whether the values of identifying subfields are equal
    //const idCodes = ['a'];

    // Case 1: If all identifying subfield values are not equal the entire source field is copied to base as a new field
    /*if (compareAllSubfields(baseField, sourceField, idCodes) === false) {
      //debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);
      base.insertField(sourceField);
      debug(`Base after copying: ${JSON.stringify(base, undefined, 2)}`);
      debug(`One or more subfields (${idCodes}) not matching, source field copied as new field to base`);
      return base; // Base record returned in case 1
    }

    // Case 2: If identifying subfield values are equal, continue with the merge process
    debug(`Matching subfields (${idCodes}) found in source and base, continuing with merge`);

    // If there are subfields to drop, define them first
    const dropCodes = ['c'];

    // Copy other subfields from source field to base field
    // For non-repeatable subfields, the value existing in base (base) is preferred
    // Non-repeatable subfields are copied from source only if missing completely in base
    const nonRepSubsToCopy = getNonRepSubs(sourceField, nonRepCodes, dropCodes, idCodes);
    //debug(`nonRepSubsToCopy: ${JSON.stringify(nonRepSubsToCopy, undefined, 2)}`);

    // Repeatable subfields are copied if the value is different
    const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes, dropCodes, idCodes);
    //debug(`repSubsToCopy: ${JSON.stringify(repSubsToCopy, undefined, 2)}`);

    // Create modified base field and replace old base record in base with it
    // Copy subfield sort order from source field
    const orderFromSource = sourceField.subfields.map(subfield => subfield.code);
    debug(`orderFromSource: ${JSON.stringify(orderFromSource, undefined, 2)}`);
    const modifiedBaseField = JSON.parse(JSON.stringify(baseField));
    const sortedSubfields = sortSubfields([...baseField.subfields, ...nonRepSubsToCopy, ...repSubsToCopy], orderFromSource);
    /* eslint-disable functional/immutable-data */
    /*modifiedBaseField.subfields = sortedSubfields;
    modifyBaseField(base, baseField, modifiedBaseField);
    debug(`Base after modification: ${JSON.stringify(base, undefined, 2)}`);
    return base; // Base record returned in case 2*/
  }
};
