import createDebugLogger from 'debug';
import {MarcRecord} from '@natlibfi/marc-record';
import {fieldToString, nvdebug} from './utils';
import {fieldGetOccurrenceNumberPairs, recordGetMaxSubfield6OccurrenceNumberAsInteger, fieldGetUnambiguousOccurrenceNumber, intToOccurrenceNumberString, subfield6GetOccurrenceNumber, subfield6ResetOccurrenceNumber} from '@natlibfi/marc-record-validators-melinda/dist/subfield6Utils';
import {getFieldsWithSubfield6Index, isRelevantField6} from './subfield6Utils';
import {fieldsToString} from '@natlibfi/marc-record-validators-melinda/dist/utils';


const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:reindexSubfield6');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

export default () => (base, source) => {
  // NV: Not actually sure why this is done...
  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  const baseMax = recordGetMaxSubfield6OccurrenceNumberAsInteger(baseRecord);

  reindexSubfield6s(sourceRecord, baseMax);


  return {base, source: sourceRecord};
};

function subfield6Index(subfield) {
  const indexPart = subfield6GetOccurrenceNumber(subfield);
  if (indexPart === undefined) {
    return 0;
  }

  const result = parseInt(indexPart, 10);
  //nvdebug(`SF6: ${subfield.value} => ${indexPart} => ${result}`, debugDev);
  return result;
}

function reindexSubfield6s(record, baseMax = 0) {
  if (baseMax === 0 || !record.fields) { // No action required
    return record;
  }

  nvdebug(`Maximum subfield $6 index is ${baseMax}`, debugDev);

  record.fields.forEach(field => fieldUpdateSubfield6s(field, baseMax));
}

function fieldUpdateSubfield6s(field, max) {
  if (!field.subfields) {
    return;
  }
  field.subfields.forEach(sf => updateSubfield6(sf, max));

  function updateSubfield6(sf, max) {
    if (sf.code === '6') { // eslint-disable-line functional/no-conditional-statements
      const origIndex = subfield6Index(sf);
      if (origIndex === 0) {
        // "00" is valid exception value. It is not reindexed!
        return;
      }
      const index = origIndex + max;
      const strindex = intToOccurrenceNumberString(index);
      subfield6ResetOccurrenceNumber(sf, strindex);
    }
  }
}


export function reindexDuplicateSubfield6Indexes(record) {
  // MET-219: same index is used twice.
  // This should be converted into a validator/fixer and moved to marc-record-validate.
  /* eslint-disable */
  let cache = {};

  // 1. Get all non-880 fields.
  const fields6 = record.fields.filter(field => isRelevantField6(field)); // Does not get 880 fields

  fields6.forEach(field => reindexIfNeeded(field));

  function reindexIfNeeded(currField) {
    if (currField.tag === '880') {
      return;
    }

    const index = fieldGetUnambiguousOccurrenceNumber(currField);
    if (index === undefined || index === '00') {
      return;
    }

    const relevantFields = getFieldsWithSubfield6Index(record, index);
    if (relevantFields.length < 3) { // Default 2: XXX $6 880-NN and 880 $6 XXX-NN
      return;
    }

    const currTagFields = relevantFields.filter(f => f.tag === currField.tag);
    if ( currTagFields.length === 1) {
      nvdebug(`NEED TO REINDEX ${fieldToString(currField)}`, debugDev);
      const max = recordGetMaxSubfield6OccurrenceNumberAsInteger(record);
      if (max) {
        const pairFields = fieldGetOccurrenceNumberPairs(currField, record.fields);
        if (pairFields.length) {
          nvdebug(` PAIR ${fieldsToString(pairFields)}`, debugDev);
          fieldUpdateSubfield6s(currField, max);
          pairFields.forEach(pairField => fieldUpdateSubfield6s(pairField, max));;
        }
      }
    }
  }
  /* eslint-enable */

}
