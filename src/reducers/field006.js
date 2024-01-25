import createDebugLogger from 'debug';
import {MarcRecord} from '@natlibfi/marc-record';
import {copyFields, nvdebug} from './utils.js';
import {fillControlFieldGaps, hasLegalLength} from './controlFieldUtils.js';

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
      baseFields.forEach((baseField, i) => fillControlFieldGaps(baseField, sourceFields[i]));
    }
    return {base: baseRecord, source};
  }

  // If and only if base contains no 006 fields, we *copy* what source has:
  if (baseFields.length === 0 && sourceFields.length > 0) {
    nvdebug(`Copy ${sourceFields.length} source field(s), since host has no 006`, debugDev);
    copyFields(baseRecord, sourceFields);
    return {base: baseRecord, source};
  }

  // Defy specs: don't copy non-identical fields. Typically we should have only one 007 field.
  // And don't merge them either, as it is too risky. Let's just trust base record.
  return {base: baseRecord, source};

};

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
  // We always try to merge 008/18-34. However we are much stricter with 006 pairs, as we can not be sure they mean the same thing...
  // (There can be many in different order etc.)

  const arr1 = field1.value.split('');
  const arr2 = field2.value.split('');
  if (!arr1.every((c, i) => c === arr2[i] || !field006PositionValueContainsInformation(c) || !field006PositionValueContainsInformation(arr2[i]))) {
    return false;
  }

  return true;

  function field006PositionValueContainsInformation(c, position) {
    if (c === '|') {
      return false;
    }

    if (c === ' ') { // Typically false, but there are some notable exceptions:
      return spaceContainsInformation(position, typeOfMaterial);
    }

    if (c === 'u') {
      if (typeOfMaterial === 'BK' && position === 16) { // 008/33
        return false;
      }
    }

    return true;
  }

  function spaceContainsInformation(position, typeOfMaterial) {
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
