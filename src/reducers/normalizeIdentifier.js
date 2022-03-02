import createDebugLogger from 'debug';
import clone from 'clone';
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:normalizeIdentifiers');

import {fieldToString, nvdebug} from './utils.js';

export default function () {

  return {
    description: 'Normalizes control number identifiers characters',
    validate, fix
  };

  function fix(record) {
    const res = {message: [], fix: [], valid: true};
    //message.fix = []; // eslint-disable-line functional/immutable-data

    // Actual parsing of all fields
    /*
      if (!record.fields) {
        return false;
      }
      */

    nvdebug(`NORMALIZE CONTROL NUMBER FIX`, debug);
    record.fields.forEach(field => {
      nvdebug(` NORMALIZE CONTROL NUMBER FIX ${fieldToString(field)}`, debug);

      //fieldNormalizePrefixes(field);
      //validateField(field, true, message);
    });

    // message.valid = !(message.message.length >= 1); // eslint-disable-line functional/immutable-data
    return res;
  }

  function validate(record) {
    const res = {message: []};
    nvdebug(`NORMALIZE CONTROL NUMBER VALIDATE`, debug);
    // Actual parsing of all fields
    /*
      if (!record.fields) {
        return false;
      }
      */

    record.fields.forEach(field => {
      nvdebug(` NORMALIZE CONTROL NUMBER VALIDATE ${fieldToString(field)}`, debug);
      validateField(field, res);
    });

    res.valid = !(res.message.length >= 1); // eslint-disable-line functional/immutable-data
    return res;
  }

  function validateField(field, res) {
    if (!field.subfields) {
      return;
    }


    const orig = fieldToString(field);

    const normalizedField = clone(field);
    fieldNormalizePrefixes(normalizedField);
    nvdebug('FOO');
    const mod = fieldToString(normalizedField);
    nvdebug('BAR');
    if (orig !== mod) { // Fail as the input is "broken"/"crap"/sumthing
      res.message.push(`'${orig}' could do with control number identifier normalization`); // eslint-disable-line functional/immutable-data
      return;
    }

    return;
  }
}

// Should we have something like "const defaultFIN01 = 'FIN01'"...
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
  // Rename "Prefixes" as "ControlNumberIdentifiers"?
  // No, sinee isni etc...  however, just "ControlNumber" would do...
  /*
  if (!field.subfields) {
    return;
  }
  */
  field.subfields.forEach(sf => {
    if (mayContainControlNumberIdentifier(field.tag, sf)) {
      nvdebug(`NORMALIZE SUBFIELD: '${fieldToString(field)}'`, debug);
      sf.value = normalizeControlSubfieldValue(sf.value); // eslint-disable-line functional/immutable-data
      return;
    }
  });
}
