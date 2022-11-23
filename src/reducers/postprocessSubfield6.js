import createDebugLogger from 'debug';
import {fieldHasSubfield, fieldToString, nvdebug} from './utils';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
//const debugData = debug.extend('data');

// CHECK: what if index is greater than 99?
const sf6Regexp = /^[0-9][0-9][0-9]-[0-9][0-9]+/u;

// Remove unpaired
export default () => (base, source) => {
  //nvdebug(`ENTERING postprocessSubfield6.js`);
  //nvdebug(JSON.stringify(base));
  //nvdebug(JSON.stringify(source));
  //const baseRecord = new MarcRecord(base, {subfieldValues: false});
  recordRemovePairlessFields(base, false); // Or should pairless 880 $6 520-05 become $6 520-00 etc?
  removeDuplicateFieldPairs(base);
  return {base, source};
};

function get6s(field) {
  if (!field.subfields) {
    return [];
  }
  return field.subfields.filter(sf => sf.code === '6');
}

/*
function numberOf6s(field) {
  const sixes = get6s(field);
  return sixes.length;
}
*/

function subfieldApplies(subfield, lookFor) {
  if (subfield.code !== '6') {
    return false;
  }
  const key = subfield.value.replace(/^([0-9][0-9][0-9]-[0-9][0-9]+).*$/u, '$1'); // eslint-disable-line prefer-named-capture-group
  nvdebug(` Compare '${key}' vs '${lookFor}'`);
  return key === lookFor;
}

function getPairValue(subfield6, myTag) {
  const index = subfield6.value.replace(/^[0-9][0-9][0-9]-([0-9][0-9]+).*$/u, '$1'); // eslint-disable-line prefer-named-capture-group

  const lookFor = `${myTag}-${index}`;
  return lookFor;
}

function findPairForSubfield6(subfield6, myTag, fields) {
  // We keep the crap!
  if (!subfield6.value.match(sf6Regexp)) {
    return undefined;
  }

  // Only valid $6 value that fails to map to another field is iffy...
  const referredTag = subfield6.value.substring(0, 3);

  //const index = subfield6.value.substring(4, 6);
  const lookFor = getPairValue(subfield6, myTag);
  nvdebug(`Try to find  ${lookFor}...`);
  const relevantFields = fields.filter(field => field.tag === referredTag && field.subfields.some(sf => subfieldApplies(sf, lookFor)));
  if (relevantFields.length === 0) {
    return undefined;
  }
  // This should always return just one (not sanity checking this for now):
  return relevantFields[0];
}


function cleanAndReturnTrueIfDeletable(field, fields) {
  const sixes = get6s(field);
  const pairlessSixes = sixes.filter(sf => !findPairForSubfield6(sf, field.tag, fields));

  if (pairlessSixes.length) {
    if (field.tag !== '880' || pairlessSixes.length < sixes.length) {
      const remainingSubfields = field.subfields.filter(sf => pairlessSixes.every(sf2 => sf2.code !== sf.code || sf2.value !== sf.value));
      if (remainingSubfields.length) { // Just clean up the crappy $6s as decent $6 remains
        field.subfields = remainingSubfields; // eslint-disable-line functional/immutable-data
        return false;
      }
      return true;
    }
    return true;
  }
  return false;
}


function get6lessClone(field) {
  return {
    'tag': field.tag,
    'ind1': field.ind1,
    'ind2': field.ind2,
    'subfields': field.subfields.filter(sf => sf.code !== '6')
  };
}


export function removeDuplicateFieldPairs(record) { // Try to fix MRA-156
  /* eslint-disable */
  let seen = {};

  record.fields.forEach(field => processField(field));

  function processField(field) {
    if (field.tag === '880') {
      return;
    }

    const sixes = get6s(field);
    if ( sixes.length !== 1) {
      return;
    }

    nvdebug(`Try to pair ${fieldToString(field)}`, debug);
    const pairField = findPairForSubfield6(sixes[0], field.tag, record.fields);
    if (!pairField) {
      nvdebug(` No pair for ${fieldToString(field)}`, debug);
      return;
    }
    const fieldString = fieldToString(get6lessClone(field));
    const pairFieldString = fieldToString(get6lessClone(pairField));
    if (seen[fieldString]) {
      if (seen[fieldString] === pairFieldString) {
        nvdebug(`Remove '${fieldString}' and '${pairFieldString}`, debug);
        record.removeField(field);
        record.removeField(pairField);
        return;
      }
      return;
    }
    seen[fieldString] = pairFieldString;
  }
  /* eslint-enable */
}

export function recordRemovePairlessFields(record) {
  const relevantFields = record.fields.filter(field => fieldHasSubfield(field, '6'));
  const deletableFields = relevantFields.filter(field => cleanAndReturnTrueIfDeletable(field, relevantFields));

  deletableFields.forEach(field => record.removeField(field));

  //const deletableFields = getDeletableFieldsAndRemoveUnneeded6s(recordRemovePairlessFields);

}
