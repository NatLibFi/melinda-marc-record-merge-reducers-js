import {fieldGetSubfield6Pairs, resetSubfield6Tag, subfieldGetTag6} from './subfield6Utils';
import {fieldToString, nvdebug} from './utils';

export function resetCorrespondingField880(field, record, newTag) {
  const pairedFields = fieldGetSubfield6Pairs(field, record);

  nvdebug(`RESET6: ${fieldToString(field)} got ${pairedFields.length} pair(s)`);
  pairedFields.forEach(pairedField => fixPaired880(pairedField));

  function fixPaired880(pairedField) {
    nvdebug(` PAIR-6 (before) '${fieldToString(pairedField)}'`);
    pairedField.subfields.forEach(sf => fixPaired880Subfield6(sf));
    nvdebug(` PAIR-6 (after)  '${fieldToString(pairedField)}'`);
  }

  function fixPaired880Subfield6(sf) {
    const tag = subfieldGetTag6(sf);
    if (tag !== field.tag) {
      return;
    }
    resetSubfield6Tag(sf, newTag);
  }

}

