import createDebugLogger from 'debug';
import {MarcRecord} from '@natlibfi/marc-record';
import {copyFields, nvdebug} from './utils.js';
import {genericControlFieldCharPosFix, hasLegalLength} from './controlFieldUtils.js';
import {getSingleCharacterPositionRules, setFormOfItem} from './field008.js';
// Test 02: If Leader 000/06 is 'o' or 'p' in source, copy 006 from source to base as new field (2x)
// Test 03: If Leader 000/06 is something else, do nothing

// NV: Moved these of the arrow function
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:field006');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

export default () => (base, source) => {
  // NB! This implementation differs from the specs. https://workgroups.helsinki.fi/x/K1ohCw
  // However, that's because the specs are bad. See comments for details.

  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  const baseFields = baseRecord.get(/^006$/u);
  const sourceFields = sourceRecord.get(/^006$/u);

  // If both sides have same number of entries, and they apparently are in the same order, let's try to fill the gaps:
  if (baseFields.length > 0 && baseFields.length === sourceFields.length) {
    if (baseFields.every((baseField, i) => areMergable006Pair(baseField, sourceFields[i]))) { // eslint-disable-line functional/no-conditional-statements
      baseFields.forEach((baseField, i) => fillField006Gaps(baseField, sourceFields[i]));
    }
    return {base: baseRecord, source};
  }

  // If and only if base contains no 006 fields, we *copy* what source has:
  if (baseFields.length === 0 && sourceFields.length > 0) {
    nvdebug(`Copy ${sourceFields.length} source field(s), since host has no 006`, debugDev);
    copyFields(baseRecord, sourceFields);
    return {base: baseRecord, source};
  }

  // Defy specs: don't copy non-identical fields. Typically (but not always) we should have only one 006 field.
  // Default behaviour: merging is too risky (might describe different materials), so let's just trust base record.
  return {base: baseRecord, source};
};

const singleCharacterPositionRules = getSingleCharacterPositionRules();
function fillField006Gaps(baseField, sourceField) {
  const typeOfMaterial = mapFieldToTypeOfMaterial(baseField);
  singleCharacterPositionRules.forEach(rule => mergeTwo006Fields(baseField, sourceField, typeOfMaterial, rule));
  setFormOfItem(baseField, sourceField, typeOfMaterial);
  //console.info(`FINAL:\n${fieldToString(baseField)}`); // eslint-disable-line no-console
}

function mergeTwo006Fields(baseField, sourceField, typeOfMaterial, rule) {
  //console.info(`Apply ${'description' in rule ? rule.description : 'unnamed'} rule at ${rule.startPosition}:\n'${fieldToString(baseField)}' +\n'${fieldToString(sourceField)}' =`); // eslint-disable-line no-console
  genericControlFieldCharPosFix(baseField, sourceField, typeOfMaterial, typeOfMaterial, rule);
  //console.info(`'${fieldToString(baseField)}'`); // eslint-disable-line no-console
}

function areMergable006Pair(field1, field2) {
  // NB! We explicitly assume that only tag=006 stuff gets this far!
  // Check 006/00:
  if (field1.value[0] !== field2.value[0]) {
    return false;
  }
  const typeOfMaterial = mapFieldToTypeOfMaterial(field1);
  if (!typeOfMaterial) { // Must map to some type of material
    return false;
  }
  if (field1.value.length !== field2.value.length) {
    return false;
  }
  if (!hasLegalLength(field1)) {
    return false;
  }
  // By default, we try to merge 008/18-34. However we are much stricter with 006 pairs, as we can not be sure they mean the same thing...
  // (There is always one 008, but 006 has 0...n instances.) Thus this does not allow any subsetting etc of, say, BK 006/07-10.
  // We should improve order stuff etc., but let's start with overstrict implementation, as the problem is largely theoretical.
  // The proper solution will eventually be done in field008.js. We can then decide whether we can to use it in 006 as well.

  const arr1 = field1.value.split('');
  const arr2 = field2.value.split('');
  if (arr1.every((c, i) => c === arr2[i] || !field006PositionValueContainsInformation(c) || !field006PositionValueContainsInformation(arr2[i]) || isException(c, arr2[i], i))) {
    return true;
  }

  return false;

  function isException(c1, c2, characterPosition) {
    // We know that character position is same for both (type of record is always same) as base 006/00 must be source 006/00
    if (characterPosition === 6) {
      // 'o' (online resource)and 'q' are subsets of 'p'
      if (['BK', 'CR', 'MU', 'MX'].includes(typeOfMaterial)) {
        if (['o', 'q'].includes(c1) && c2 === 's') {
          return true;
        }
        if (['o', 'q'].includes(c2) && c1 === 's') {
          return true;
        }
      }
    }
    return false;
  }

  function field006PositionValueContainsInformation(c, position) {
    if (c === '|') {
      return false;
    }

    if (c === ' ') { // Typically false, but there are some notable exceptions:
      return spaceContainsInformation(position);
    }

    if (c === 'u') {
      if (typeOfMaterial === 'BK' && position === 16) { // 008/33
        return false;
      }
    }

    return true;
  }

  function spaceContainsInformation(position) {
    if (position === 1 && typeOfMaterial === 'CR') { // 008/18 frequency
      return true;
    }
    if (position === 4 && typeOfMaterial === 'CR') { // 008/21 type of continuing resource
      return true;
    }
    // Skip map 006/05-06 on purpose
    if (position === 5 && typeOfMaterial === 'CR') { // 008/22 form of original item
      return true;
    }
    if (position === 6 && ['BK', 'CR', 'MU', 'MX'].includes(typeOfMaterial)) { // 008/23 form of item '#' means "none of the following" 008/23
      return true;
    }
    if (position === 7 && typeOfMaterial === 'CR') { // 008/22 nature of entire work
      return true;
    }
    if (position === 11 && ['BK', 'CF', 'CR', 'MP', 'VM'].includes(typeOfMaterial)) { // 008/28 government publication
      return true;
    }
    if (position === 12 && ['MP', 'VM'].includes(typeOfMaterial)) { // 008/29 form of item '#' means "none of the following"
      return true;
    }
    if (position === 13 && ['MU'].includes(typeOfMaterial)) { // 008/30 Literaty text for sound recordings (code 1)
      return true;
    }
    if (position === 17 && typeOfMaterial === 'BK') { // 008/34 technique
      return true;
    }
    return false;
  }
}

const map06CharPos00ToTypeOfMaterial = {'a': 'BK', 'c': 'MU', 'd': 'MU', 'e': 'MP', 'f': 'MP', 'g': 'VM', 'i': 'MU', 'j': 'MU', 'k': 'VM', 'm': 'CF', 'o': 'VM', 'p': 'MX', 'r': 'VM', 's': 'CR', 't': 'BK'};

function mapFieldToTypeOfMaterial(field) {
  const c = field.value.charAt(0); // stuupid eslint complains about field.value[0]...
  if (c in map06CharPos00ToTypeOfMaterial) {
    return map06CharPos00ToTypeOfMaterial[c];
  }
  return undefined;
}
