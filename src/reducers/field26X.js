//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {nvdebug} from './utils';
//import {mergeField} from './mergeField';

//import {MarcRecord} from '@natlibfi/marc-record';
//import {default as normalizeEncoding} from '@natlibfi/marc-record-validators-melinda/dist/normalize-utf8-diacritics';

import {postprocessRecords} from './mergeOrAddPostprocess.js';
//import {preprocessBeforeAdd} from './processFilter.js';
import {addField} from './addField';

// This reducer will take all 240 fields from source record, and then either merge them with host,
// copy them or ignore/skip/drop them.
//
// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:field26X');

const activeTagPattern = /^26[04]$/u;
// Should this load default configuration?

export default () => (base, source) => {
  handleField26X(base, source);

  // Remove deleted fields and field.merged marks:
  postprocessRecords(base, source);

  return {base, source};
};


function handleField26X(base, source) {
  const candidateFields = source.get(activeTagPattern);
  const baseFields = base.get(activeTagPattern);

  nvdebug(`Base has ${baseFields.length} and source has ${candidateFields.length} relevant fields`, debug);

  // Nothing to do:
  if (source.length === 0) {
    return;
  }

  // Special case: as base has no relevant fields, just copy everything from source to base.
  if (baseFields.length === 0) {
    candidateFields.forEach(field => addField(base, field));
    return;
  }


  // Should we split 260 $abc $efg to separate rows?

  // Explode 260/264 fields to something

}

/*
function matchingIndicator1(field1, field2) {
  if (field1.ind1 === ' ' || field2.ind1 === ' ') {
    return true;
  }

  return field1.ind1 === field2.ind1;
}
*/

/*
function getBetterIndicator1(baseField, sourceField) {
  // No problem if field1.ind1 === field2.ind1, but not coding that explicitly

  // We presume here that indicators match.
  if(baseField.ind1 === ' ') {
    return sourceField.ind1;
  }
  if(sourceField.ind1 === ' ') {
    return baseField.ind1;
  }

  // Fallback: keep the baseField's ind1
  return baseField.ind1;
}
*/
