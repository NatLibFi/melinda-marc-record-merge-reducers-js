import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {mergeControlFields} from './controlFieldUtils.js';
import {copyFields /*, fieldToString, getEncodingLevelRanking*/} from './utils.js';


const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

// NB: handle merging better.ns
export default () => (base, source) => {

  /*
  // NV: Nah, enc level is prolly irrelevant here. We have already chosen base somewhere. Let's trust that decision instead.
  if (getEncodingLevelRanking(base) < getEncodingLevelRanking(source)) { // smaller is better!
    // The original version is better than the alternative version.
    return base;
  }
  */
  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  const baseFields = baseRecord.get(/^007$/u);
  const sourceFields = sourceRecord.get(/^007$/u);

  if (baseFields.length === 0 && sourceFields.length > 0) {
    debug(`Copy ${sourceFields.length} source field(s), since host has no 007`);
    copyFields(baseRecord, sourceFields);
    return baseRecord;
  }

  // NV: added this
  if (baseFields.length === 1) {
    if (sourceFields.length === 1) {
      if (allowMerge(baseFields[0].value, sourceFields[0].value)) {
        mergeControlFields(baseFields[0], sourceFields[0]); // eslint-disable-line functional/immutable-data

        return baseRecord;
      }
    }
  }
  // The rest is someone else's code. Complies with specs, which are bad. Not doing them :D
  /*
  const mergableFields = sourceFields.filter(sf => baseFields.every(bf => allowCopy(bf, sf)));

  //const nonIdenticalFields = getNonIdenticalFields(baseFields, sourceFields);

  if (mergableFields.length > 0) {
    debug(`${mergableFields.length} copyable field(s)`);
    return copyFields(baseRecord, mergableFields);
  }
  */
  return base;

  function allowMerge(baseValue, sourceValue) {
    // Copy
    if (baseValue.length < 2 || sourceValue.length < 2) {
      return false;
    }

    if (baseValue.charAt(0) !== sourceValue.charAt(0)) {
      return false;
    }

    if (baseValue.charAt(1) === sourceValue.charAt(1) ||
        sourceValue.charAt(1) === '|' ||
        baseValue.charAt(1) === '|') {
      return true;
    }
    return false;
  }
};
