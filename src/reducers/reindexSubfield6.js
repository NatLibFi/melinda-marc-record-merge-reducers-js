import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
const debugData = debug.extend('data');

const sf6Regexp = /^[0-9][0-9][0-9]-[0-9][0-9]/u;

function subfield6Index(subfield) {
  if (!subfield.value.match(sf6Regexp)) {
    return 0;
  }
  const tailPart = subfield.value.substring(4, 6); // 4 is for "TAG-"
  const result = parseInt(tailPart, 10);
  debug(`SF6: ${subfield.value} => ${tailPart} => ${result}`);
  return result;
}

export function getMaxSubfield6(record) {
  // Should we cache the value here?
  const vals = record.fields.map((field) => fieldSubfield6Index(field));
  return Math.max(...vals);

  function fieldSubfield6Index(field) {
    debugData(`Checking subfields $6 from ${JSON.stringify(field)}`);
    const sf6s = field.subfields ? field.subfields.filter(subfield => subfield.code === '6') : [];
    if (sf6s.length === 0) {
      return 0;
    }
    const vals = sf6s.map(sf => subfield6Index(sf));
    return Math.max(...vals);
  }
}


export function reindexSubfield6s(record, baseMax) {
  if (baseMax === 0) { // No action required
    return record;
  }

  debug(`MAX SF6 is ${baseMax}`);

  record.fields.forEach(field => fieldUpdateSubfield6s(field, baseMax));

  function fieldUpdateSubfield6s(field, max) {
    if (!field.subfields) {
      return;
    }
    field.subfields.forEach(sf => updateSubfield6(sf, max));
  }

  function updateSubfield6(sf, max) {
    if (sf.code === '6') { // eslint-disable-line functional/no-conditional-statement
      const index = subfield6Index(sf) + max;
      const strindex = index < 10 ? `0${index}` : `${index}`;
      sf.value = sf.value.substring(0, 4) + strindex + sf.value.substring(6); // eslint-disable-line functional/immutable-data
      debug(`SF6 is now ${sf.value}`);
    }
  }
}

