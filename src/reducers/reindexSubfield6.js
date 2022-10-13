import createDebugLogger from 'debug';
import {MarcRecord} from '@natlibfi/marc-record';
import {/*fieldToString,*/ nvdebug} from './utils';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
//const debugData = debug.extend('data');


const sf6Regexp = /^[0-9][0-9][0-9]-[0-9][0-9]/u;

export default () => ({base, source}) => {
  nvdebug('666');
  nvdebug(JSON.stringify(base));
  nvdebug(JSON.stringify(source));
  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});
  nvdebug('666');
  nvdebug(JSON.stringify(baseRecord));
  const baseMax = getMaxSubfield6(baseRecord);

  reindexSubfield6s(sourceRecord, baseMax);
  return {base, source: sourceRecord};
};

function subfield6Index(subfield) {
  if (!subfield.value.match(sf6Regexp)) {
    return 0;
  }
  const tailPart = subfield.value.substring(4, 6); // 4 is for "TAG-"
  const result = parseInt(tailPart, 10);
  debug(`SF6: ${subfield.value} => ${tailPart} => ${result}`);
  return result;
}

function getMaxSubfield6(record) {
  // Should we cache the value here?
  const vals = record.fields.map((field) => fieldSubfield6Index(field));
  return Math.max(...vals);

  function fieldSubfield6Index(field) {
    nvdebug(`Checking subfields $6 from ${JSON.stringify(field)}`);
    const sf6s = field.subfields ? field.subfields.filter(subfield => subfield.code === '6') : [];
    if (sf6s.length === 0) {
      return 0;
    }
    const vals = sf6s.map(sf => subfield6Index(sf));
    return Math.max(...vals);
  }
}


export function reindexSubfield6s(record, baseMax = 0) {
  if (baseMax === 0 || !record.fields) { // No action required
    return record;
  }

  nvdebug(`Maximun subfield $6 index is ${baseMax}`);

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
      const index = origIndex + max;
      const strindex = index < 10 ? `0${index}` : `${index}`;
      sf.value = sf.value.substring(0, 4) + strindex + sf.value.substring(6); // eslint-disable-line functional/immutable-data
      nvdebug(`SF6 is now ${origIndex} + ${max} = ${index}`);
    }
  }
}

