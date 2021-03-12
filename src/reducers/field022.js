import createDebugLogger from 'debug';

import {
  checkIdenticalness,
  getRepCodes,
  getNonRepCodes,
  compareAllSubfields,
  getRepSubs,
  getNonRepSubs,
  sortSubfields
} from './utils.js';

// Test 12: Copy new field from source to base record (case 1) (2x)
// Test 13: Copy subfields from source field to base field (case 2)
// Test 14: Both cases in the same record: copy a new field (case 1) and add subfields to an existing field (case 2)

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^022$/u; // Tag in regexp format (for use in MarcRecord functions)
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields

  if (checkIdenticalness(baseFields, sourceFields) === true) {
    return base;
  }

  // Get arrays of repeatable and non-repeatable subfield codes from melindaCustomMergeFields.json
  const repCodes = getRepCodes('022');
  const nonRepCodes = getNonRepCodes('022');

  function mergeField022(base, baseField, sourceField, repCodes, nonRepCodes) {
    debug(`Working on field 022`);
    // First check whether the values of identifying subfields are equal
    // 022: $a (ISSN)
    const idCodes = ['a'];

    // Case 1: If all identifying subfield values are not equal the entire source field is copied to base as a new field
    if (compareAllSubfields(baseField, sourceField, idCodes) === false) {
      base.insertField(sourceField);
      debug(`### Base after copying: ${JSON.stringify(base, undefined, 2)}`);
      idCodes.forEach(code => debug(`Subfield (${code}) not matching, source field copied as new field to base`));
      return base; // Base record returned in case 1
    }

    // Case 2: If identifying subfield values are equal, continue with the merge process
    idCodes.forEach(code => debug(`Matching subfield (${code}) found in source and base, continuing with merge`));

    // If there are subfields to drop, define them first
    // 022: No subfields to drop
    const dropCodes = [];

    // Copy other subfields from source field to base field
    // For non-repeatable subfields, the value existing in base (base) is preferred
    // Non-repeatable subfields are copied from source only if missing completely in base
    // 022: $a, $l, $2, $6
    const nonRepSubsToCopy = getNonRepSubs(sourceField, nonRepCodes, dropCodes, idCodes);

    // Repeatable subfields are copied if the value is different
    // 022: $m, $y, $z, $8
    const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes, dropCodes, idCodes);

    // Create new base field to replace old one
    // Copy subfield sort order from source field
    const orderFromSource = sourceField.subfields.map(subfield => subfield.code);
    //debug(`### orderFromSource: ${JSON.stringify(orderFromSource, undefined, 2)}`);
    const newBaseField = JSON.parse(JSON.stringify(baseField));
    const sortedSubfields = sortSubfields([...baseField.subfields, ...nonRepSubsToCopy, ...repSubsToCopy], orderFromSource);
    newBaseField.subfields = sortedSubfields;
    // ### Tarvitaanko tähän eslint-disable?
    /* eslint-disable */
    base.removeField(baseField); // remove old baseField
    /** ### Test 14: Tässä vaiheessa kenttien järjestys muuttuu: vanha base poistetaan,
     * joten ylimmäksi nousee ekalla iteraatiokierroksella sourcesta kopioitu ensimmäinen uusi kenttä.
     * Uusi base (newBaseField) muodostetaan mergettämällä vanha base ja sourcen toinen kenttä,
     * ja se lisätään vasta ekan kopioidun kentän perään.
     * Viimeiseksi lisätään kolmannella kierroksella sourcesta toinen uusi kenttä.
     * Onko kenttien järjestyksen muuttuminen ongelma?
     * */
    debug(`### Base after removing old baseField: ${JSON.stringify(base, undefined, 2)}`);
    base.insertField(newBaseField); // insert newBaseField
    debug(`### Base after inserting newBaseField: ${JSON.stringify(base, undefined, 2)}`);
    /* eslint-enable */
    return base; // Base returned in case 2
  }

  if (sourceFields.every(sourceField => baseFields.some(baseField => mergeField022(base, baseField, sourceField, repCodes, nonRepCodes)))) {
    // No filtering needed here since mergeField022 does it in a customized way
    debug(`### base returned from if loop: ${JSON.stringify(base, undefined, 2)}`);
    return base;
  }
};
