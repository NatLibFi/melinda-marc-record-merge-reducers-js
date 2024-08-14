import createDebugLogger from 'debug';
import {isRelevantField6, pairAndStringify6, removeField6IfNeeded} from './subfield6Utils';
import {isValidSubfield6, subfield6GetOccurrenceNumber} from '@natlibfi/marc-record-validators-melinda/dist/subfield6Utils';
import {fieldHasSubfield, fieldToString, nvdebug, subfieldToString} from './utils';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:preProcessSubfield6');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');


// Remove unpaired
export default () => (base, source) => {
  //nvdebug(`ENTERING postprocessSubfield6.js`, debugDev);
  //nvdebug(JSON.stringify(base), debugDev);
  //nvdebug(JSON.stringify(source), debugDev);
  //const baseRecord = new MarcRecord(base, {subfieldValues: false});

  recordRemovePairlessFields(base, false); // Or should pairless 880 $6 520-05 become $6 520-00 etc?
  removeDuplicatedDatafieldsWithSubfield6(base);
  //removeDuplicateFieldPairs(base);
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
  nvdebug(` Compare '${key}' vs '${lookFor}'`, debugDev);
  return key === lookFor;
}


function getPairValue(subfield6, myTag) {
  //const index = subfield6.value.replace(/^[0-9][0-9][0-9]-([0-9][0-9]+).*$/u, '$1'); // eslint-disable-line prefer-named-capture-group
  const occurrenceNumber = subfield6GetOccurrenceNumber(subfield6);
  const lookFor = `${myTag}-${occurrenceNumber}`;
  return lookFor;
}


function findPairForSubfield6(subfield6, myTag, fields) {
  // We keep the crap!
  if (!isValidSubfield6(subfield6)) {
    return undefined;
  }

  // Only valid $6 value that fails to map to another field is iffy...
  const referredTag = subfield6.value.substring(0, 3);

  //const index = subfield6.value.substring(4, 6);
  const lookFor = getPairValue(subfield6, myTag);
  nvdebug(`Try to find  ${lookFor}...`, debugDev);
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
        const removables = field.subfields.filter(sf => pairlessSixes.every(sf2 => sf2.code === sf.code && sf2.value === sf.value));
        removables.forEach(sf => nvdebug(`Remove pairless $6 subfield: ${subfieldToString(sf)}`, debugDev));

        field.subfields = remainingSubfields; // eslint-disable-line functional/immutable-data
        return false;
      }
      return true;
    }
    return true;
  }
  return false;
}


function recordRemovePairlessFields(record) {
  const relevantFields = record.fields.filter(field => fieldHasSubfield(field, '6'));
  const deletableFields = relevantFields.filter(field => cleanAndReturnTrueIfDeletable(field, relevantFields));

  deletableFields.forEach(field => record.removeField(field));

  //const deletableFields = getDeletableFieldsAndRemoveUnneeded6s(recordRemovePairlessFields);

}


export function removeDuplicatedDatafieldsWithSubfield6(record) {
  /* eslint-disable */
  let seen = {};

  record.fields.forEach(field => nvdebug(`CHECK ${fieldToString(field)}`, debugDev));
  
  const fields6 = record.fields.filter(field => isRelevantField6(field)); // Does not get 880 fields
  
  fields6.forEach(field => removeDuplicatedDatafieldWithSubfield6(field));

  function removeDuplicatedDatafieldWithSubfield6(field) {
    const fieldAsString = pairAndStringify6(field, record);
    if ( fieldAsString in seen ) {
      nvdebug(`REMOVE? ${fieldAsString}`, debugDev);
      removeField6IfNeeded(field, record, [fieldAsString]);
      return;
    }
    nvdebug(`ADD2SEEN ${fieldAsString}`, debugDev);
    seen[fieldAsString] = 1;
  }

  /* eslint-enable */
}
