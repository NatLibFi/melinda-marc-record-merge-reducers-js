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

  // Field 245 is non-repeatable
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // Indicator 2 is always taken from the base record
  const baseInd2 = base.ind2;
  debug(`baseInd2: ${baseInd2}`);

  // Run the function to get the base record to return
  return mergeField245(base, baseField, sourceField);

  function mergeField245(base, baseField, sourceField) {
    debug(`Working on field 245`);
    const baseSubs = baseField.subfields;
    debug(`baseSubs: ${JSON.stringify(baseSubs, undefined, 2)}, length: ${baseSubs.length}`);
    const sourceSubs = sourceField.subfields;
    debug(`sourceSubs: ${JSON.stringify(sourceSubs, undefined, 2)}, length: ${sourceSubs.length}`);
    // If the source field has more subfields, replace base with source
    if (sourceSubs.length > baseSubs.length) {
      const newBaseField = JSON.parse(JSON.stringify(sourceField));
      // But ind2 is taken from base
      newBaseField.ind2 = base.ind2;
      /* eslint-disable */
      base.removeField(baseField); // remove old baseField
      debug(`### Base after removing old baseField: ${JSON.stringify(base, undefined, 2)}`);
      base.insertField(newBaseField); // insert newBaseField
      debug(`### Base after inserting newBaseField: ${JSON.stringify(base, undefined, 2)}`);
      /* eslint-enable */
      debug(`Source 245 is longer, replacing base field with source field`);
      return base;
    }
    // Otherwise keep existing base field
    debug(`Keeping base field 245`);
    return base;
  }
};
