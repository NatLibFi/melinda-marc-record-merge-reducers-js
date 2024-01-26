import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {genericControlFieldCharPosFix, hasLegalLength} from './controlFieldUtils.js';
import {copyFields, fieldToString} from './utils.js';

// Author: Nicholas Volk
const singleCharacterPositionRulesForField007 = [ // (Also fixed-value longer units)
  // a=map, d=globe
  {types: ['a'], prioritizedValues: ['d', 'g', 'j', 'k', 'q', 'r', 's', 'u', 'y', 'z'], startPosition: 1, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Map 007/01: Specific material designation'},
  {types: ['a', 'd'], prioritizedValues: ['a', 'c'], startPosition: 3, noAttemptToCode: '|', description: 'Map/Globe 007/03: Color'},
  {types: ['a'], prioritizedValues: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'i', 'j', 'l', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z'], startPosition: 4, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Map 007/04: Physical medium'},
  {types: ['a', 'd'], prioritizedValues: ['f', 'n', 'z'], startPosition: 5, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Map/globe 007/05: Type of reproduction'},
  {types: ['a'], prioritizedValues: ['a', 'b', 'c', 'd', 'z'], startPosition: 6, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Map 007/06: (re)production details'},
  {types: ['a'], prioritizedValues: ['a', 'b', 'm', 'n'], startPosition: 7, noAttemptToCode: '|', description: 'Map 007/07: positive/negative aspect'},
  // c=electronic resource
  {types: ['c'], prioritizedValues: ['a', 'b', 'c', 'd', 'e', 'f', 'h', 'j', 'k', 'm', 'o', 'r', 's', 'z'], startPosition: 1, valueForUnknown: 'u', noAttemptToCode: '|', description: 'El. resource 007/01: specific material designation'}, // NB! u=unspecified, thus close enough for unknown
  {types: ['c'], prioritizedValues: ['a', 'b', 'c', 'm', 'n', 'z'], startPosition: 3, valueForUnknown: 'u', noAttemptToCode: '|', description: 'ER 007/03: Color'},
  {types: ['c'], prioritizedValues: ['a', 'e', 'g', 'i', 'j', 'n', 'o', 'v', 'z'], startPosition: 4, valueForUnknown: 'u', noAttemptToCode: '|', description: 'ER 007/04: dimensions'},
  {types: ['c'], prioritizedValues: ['a', ' '], startPosition: 5, valueForUnknown: 'u', noAttemptToCode: '|', description: 'ER 007/05: Sound'},
  /// 06-08: 001-999, ||| and so on... Can't be handled by these rules
  {types: ['c'], prioritizedValues: ['a', 'm'], startPosition: 9, valueForUnknown: 'u', noAttemptToCode: '|', description: 'ER 007/09: File formats'},
  {types: ['c'], prioritizedValues: ['a', 'n', 'p'], startPosition: 10, valueForUnknown: 'u', noAttemptToCode: '|', description: 'ER 007/10: quality assurance target(s)'},
  {types: ['c'], prioritizedValues: ['a', 'b', 'c', 'd', 'm', 'n'], startPosition: 11, valueForUnknown: 'u', noAttemptToCode: '|', description: 'ER 007/11: antecedent/source'},
  {types: ['c'], prioritizedValues: ['a', 'b', 'd', 'm'], startPosition: 12, valueForUnknown: 'u', noAttemptToCode: '|', description: 'ER 007/12: level of compression'},
  {types: ['c'], prioritizedValues: ['a', 'n', 'p', 'r'], startPosition: 13, valueForUnknown: 'u', noAttemptToCode: '|', description: 'ER 007/13: Reformatting quality'},
  // d=globe (007/03 and 007/05 are listed with maps)
  {types: ['d'], prioritizedValues: ['a', 'b', 'c', 'e', 'z'], startPosition: 1, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Globe 007/01: specific material designation'},
  {types: ['d'], prioritizedValues: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'i', 'l', 'n', 'p', 'v', 'w', 'z'], startPosition: 4, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Globe 007/04: Physical medium'},
  // f=tactile material, rules for multi-char-pos needs to be added...
  {types: ['f'], prioritizedValues: ['a', 'b', 'c', 'd', 'z'], startPosition: 1, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Tactile 007/01: specific material designation'},
  //{types: ['f'], prioritizedValues: [' ', 'a', 'b', 'c', 'd', 'e', 'm', 'n', 'z'], startPosition: 3, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Tactile 007/03: class of Braille writing #1'},
  //{types: ['f'], prioritizedValues: [' ', 'a', 'b', 'c', 'd', 'e', 'm', 'n', 'z'], startPosition: 4, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Tactile 007/04: class of Braille writing #2'},
  {types: ['f'], prioritizedValues: ['a', 'b', 'm', 'n', 'z'], startPosition: 5, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Tactile 007/05: level of contraction'},
  //{types: ['f'], prioritizedValues: [' ', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'n', 'z'], startPosition: 6, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Tactile 007/06: Braille music format 1'},
  //{types: ['f'], prioritizedValues: [' ', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'n', 'z'], startPosition: 7, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Tactile 007/07: Braille music format 2'},
  //{types: ['f'], prioritizedValues: [' ', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'n', 'z'], startPosition: 8, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Tactile 007/08: Braille music format 3'},
  {types: ['f'], prioritizedValues: ['a', 'b', 'n', 'z'], startPosition: 9, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Tactile 007/09: special physical characteristics'},
  // g=projected graphic
  {types: ['g'], prioritizedValues: ['c', 'd', 'f', 'o', 's', 't', 'z'], startPosition: 1, valueForUnknown: 'u', noAttemptToCode: '|', description: 'PGr 007/01: Specific material designation'},
  {types: ['g'], prioritizedValues: ['a', 'b', 'c', 'h', 'm', 'n', 'z'], startPosition: 3, valueForUnknown: 'u', noAttemptToCode: '|', description: 'PGr 007/03: color'},
  {types: ['g'], prioritizedValues: ['d', 'e', 'j', 'k', 'm', 'o', 'z'], startPosition: 4, valueForUnknown: 'u', noAttemptToCode: '|', description: 'PGr 007/06: Braille music format 1'},
  {types: ['g'], prioritizedValues: [' ', 'a', 'b'], startPosition: 5, valueForUnknown: 'u', noAttemptToCode: '|', description: 'PGr 007/05: sound on medium or separate'},
  {types: ['g'], prioritizedValues: [' ', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'z'], startPosition: 6, valueForUnknown: 'u', noAttemptToCode: '|', description: 'PGr 007/06: medium for sound'},
  {types: ['g'], prioritizedValues: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'j', 'k', 's', 't', 'v', 'w', 'x', 'y', 'z'], startPosition: 7, valueForUnknown: 'u', noAttemptToCode: '|', description: 'PGr 007/07: dimensions'},
  {types: ['g'], prioritizedValues: [' ', 'c', 'd', 'e', 'h', 'j', 'k', 'm', 'z'], startPosition: 8, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Tactile 007/08: secondary support material'},
  // h=microform
  {types: ['h'], prioritizedValues: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'j', 'z'], startPosition: 1, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Microform 007/01: specific material designation'},
  {types: ['h'], prioritizedValues: ['a', 'b', 'm', 'z'], startPosition: 3, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Microform 007/03: positive/negative aspect'},
  {types: ['h'], prioritizedValues: ['a', 'd', 'f', 'g', 'h', 'l', 'm', 'o', 'p', 'z'], startPosition: 4, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Microform 007/04: dimensions'},
  {types: ['h'], prioritizedValues: ['a', 'b', 'c', 'd', 'e', 'v'], startPosition: 5, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Microform 007/05: reduction ratio range'},
  {types: ['h'], prioritizedValues: ['b', 'c', 'm', 'z'], startPosition: 9, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Microform 007/09: color'},
  {types: ['h'], prioritizedValues: ['a', 'b', 'c', 'm', 'n', 'z'], startPosition: 10, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Microform 007/10: emulsion on film'},
  {types: ['h'], prioritizedValues: ['a', 'b', 'c', 'm'], startPosition: 11, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Microform 007/11: generation'},
  {types: ['h'], prioritizedValues: ['a', 'c', 'd', 'i', 'm', 'n', 'p', 'r', 't', 'z'], startPosition: 12, valueForUnknown: 'u', noAttemptToCode: '|', description: 'Microform 007/12: base of film'},
  // k=non-projected graphic
  {types: ['k'], prioritizedValues: ['a', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'n', 'o', 'p', 'q', 'r', 's', 'v', 'z'], startPosition: 1, valueForUnknown: 'u', noAttemptToCode: '|', description: 'k007/01: specific material designation'},
  {types: ['k'], prioritizedValues: ['a', 'b', 'c', 'h', 'm', 'z'], startPosition: 3, valueForUnknown: 'u', noAttemptToCode: '|', description: 'k007/03: color'},
  {types: ['k'], prioritizedValues: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'v', 'w', 'z'], startPosition: 4, valueForUnknown: 'u', noAttemptToCode: '|', description: 'k007/04: primary support material'},
  {types: ['k'], prioritizedValues: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'v', 'w', 'z'], startPosition: 5, valueForUnknown: 'u', noAttemptToCode: '|', description: 'k007/05: secondary support material'}

];

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:field007');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

function areMergable007Pair(field1, field2) {
  // NB! We explicitly assume that only tag=006 stuff gets this far!
  // Check 006/00:
  if (field1.value[0] !== field2.value[0]) {
    return false;
  }
  const categoryOfMaterial = field1.value.charAt(0);
  if (!['a', 'c', 'd', 'f', 'g', 'h', 'k', 'm', 'o', 'q', 'r', 's', 't', 'v', 'z'].includes(categoryOfMaterial)) {
    return false;
  }
  if (field1.value.length !== field2.value.length) {
    return false;
  }
  if (!hasLegalLength(field1)) {
    return false;
  }


  const arr1 = field1.value.split('');
  const arr2 = field2.value.split('');
  if (arr1.every((c, i) => c === arr2[i] || !field007PositionValueContainsInformation(c, i) || !field007PositionValueContainsInformation(arr2[i], i))) {
    return true;
  }

  return false;

  /*
  function isException007(c1, c2, characterPosition) {
    return false;
  }
  */

  function field007PositionValueContainsInformation(c, position) {
    console.info(`007/${position}: '${c}' (${categoryOfMaterial})`); // eslint-disable-line no-console
    if (c === '|') {
      return false;
    }

    if (c === ' ') { // Typically false, but there are some notable exceptions:
      return spaceContainsInformation(position);
    }

    return true;
  }

  function spaceContainsInformation(position) {
    console.info(`Spaceman at ${categoryOfMaterial} 006/${position}?`); // eslint-disable-line no-console
    if (position === 5 && ['c', 'g', 'k', 'm', 'v'].includes(categoryOfMaterial)) { // No sound (silent)
      return true;
    }
    if (position === 6 && ['g', 'm', 'v'].includes(categoryOfMaterial)) { // No sound (silent)
      return true;
    }
    if (position === 8 && categoryOfMaterial === 'g') { // No frame
      return true;
    }
    return false;
  }
}

export default () => (base, source) => {
  // NB! This implementation differs from the specs. However, that's because the specs are bad. See comments for details about the actual implementation.

  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  const baseFields = baseRecord.get(/^007$/u);
  const sourceFields = sourceRecord.get(/^007$/u);

  // If and only if base contains no 007 fields, we copy these fields from source:
  if (baseFields.length === 0 && sourceFields.length > 0) {
    debugDev(`Copy ${sourceFields.length} source field(s), since host has no 007`);
    copyFields(baseRecord, sourceFields);
    return {base: baseRecord, source};
  }

  // If both sides have same number of entries, and they apparently are in the same order, let's try to fill them gaps:
  if (baseFields.length > 0 && baseFields.length === sourceFields.length) {
    if (baseFields.every((baseField, i) => areMergable007Pair(baseField, sourceFields[i]))) { // eslint-disable-line functional/no-conditional-statements
      // Umm.. 007/00=f has character groups 03-04, 06-08, and 007/00=h 06-08, and 007/00=r 09-10
      baseFields.forEach((baseField, i) => fillField007Gaps(baseField, sourceFields[i]));
    }
    return {base: baseRecord, source};
  }

  // Defy specs: don't copy non-identical fields. Typically we should have only one 007 field.
  // And don't merge them either, as it is too risky. Let's just trust base record.
  return {base: baseRecord, source};
};

function fillField007Gaps(baseField, sourceField) {
  const categoryOfMaterial = baseField.value.charAt(0);
  singleCharacterPositionRulesForField007.forEach(rule => mergeTwo007Fields(baseField, sourceField, categoryOfMaterial, rule));
  // NB! Add rules for combos here!
  //console.info(`FINAL:\n${fieldToString(baseField)}`); // eslint-disable-line no-console
}

function mergeTwo007Fields(baseField, sourceField, categoryOfMaterial, rule) {
  console.info(`Apply ${'description' in rule ? rule.description : 'unnamed'} rule at ${rule.startPosition}:\n'${fieldToString(baseField)}' +\n'${fieldToString(sourceField)}' =`); // eslint-disable-line no-console
  genericControlFieldCharPosFix(baseField, sourceField, categoryOfMaterial, categoryOfMaterial, rule);
  console.info(`'${fieldToString(baseField)}'`); // eslint-disable-line no-console
}
