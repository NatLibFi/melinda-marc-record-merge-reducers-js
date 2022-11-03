import createDebugLogger from 'debug';
import {MarcRecord} from '@natlibfi/marc-record';
import {nvdebug} from './utils';
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');


const sf8Regexp = /^([1-9][0-9]*)(?:\.[0-9]+)?(?:\\[acprux])?$/u; // eslint-disable-line prefer-named-capture-group

export default () => (base, source) => {
  nvdebug('ENTERING reindexSubfield8.js');
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});
  const baseMax = getMaxSubfield8(base);
  reindexSubfield8s(sourceRecord, baseMax);
  return {base, source: sourceRecord};
};

function getSubfield8Index(subfield) {
  const match = subfield.value.match(sf8Regexp);
  if (!match || match.length === 0) {
    return 0;
  }
  return parseInt(match[0], 10);
}

function getMaxSubfield8(record) {
  // Should we cache the value here?
  const vals = record.fields.map((field) => fieldSubfield8Index(field));
  return Math.max(...vals);
  function fieldSubfield8Index(field) {
    //nvdebug(`Checking subfields $8 from ${JSON.stringify(field)}`, debug);

    const sf8s = field.subfields ? field.subfields.filter(subfield => subfield.code === '8') : [];
    if (sf8s.length === 0) {
      return 0;
    }
    nvdebug(`Got ${field.subfields} $8-subfield(s) from ${JSON.stringify(field)}`);
    const vals = sf8s.map(sf => getSubfield8Index(sf));
    return Math.max(...vals);
  }
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
    const oldIndex = getSubfield8Index(sf);

    const index = oldIndex + max;
    const strindex = `${index}`;
    sf.value = sf.value.replace(`${oldIndex}`, strindex); // eslint-disable-line functional/immutable-data
    debug(`SF8 is now ${sf.value}`);
  }
}
