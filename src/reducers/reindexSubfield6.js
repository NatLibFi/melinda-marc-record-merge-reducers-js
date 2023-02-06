import createDebugLogger from 'debug';
import {MarcRecord} from '@natlibfi/marc-record';
import {/*fieldToString,*/ nvdebug} from './utils';
import {isValidSubfield6, subfieldGetIndex6} from './subfield6Utils';

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


export function reindexSubfield6s(record, baseMax = 0) {
  if (baseMax === 0 || !record.fields) { // No action required
    return record;
  }

  nvdebug(`Maximum subfield $6 index is ${baseMax}`, debug);

  record.fields.forEach(field => fieldUpdateSubfield6s(field, baseMax));

  function fieldUpdateSubfield6s(field, max) {
    if (!field.subfields) {
      return;
    }
    field.subfields.forEach(sf => updateSubfield6(sf, max));
  }

  function updateSubfield6(sf, max) {
    if (sf.code === '6') { // eslint-disable-line functional/no-conditional-statement
      const origIndex = subfield6Index(sf);
      if (origIndex === 0) {
        // "00" is valid exception value. It is not reindexed!
        return;
      }
      const index = origIndex + max;
      const strindex = index < 10 ? `0${index}` : `${index}`;
      sf.value = sf.value.substring(0, 4) + strindex + sf.value.substring(6); // eslint-disable-line functional/immutable-data
      nvdebug(`SF6 is now ${origIndex} + ${max} = ${index}`, debug);
    }
  }
}

