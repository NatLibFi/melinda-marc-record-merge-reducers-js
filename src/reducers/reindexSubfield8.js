import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
const debugData = debug.extend('data');

const sf8Regexp = /^([1-9][0-9]*)(?:\.[0-9]+)?(?:\\[acprux])?$/u; // eslint-disable-line prefer-named-capture-group

function subfield8Index(subfield) {
  const match = subfield.value.match(sf8Regexp);
  if (match.length === 0) {
    return 0;
  }
  return parseInt(match[0], 10);
}

export function getMaxSubfield8(record) {
  // Should we cache the value here?
  const vals = record.fields.map((field) => fieldSubfield8Index(field));
  return Math.max(...vals);
  function fieldSubfield8Index(field) {
    debugData(`Checking subfields $8 from ${JSON.stringify(field)}`);
    const sf8s = field.subfields ? field.subfields.filter(subfield => subfield.code === '8') : [];
    if (sf8s.length === 0) {
      return 0;
    }
    const vals = sf8s.map(sf => subfield8Index(sf));
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
    if (sf.code === '8') { // eslint-disable-line functional/no-conditional-statement
      const oldIndex = subfield8Index(sf);
      if (oldIndex < 1) { // Unexpected crap
        return;
      }
      const index = oldIndex + max;
      const strindex = `${index}`;
      sf.value = sf.value.replace(`${oldIndex}`, strindex); // eslint-disable-line functional/immutable-data
      debug(`SF8 is now ${sf.value}`);
    }
  }
}
