//import {nvdebug} from './utils';
//import createDebugLogger from 'debug';

//const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:controlFieldUtils');
//const debugData = debug.extend('data');
//const debugDev = debug.extend('dev');

const f007Lengths = {a: 8, c: 14, d: 6, f: 10, g: 9, h: 13, k: 6, m: 23, o: 2, q: 2, r: 11, s: 14, t: 2, v: 9, z: 2};

export function hasLegalLength(field) {
  if (field.tag === '006') {
    return field.value.length === 18;
  }

  // 007 length depends on 007/00. Add more checks later here.
  if (field.tag === '007') {
    const c0 = field.value.charAt(0);
    if (c0 in f007Lengths) {
      //nvdebug(`${c0}: COMPARE ${f007Lengths[c0]} vs ${field.value.length}`, debugDev);
      return field.value.length === f007Lengths[c0];
    }
    return false; // Sanity check. It's ok that no test reaches this point.
  }

  if (field.tag === '008') {
    return field.value.length === 40;
  }

  return false; // Again: a sanity check. No test should reach this point.
}


export function genericControlFieldCharPosFix(baseField, sourceField, baseTypeOfMaterial, sourceTypeOfMaterial, rule) {
  // Initially written fro field 008, but may be applied to 006 and 007 as well (I guess).
  // We apply some rules (eg. for government publication) even if baseTypeOfMaterial !== sourceTypeOfMaterial
  if (!rule.types.includes(baseTypeOfMaterial) || !rule.types.includes(sourceTypeOfMaterial) || rule.validateOnly) {
    return;
  }
  //console.info(`Apply ${'description' in rule ? rule.description : 'nameless'} rule`); // eslint-disable-line no-console
  const legalValues = rule.prioritizedValues;
  const position = baseField.tag === '006' ? rule.startPosition - 17 : rule.startPosition; // Field 006 uses rules writted for field 008. 006/01=008/18 etc.
  const valueForUnknown = 'valueForUnknown' in rule ? rule.valueForUnknown : undefined;
  const [noAttemptToCode] = rule.noAttemptToCode;

  const len = legalValues.length > 0 ? legalValues[0].length : noAttemptToCode.length;

  const baseValue = baseField.value.substring(position, position + len);
  const sourceValue = sourceField.value.substring(position, position + len);

  //console.info(`${position}: '${baseValue}' vs '${sourceValue}', UNKNOWN: '${valueForUnknown}', type of material: ${typeOfMaterial}`); // eslint-disable-line no-console
  //console.info(`Consider ${'description' in rule ? rule.description : 'unnamed'} rule at ${rule.startPosition}:\n'${fieldToString(baseField)}' +\n'${fieldToString(sourceField)}' =`); // eslint-disable-line no-console

  if (applyFix()) {
    //console.info(`Apply ${'description' in rule ? rule.description : 'unnamed'} rule at ${rule.startPosition}:\n'${fieldToString(baseField)}' +\n'${fieldToString(sourceField)}' =`); // eslint-disable-line no-console
    baseField.value = `${baseField.value.substring(0, position)}${sourceValue}${baseField.value.substring(position + len)}`;
    //console.info(`'${fieldToString(baseField)}'`); // eslint-disable-line no-console
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
