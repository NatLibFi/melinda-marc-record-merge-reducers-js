import createDebugLogger from 'debug';
import {default as normalizeEncoding} from './normalizeEncoding';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
//const debugData = debug.extend('data');

//import {nvdebug} from './utils';

export default () => (base, source) => {
  const base2 = recordPreprocess(base);
  const source2 = recordPreprocess(source);
  return [base2, source2];
};

export function recordPreprocess(record) { // For both base and source record
  if (!record.fields) {
    return record;
  }
  // externalFixes(record); // Fixes from outside this module

  //record = result.record; // eslint-disable-line functional/immutable-data
  normalizeEncoding().fix(record);
  record.fields.forEach(field => fieldPreprocess(field));
  return record;
}

export function fieldPreprocess(field) {
  // Do nothing for control fields or corrupted data fields:
  if (!field.subfields) {
    return field;
  }


  //// Fix various shit
  // - remove crappy 100$d subfields:
  fieldRemoveDatesAssociatedWithName(field); // eg. "100$d (1)"
  field.subfields.forEach(sf => {
    // Possible things to do:
    // 2. Fix other issues
    // - normalize non-breaking space etc whitespace characters
    // - normalize various '-' letters in ISBN et al?
    // - normalize various copyright signs
    // - FIN01 vs (FI-MELINDA)? No... Probably should not be done here.
    // - remove 020$c? This one would a bit tricky, since it often contains non-price information...
    // 3. Trim
    sf.value.replace(/\s+/gu, ' ').trim(); // eslint-disable-line functional/immutable-data
    sf.value.replace(/^\s/u, '').trim(); // eslint-disable-line functional/immutable-data
    sf.value.replace(/\s$/u, '').trim(); // eslint-disable-line functional/immutable-data
  });
  return field;
}

const notYear = /^\([1-9][0-9]*\)[,.]?$/u;

function fieldRemoveDatesAssociatedWithName(field) {
  // Skip irrelevant fields:
  if (!field.tag.match(/^[1678]00$/u)) {
    return field;
  }
  field.subfields = field.subfields.filter(sf => !isIndexNotDate(sf)); // eslint-disable-line functional/immutable-data
  return field;

  function isIndexNotDate(subfield) {
    if (subfield.code !== 'd') {
      return false;
    }
    debug(`INSPECT $d '${subfield.value}'`);
    if (!notYear.test(subfield.value)) {
      return false;
    }
    debug(`MATCH $d '${subfield.value}`);
    return true;
  }
}


