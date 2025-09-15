//
// This file reindexes source record's subfield $8 indexes, so that they won't overlap with base record's corresponding indexes when merging.
//
import createDebugLogger from 'debug';
import {MarcRecord} from '@natlibfi/marc-record';
import {nvdebug} from './utils.js';
import {getSubfield8LinkingNumber, recordGetAllSubfield8LinkingNumbers} from '@natlibfi/marc-record-validators-melinda/dist/subfield8Utils.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:reindexSubfield8');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

export default () => (base, source) => {
  nvdebug('ENTERING reindexSubfield8.js', debugDev);
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});
  const baseMax = getMaxSubfield8(base);
  reindexSubfield8s(sourceRecord, baseMax);
  return {base, source: sourceRecord};
};

function getMaxSubfield8(record) {
  // Should we cache the value here?
  const vals = recordGetAllSubfield8LinkingNumbers(record);
  return Math.max(...vals);
}

export function reindexSubfield8s(record, baseMax) {
  if (baseMax === 0) { // No action required
    return record;
  }

  record.fields.forEach(field => fieldUpdateSubfield8s(field, baseMax));

  function fieldUpdateSubfield8s(field, max) {
    if (!field.subfields) {
      return;
    }
    field.subfields.forEach(sf => updateSubfield8(sf, max));
  }

  function updateSubfield8(sf, max) {
    if (sf.code !== '8') {
      return;
    }
    const oldIndex = getSubfield8LinkingNumber(sf);

    const index = oldIndex + max;
    const strindex = `${index}`;
    sf.value = sf.value.replace(`${oldIndex}`, strindex);
    debugDev(`SF8 is now ${sf.value}`);
  }
}
