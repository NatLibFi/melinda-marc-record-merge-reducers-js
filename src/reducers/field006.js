import createDebugLogger from 'debug';
import {MarcRecord} from '@natlibfi/marc-record';
import {copyFields, nvdebug} from './utils.js';
import {fillControlFieldGaps, isFillableControlFieldPair} from './controlFieldUtils.js';

// Test 02: If Leader 000/06 is 'o' or 'p' in source, copy 006 from source to base as new field (2x)
// Test 03: If Leader 000/06 is something else, do nothing

// NV: Moved these of the arrow function
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:field006');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

export default () => (base, source) => {
  // NB! This implementation differs from the specs. https://workgroups.helsinki.fi/x/K1ohCw
  // However, that's because the specs are bad. See comments for details.

  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  const baseFields = baseRecord.get(/^006$/u);
  const sourceFields = sourceRecord.get(/^006$/u);

  // If both sides have same number of entries,
  // and they apparently are in the same order,
  // let's try to fill the gaps:
  if (baseFields.length > 0 && baseFields.length === sourceFields.length) {
    if (baseFields.every((baseField, i) => isFillableControlFieldPair(baseField, sourceFields[i]))) { // eslint-disable-line functional/no-conditional-statements
      baseFields.forEach((baseField, i) => fillControlFieldGaps(baseField, sourceFields[i]));
    }
    return {base: baseRecord, source};
  }

  // If and only if base contains no 006 fields, we *copy* what source has:
  if (baseFields.length === 0 && sourceFields.length > 0) {
    nvdebug(`Copy ${sourceFields.length} source field(s), since host has no 006`, debugDev);
    copyFields(baseRecord, sourceFields);
    return {base: baseRecord, source};
  }

  // Defy specs: don't copy non-identical fields. Typically we should have only one 007 field.
  // And don't merge them either, as it is too risky. Let's just trust base record.
  return {base: baseRecord, source};

};
