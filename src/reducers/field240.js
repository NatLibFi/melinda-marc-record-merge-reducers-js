import createDebugLogger from 'debug';
import { mergeOrAddField } from './mergeField.js';
import {
  getNonIdenticalFields, copyFields, selectLongerField, sortSubfields
} from './utils.js';

//### 240-kenttä tuodaan ei-preferoitavasta tietueesta vain, jos preferoitavassa tietueessa ei ole 240-kenttää tai 130-kenttää.
//### Jos molemmissa tietuesissa on 240-kenttä, ja ne ovat samat, voidaan preferoitavan tietueen 240-kenttää täydentää ei-preferoitavan kentän täydentävillä osakentillä.

// Field 240 is non-repeatable
// Test 34: Base contains 130 => keep base 240
// Test 35: Base does not contain 240 or 130 => copy 240 from source
// Note: Test base has dummy 010 because if fields = [], it is not recognized as a valid MarcRecord object
// Test 36: Base contains different 240 => keep base
// Test 37: Base 240 is subset of source 240 => copy 240 from source
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

const fieldTag = /^240$/u; // Tag "name" must be a regexp in MarcRecord.get()

function mergeField240(base, baseFields, sourceFields) {
  const nonIdenticalFields = getNonIdenticalFields(baseFields, sourceFields);
  debug(`### nonIdenticalFields: ${JSON.stringify(nonIdenticalFields, undefined, 2)}`);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }
  sourceFields.every(sourceField => baseFields.every(baseField => selectLongerField(base, baseField, sourceField)));
  return base;
}

const sortOrder = [ 'a', 'm', 'n', 'p', 's', 'l', '2', '0', '1' ];
export default () => (record, record2) => {
  const candidateFields = record2.get(fieldTag); // Get array of source fields
  candidateFields.forEach(candField => mergeOrAddField(record, candField));

  record.fields.forEach((sf, index) => {
    if ( sf.tag === '240' ) {
      // Can be simplified (I guess):
      // Should this be relocated and done to every (merged) field?
      const sortedSubfields = sortSubfields(sf.subfields, sortOrder);
      debug("TRY TO SORT 240...");
      record.fields[index].subfields = sortedSubfields;
      return;
    }
  });
  return record;
};

/*
export default () => (base, source) => {
  // Test 34: If base contains field 130, keep base 240 (no need to even look at source)
  // NV: moved this up for faster processing
  // NV: simplified code a bit:
  //const base130 = base.get(/^130$/u);
  //if (base130.length > 0) {
  if (base.containsFieldWithValue('130', undefined)) {
    return base;
  }

  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields

  // Test 35: If base does not contain 130 (checked above) or 240, copy source 240 to base
  if (baseFields.length === 0) {
    // NB! We could use simpler function to copy fields.
    // NB! We should explicitly copy just one source field.
    return copyFields(base, sourceFields);
  }

  // Run the function to get the base record to return
  return mergeField240(base, baseFields, sourceFields);

};
*/