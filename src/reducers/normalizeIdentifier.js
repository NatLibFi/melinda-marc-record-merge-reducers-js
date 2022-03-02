//import createDebugLogger from 'debug';

//const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:normalizeIdentifiers');

import {fieldToString} from './utils.js';

function normalizeFIN01(value = '') {
  if ((/^\(FI-MELINDA\)[0-9]{9}$/u).test(value)) {
    return `(FIN01)${value.substring(12)}`; // eslint-disable-line functional/immutable-data
  }
  if ((/^FCC[0-9]{9}$/u).test(value)) {
    return `(FIN01)${value.substring(3)}`; // eslint-disable-line functional/immutable-data
  }
  return value;
}

function normalizeFIN11(value = '') {
  if ((/^\(FI-ASTERI-N\)[0-9]{9}$/u).test(value)) {
    return `(FIN11)${value.substring(13)}`; // eslint-disable-line functional/immutable-data
  }
  if ((/^https?:\/\/urn\.fi\/URN:NBN:fi:au:finaf:[0-9]{9}$/u).test(value)) {
    return `(FIN11)${value.slice(-9)}`;
  }
  return value;
}

export function normalizeControlSubfieldValue(value = '') {
  const fin01 = normalizeFIN01(value);
  if (fin01 !== value) {
    return fin01;
  }
  if ((/^\(FI-MELINDA\)[0-9]{9}$/u).test(value)) {
    return `(FIN01)${value.substring(12)}`;
  }
  if ((/^\(FI-ASTERI-S\)[0-9]{9}$/u).test(value)) {
    return `(FIN10)${value.substring(13)}`;
  }
  const fin11 = normalizeFIN11(value);
  if (fin11 !== value) {
    return fin11;
  }
  if ((/^\(FI-ASTERI-A\)[0-9]{9}$/u).test(value)) {
    return `(FIN12)${value.substring(13)}`;
  }
  if ((/^\(FI-ASTERI-W\)[0-9]{9}$/u).test(value)) {
    return `(FIN13)${value.substring(13)}`;
  }
  // NB! we could/should normalize isni to uri...
  return value;
}

//export function normalizableSubfieldPrefix(tag, sf) {
export function mayContainControlNumberIdentifier(tag, sf) {   
  if (sf.code === '0' || sf.code === '1' || sf.code === 'w') {
    return true;
  }

  if (tag === '035' && ['a', 'z'].includes(sf.code)) {
    return true;
  }
  return false;
}

export function fieldNormalizePrefixes(field) {
  field.subfields.forEach(sf => {
    if (mayContainControlNumberIdentifier(field.tag, sf)) {
      console.info(`NORMALIZE SUBFIELD: '${fieldToString(field)}'`); // eslint-disable-line no-console
      sf.value = normalizeControlSubfieldValue(sf.value); // eslint-disable-line functional/immutable-data
      return;
    }
  });
}
