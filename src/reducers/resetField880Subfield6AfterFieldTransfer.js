import {subfieldGetTag6} from './subfield6Utils.js';
import {fieldGetOccurrenceNumberPairs, resetSubfield6Tag} from '@natlibfi/marc-record-validators-melinda/dist/subfield6Utils.js';
import {fieldToString, nvdebug} from './utils.js';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:restField880Subfield6AfterFieldTransfer');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

export function resetCorrespondingField880(field, record, newTag) {
  const pairedFields = fieldGetOccurrenceNumberPairs(field, record.fields);

  nvdebug(`RESET6: ${fieldToString(field)} got ${pairedFields.length} pair(s)`, debugDev);
  pairedFields.forEach(pairedField => fixPaired880(pairedField));

  function fixPaired880(pairedField) {
    nvdebug(` PAIR-6 (before) '${fieldToString(pairedField)}'`, debugDev);
    pairedField.subfields.forEach(sf => fixPaired880Subfield6(sf));
    nvdebug(` PAIR-6 (after)  '${fieldToString(pairedField)}'`, debugDev);
  }

  function fixPaired880Subfield6(sf) {
    const tag = subfieldGetTag6(sf);
    if (tag !== field.tag) {
      return;
    }
    resetSubfield6Tag(sf, newTag);
  }

}

