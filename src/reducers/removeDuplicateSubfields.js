
import {nvdebug, subfieldToString} from './utils.js';
import createDebugLogger from 'debug';
import {cloneAndRemovePunctuation} from './normalize.js';


const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:removeDuplicateSubfields');

export function recordRemoveDuplicateSubfieldsFromFields(record) {
  record.fields.forEach(field => fieldRemoveDuplicatesubfields(field));
}

export function fieldRemoveDuplicatesubfields(field) {
  // Risky stuff: 382$n, 505$r, others...
  if (!field.subfields || ['264', '382', '505'].includes(field.tag)) {
    return;
  }

  const strippedField = cloneAndRemovePunctuation(field); // make punctuation-less version
  /* eslint-disable */
  let seen = {};

  const subfields = field.subfields.filter((sf, i) => notSeenBefore(sf, i));
  field.subfields = subfields;

  function notSeenBefore(sf, index) {
    const subfieldAsString = subfieldToString(strippedField.subfields[index]); // use normalized form
    if (seen[subfieldAsString]) {
      nvdebug(`Remove subfield ${subfieldToString(sf)}`, debug);
      return false;
    }
    nvdebug(`Add ${subfieldAsString} to seen[]`, debug);
    seen[subfieldAsString] = subfieldAsString;
    return true;
  }
  /* eslint-enable */
}
