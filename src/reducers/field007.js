import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {mergeControlFields} from './controlFieldUtils.js';
import {copyFields /*, fieldToString, getEncodingLevelRanking*/} from './utils.js';


const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

export default () => (base, source) => {
  // NB! This implementation differs from the specs. However, that's because the specs are bad. See comments for details.

  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  const baseFields = baseRecord.get(/^007$/u);
  const sourceFields = sourceRecord.get(/^007$/u);

  // If both sides contain exactly 1 entry, let's try to merge them:
  if (baseFields.length === 1 && sourceFields.length === 1) {
    if (allowMerge(baseFields[0].value, sourceFields[0].value)) {
      mergeControlFields(baseFields[0], sourceFields[0]); // eslint-disable-line functional/immutable-data
      return {base: baseRecord, source};
    }
  }

  // If and only if base contains no 007 fields, we *copy* what base has:
  if (baseFields.length === 0 && sourceFields.length > 0) {
    debug(`Copy ${sourceFields.length} source field(s), since host has no 007`);
    copyFields(baseRecord, sourceFields);
    return {base: baseRecord, source};
  }

  // Defy specs: don't copy non-identical fields. Typically we should have only one 007 field.
  // And don't merge them either, as it is too risky. Let's just trust base record.
  return {base: baseRecord, source};

  function allowMerge(baseValue, sourceValue) {
    // Too short. Definitely crap:
    if (baseValue.length < 2 || sourceValue.length < 2) {
      return false;
    }

    // 007/00 values must be equal:
    if (baseValue.charAt(0) !== sourceValue.charAt(0)) {
      return false;
    }

    // 007/01 values must match or contain '|' (undefined):
    if (baseValue.charAt(1) === sourceValue.charAt(1) ||
        sourceValue.charAt(1) === '|' ||
        baseValue.charAt(1) === '|') {
      return true;
    }
    return false;
  }
};
