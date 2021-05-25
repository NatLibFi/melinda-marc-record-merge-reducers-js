import createDebugLogger from 'debug';

import {
  checkIdenticalness,
  compareAllSubfields
} from './utils.js';

/**
 * Oikeastaan 995 ei enää tarvitse omaa kenttäspesifistä reduceria,
 * koska se muutettiin toistettavaksi ja erilaiset toistumat kopioidaan
 * omina kenttinään, eli se menee normaalin copyn mukaisesti.
 * Jätetään tämä tänne vielä toistaiseksi, jos 995:n käsittelyyn halutaankin
 * vielä jatkossa jotain kustomointia.
*/

// Test 30: Base has one $a, source has 2x different $a
// Test 31: Identical field 995 in source and base => keep base
// Test 32: Two base 995 fields in base, two different ones in source

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
const fieldTag = /^995$/u; // Tag in regexp format (for use in MarcRecord functions)

export default () => (base, source) => {
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields

  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  function mergeField995(base, baseField, sourceField) {
    debug(`Working on field 995`);
    // 995 has two subfields, $a and $5
    const subCodes = ['a', '5'];
    // If all subfield values are not equal, the entire source field is copied to base as a new field
    if (compareAllSubfields(baseField, sourceField, subCodes) === false) {
      base.insertField(sourceField);
      subCodes.forEach(code => debug(`Subfield (${code}) not matching, source field copied as new field to base`));
      return base;
    }
  }
  if (sourceFields.every(sourceField => baseFields.some(baseField => mergeField995(base, baseField, sourceField)))) {
    // No filtering needed here since mergeField995 does it in a customized way
    return base;
  }
};




