import createDebugLogger from 'debug';
import {MarcRecord} from '@natlibfi/marc-record';
import {fieldToString, nvdebug} from './utils';
import {fieldGetIndex6, fieldGetSubfield6Pair, getFieldsWithSubfield6Index, intToTwoDigitString, isRelevantField6, isValidSubfield6, resetSubfield6Index, subfieldGetIndex6} from './subfield6Utils';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
//const debugData = debug.extend('data');

export default () => (base, source) => {
  // NV: Not actually sure why this is done...
  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  const baseMax = getMaxSubfield6(baseRecord);

  reindexSubfield6s(sourceRecord, baseMax);


  return {base, source: sourceRecord};
};

function subfield6Index(subfield) {
  const indexPart = subfieldGetIndex6(subfield);
  if (indexPart === undefined) {
    return 0;
  }

  const result = parseInt(indexPart, 10);
  //nvdebug(`SF6: ${subfield.value} => ${indexPart} => ${result}`, debug);
  return result;
}

function getMaxSubfield6(record) {
  // Should we cache the value here?
  const vals = record.fields.map((field) => fieldSubfield6Index(field));
  return Math.max(...vals);

  function fieldSubfield6Index(field) {
    //nvdebug(`Checking subfields $6 from ${JSON.stringify(field)}`);
    const sf6s = field.subfields ? field.subfields.filter(subfield => isValidSubfield6(subfield)) : [];
    if (sf6s.length === 0) {
      return 0;
    }
    // There should always be one, but here we check every subfield.
    nvdebug(`Got ${field.subfields} $6-subfield(s) from ${JSON.stringify(field)}`, debug);
    const vals = sf6s.map(sf => subfield6Index(sf));
    return Math.max(...vals);
  }
}


function reindexSubfield6s(record, baseMax = 0) {
  if (baseMax === 0 || !record.fields) { // No action required
    return record;
  }

  nvdebug(`Maximum subfield $6 index is ${baseMax}`, debug);

  record.fields.forEach(field => fieldUpdateSubfield6s(field, baseMax));
}

function fieldUpdateSubfield6s(field, max) {
  if (!field.subfields) {
    return;
  }
  field.subfields.forEach(sf => updateSubfield6(sf, max));

  function updateSubfield6(sf, max) {
    if (sf.code === '6') { // eslint-disable-line functional/no-conditional-statement
      const origIndex = subfield6Index(sf);
      if (origIndex === 0) {
        // "00" is valid exception value. It is not reindexed!
        return;
      }
      const index = origIndex + max;
      const strindex = intToTwoDigitString(index);
      resetSubfield6Index(sf, strindex);
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

    const index = fieldGetIndex6(currField);
    if (index === undefined || index === '00') {
      return;
    }

    const relevantFields = getFieldsWithSubfield6Index(record, index);
    if (relevantFields.length < 3) { // Default 2: XXX $6 880-NN and 880 $6 XXX-NN
      return;
    }
    
    const currTagFields = relevantFields.filter(f => f.tag === currField.tag);
    if ( currTagFields.length === 1) {
      nvdebug(`NEED TO REINDEX ${fieldToString(currField)}`);
      const max = getMaxSubfield6(record);
      if (max) {
        const pairField = fieldGetSubfield6Pair(currField, record);
        if (pairField) {
          nvdebug(` PAIR ${fieldToString(pairField)}`);
          fieldUpdateSubfield6s(currField, max);
          fieldUpdateSubfield6s(pairField, max);
        }
      }
    }
  }
  /* eslint-enable */

}
