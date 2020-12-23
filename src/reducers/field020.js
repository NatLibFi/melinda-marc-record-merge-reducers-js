import createDebugLogger from 'debug';

import {
  getFieldSpecs,
  getRepCodes,
  getNonRepCodes,
  compareAllSubfields,
  getNonRepSubs,
  getRepSubs,
  modifyBaseField,
  sortSubfields
} from './utils.js';

// Tee: toiminto jolla otetaan alkuperäisen kentän subfieldit järjestyksessä arrayihin

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^020$/; // update this for each field
  const tagString = fieldTag.source.slice(1, 4);
  const baseFields = base.get(fieldTag);
  debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  const sourceFields = source.get(fieldTag);
  debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  // Get arrays of repeatable and non-repeatable subfield codes from melindaCustomMergeFields.json
  const repCodes = getRepCodes(tagString);
  debug(`repCodes: ${JSON.stringify(repCodes, undefined, 2)}`);
  const nonRepCodes = getNonRepCodes(tagString);
  debug(`nonRepCodes: ${JSON.stringify(nonRepCodes, undefined, 2)}`);

  // For repeatable fields:
  // Loop through all source and base fields
  // ###Tämän pitää palauttaa lopuksi muokattu base, joka vastaa merged.jsonia
  const result = sourceFields.forEach(sourceField => {
    debug(`in sourceFields loop`);
    baseFields.forEach(baseField => {
      debug(`in baseFields loop`);
      debug(`baseField: ${JSON.stringify(baseField, undefined, 2)}`);
      debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);

      // First check whether the values of identifying subfields are equal
      // Identifying subfields define the uniqueness of the record
      // If they are different, the records cannot be merged
      // 020: $a (ISBN)
      const idCodes = ["a"];

      // Test 09: If identifying subfield values are not equal, source field is copied to base
      // Ei saisi olla return base jo tässä vaiheessa?
      if (compareAllSubfields(baseField, sourceField, idCodes) === false) {
        // Check that the field is repeatable, if not, no changes are made
        if (getFieldSpecs(tagString).repeatable === "false") {
          debug(`Field ${baseField.tag}: One or more subfields (${idCodes}) not matching, original field retained in Melinda`);
          return base;
        }
        // Copy repeatable source field to Melinda
        debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);
        // ### Tässä kohtaa pitää tarkistaa, ettei yllä olevaa sourceFieldiä ole jo lisätty baseen edellisellä kierroksella
        // vrt. test 09, jossa on basessa 2 erilaista ja sourcessa 2 erilaista 020-kenttää
        // ekalla kierroksella verrataan kumpaakin basen kenttää sourcen ekaan kenttään --> erilaisia
        // tokalla kierroksella verrataan kumpaakin basen kenttää sourcen tokaan kenttään --> erilaisia
        // lopputuloksena sourcen molemmat kentät kopsataan baseen kummallakin kierroksella
        // --> basessa on 2 alkuperäistä 020-kenttää ja 2x kumpaakin sourcesta tullutta 020-kenttää
        // ### Toimisiko copyn filterMissingin perusteella?

        base.insertField(sourceField);
        debug(`base after copy: ${JSON.stringify(base, undefined, 2)}`);
        debug(`Field ${baseField.tag}: One or more subfields (${idCodes}) not matching, source copied as new field to Melinda`);
        return base;
      }

      // If identifying subfield values are equal, continue with the merge process
      debug(`Field ${baseField.tag}: Matching subfields (${idCodes}) found in source and Melinda, continuing with merge`);

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
      return base;
    });
  });
  debug(`result: ${JSON.stringify(result, undefined, 2)}`);
  return result;
}

