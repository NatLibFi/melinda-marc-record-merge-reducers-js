import {nvdebug, subfieldToString} from './utils';

export function resetCorrespondingField880(field, record, oldTag, newTag) {
  const sixes = get6s(field);
  if (sixes.length === 0) { // speed things up
    return;
  }
  const cand880Fields = record.fields.filter(field => field.tag === '880');
  sixes.forEach(sf6 => fix880(sf6));

  function fix880(sf6) {
    const pairValue = getPairValue(sf6, oldTag);
    const newPairValue = `${newTag}-${pairValue.substring(4)}`;
    // Change forEach to some? Also $6 should always be the first subfield...
    cand880Fields.forEach(f => f.subfields.forEach(sf => fix880Subfield6(sf, pairValue, newPairValue)));
  }

  function fix880Subfield6(sf, oldValue, newValue) {
    if (sf.code === '6' && sf.value === oldValue) {

      sf.value = newValue; // eslint-disable-line functional/immutable-data
      nvdebug(`fix880Subfield6: reset subfield: ${oldValue} => ${subfieldToString(sf)}`);
      return;
    }
  }

  function get6s(field) {
    return field.subfields.filter(sf => sf.code === '6');
  }


  function getPairValue(subfield6, myTag) {
    const index = subfield6.value.substring(4, 6);
    const lookFor = `${myTag}-${index}`;
    return lookFor;
  }
}

