import {nvdebug} from './utils';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:controlFieldUtils');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

function fieldPositionValueContainsInformation(val) {
  // NB! 008/39=# contains information (very unfortunately). Field 008 should not really be used here anyway...
  if (val === '' || val === '|' || val === ' ' || val === '#') {
    return false;
  }
  return true;
}

function getBetterControlFieldPositionValue(c1, c2) {
  if (fieldPositionValueContainsInformation(c1)) {
    return c1;
  }
  if (fieldPositionValueContainsInformation(c2)) {
    return c2;
  }
  return c1;
}


const f007Lengths = {a: 8, c: 14, d: 6, f: 10, g: 9, h: 13, k: 6, m: 23, o: 2, q: 2, r: 11, s: 14, t: 2, v: 9, z: 2};

export function hasLegalLength(field) {
  if (field.tag === '006') {
    return field.value.length === 18;
  }

  // 007 length depends on 007/00. Add more checks later here.
  if (field.tag === '007') {
    const c0 = field.value.charAt(0);
    if (c0 in f007Lengths) {
      nvdebug(`${c0}: COMPARE ${f007Lengths[c0]} vs ${field.value.length}`, debugDev);
      return field.value.length === f007Lengths[c0];
    }

    return false;
  }

  if (field.tag === '008') {
    return field.value.length === 40;
  }

  return false;
}

export function isFillableControlFieldPair(baseField, sourceField) {
  // NB! Don't do 008 here!
  if (baseField.value.length !== sourceField.value.length) {
    return false;
  }
  if (!hasLegalLength(baseField)) {
    return false;
  }

  // Character position 00 must be same in both base and source field:
  if (['006', '007'].includes(baseField.tag) && baseField.value[0] !== sourceField.value[0]) {
    return false;
  }

  if (baseField.tag === '007') {

    // 007/01 values must match or contain '|' (undefined):
    if (baseField.value.charAt(1) === sourceField.value.charAt(1) || sourceField.value.charAt(1) === '|' || baseField.value.charAt(1) === '|') {
      return true;
    }
  }

  const arr1 = baseField.value.split('');
  const arr2 = sourceField.value.split('');
  if (arr1.every((c, i) => c === arr2[i] || !fieldPositionValueContainsInformation(c) || !fieldPositionValueContainsInformation(arr2[i]))) {
    return true;
  }
  return false;
}

export function fillControlFieldGaps(baseField, sourceField, min = 0, max = 39) {
  // NB! Mergability must be checked before calling this!
  // NB! This function *wrongly* assumes that character positions are treated separately...
  // 007/00=f has character groups 03-04, 06-08, and 007/00=h 06-08, and 007/00=r 09-10
  if (baseField.value.length !== sourceField.value.length) {
    return;
  }
  const arr1 = baseField.value.split('');
  const arr2 = sourceField.value.split('');

  const mergedCharArray = arr1.map((c, i) => i < min || i > max ? c : getBetterControlFieldPositionValue(c, arr2[i]));

  baseField.value = mergedCharArray.join(''); // eslint-disable-line functional/immutable-data
}

export function genericControlFieldCharPosFix(baseField, sourceField, baseTypeOfMaterial, sourceTypeOfMaterial, rule) { // eslint-disable-line max-params
  // Initially written fro field 008, but may be applied to 006 and 007 as well (I guess).
  // We apply some rules (eg. for government publication) even if baseTypeOfMaterial !== sourceTypeOfMaterial
  if (!rule.types.includes(baseTypeOfMaterial) || !rule.types.includes(sourceTypeOfMaterial)) {
    return;
  }
  //console.info(`Apply ${'description' in rule ? rule.description : 'nameless'} rule`); // eslint-disable-line no-console
  const legalValues = rule.prioritizedValues;
  const position = rule.startPosition;
  const valueForUnknown = 'valueForUnknown' in rule ? rule.valueForUnknown : undefined;
  const [noAttemptToCode] = rule.noAttemptToCode;

  const len = legalValues[0].length;

  const baseValue = baseField.value.substring(position, position + len);
  const sourceValue = sourceField.value.substring(position, position + len);

  //console.info(`${position}: '${baseValue}' vs '${sourceValue}', UNKNOWN: '${valueForUnknown}', type of material: ${typeOfMaterial}`); // eslint-disable-line no-console

  if (applyFix()) {
    baseField.value = `${baseField.value.substring(0, position)}${sourceValue}${baseField.value.substring(position + len)}`; // eslint-disable-line functional/immutable-data

    return;
  }
  return;

  function applyFix() {
    if (baseValue === sourceValue || legalValues.includes(baseValue)) {
      return false;
    }
    if (legalValues.includes(sourceValue)) {
      return true;
    }
    if (valueForUnknown) {
      if (baseValue === valueForUnknown) {
        return false;
      }
      if (sourceValue === valueForUnknown) {
        return true;
      }
    }
    if (noAttemptToCode) {
      if (baseValue === noAttemptToCode) {
        return false;
      }
      if (sourceValue === noAttemptToCode) {
        return true;
      }
    }
    //console.info(`DEFAULT:don't apply fix for ${baseValue} vs ${sourceValue}`); // eslint-disable-line no-console
    return false;
  }

}
