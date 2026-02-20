/*
 * Special handling for field 041 before merge.
 *
 * Motivation:
 * - If R1 has $a und and R2 has $a eng, they should merge as $a eng
 * - If R1 has $a mul and R2 has $a fin $a swe they should merge as $a fin $a swe
 *
 * Ref. MELKEHITYS-3367, MUU-711...
 *
 * Note that value 'zxx' is removed by a validator during preprocessing.
*/

import clone from 'clone';
import {fieldToString, nvdebug, subfieldToString} from './utils.js';

const relevantSubfieldCodes = ['a', 'b', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'm', 'n', 'p', 'q', 'r', 't'];

function consistsOfThreeLetters(val) {
  return val.match(/^[a-z][a-z][a-z]$/u);
}

function removeSubfield(field, subfieldCode, value = undefined) {
  field.subfields = field.subfields.filter(sf => !isRemovableSubfield(sf));
  function isRemovableSubfield(sf) {
    if (sf.code !== subfieldCode) {
      return false;
    }
    if (value === undefined || sf.value === value) { // not having a value
      nvdebug(`Removable subfield '${subfieldToString(sf)}'`);
      return true;
    }
    return false;
  }
}

function handleMul(baseField, sourceField) {
  if (baseField.subfields.some(sf => sf.code === '2') || sourceField.subfields.some(sf => sf.code === '2')) {
    return;
  }

  relevantSubfieldCodes.forEach(code => handleMulSubfield(code));

  function handleMulSubfield(code) {
    if (hasRemovableMul(sourceField, baseField, code)) {
      //removeSubfield(sourceField, code, 'mul');
      overwriteMul(sourceField, code, baseField);
      return;
    }
    if (hasRemovableMul(baseField, sourceField, code)) {
      //removeSubfield(baseField, code, 'mul');
      overwriteMul(baseField, code, sourceField);
      return;
    }
    if (isFullyRemovableSourceSubfield(baseField, sourceField, code)) {
      //removeSubfield(sourceField, code, 'mul');
      overwriteMul(sourceField, code, baseField);
    }
  }

  function overwriteMul(field, code, otherField) {
    // To preserve the common denominator (needed by counterpart lookup), don't delete 'mul'. Replace it with values from other field instead.
    const i = field.subfields.findIndex(sf => sf.code === code && sf.value === 'mul');
    if (i == -1) {
      return;
    }
    const replacements = otherField.subfields.filter(sf => sf.code).map(sf => clone(sf));
    field.subfields.splice(i, 1, ...replacements);
  }

  function isFullyRemovableSourceSubfield(baseField, sourceField, subfieldCode) {
    // If base (field1) has 'mul' we don't want to megre anything to it: 'mul' + 'swe' is pretty stupid...
    const baseSubfields = baseField.subfields.filter(sf => sf.code === subfieldCode);
    if (baseSubfields.length !== 1 || baseSubfields[0].value !== 'mul') {
      return false;
    }

    // Remove case where one opposing subfield is removed:
    // Base 'mul' < source multilang 'fin' + 'swe' =>> don't remove
    // Base 'mul' > source lone 'swe' => remove
    const sourceSubfields = sourceField.subfields.filter(sf => sf.code === subfieldCode);
    if (sourceSubfields.length === 1) {
      return true;
    }
    return false;
  }


  function hasRemovableMul(field1, field2, subfieldCode) {
    const subfields1 = field1.subfields.filter(sf => sf.code === subfieldCode);
    // Must contain 'mul' for it to be removable in the first place...
    if (subfields1.length !== 1 || subfields1[0].value !== 'mul') {
      return false;
    }
    const subfields2 = field2.subfields.filter(sf => sf.code === subfieldCode);
    if (subfields2.length < 2) {
      return false;
    }
    return true;
  }

}

function handleUnd(baseField, sourceField) {
  // NB! Each subfield code is handled separately from others!
  relevantSubfieldCodes.forEach(code => handleUndSubfield(code));
  nvdebug('EXIT UND');

  function handleUndSubfield(subfieldCode) {
    if (hasRemovableUnd(sourceField, baseField, subfieldCode)) {
      removeSubfield(sourceField, subfieldCode, 'und');
      return;
    }
    if (hasRemovableUnd(baseField, sourceField, subfieldCode)) {
      removeSubfield(baseField, subfieldCode, 'und');
      return;
    }
  }

  function hasRemovableUnd(field1, field2, subfieldCode) {
    const subfields1 = field1.subfields.filter(sf => sf.code === subfieldCode);
    // Must contain 'und' for it to be removable in the first place...
    if (!subfields1.some(sf => sf.value === 'und')) {
      return false;
    }
    const subfields2 = field2.subfields.filter(sf => sf.code === subfieldCode);
    if (subfields2.length === 0) {
      return false;
    }

    if (subfields1.length === 1 ) { // Lone 'und'
      const subfields2 = field2.subfields.filter(sf => sf.code === subfieldCode);
      if (subfields2.length > 1) {
        return true;
      }
      if (subfields2[0].value !== 'und' && consistsOfThreeLetters(subfields2[0].value) ) {
        return true;
      }
      return false;
    }
    // There might be other permutation in which me might deem und removable, eg. $a foo $a und vs $a foo $a bar (does 'und' refer to 'bar' here?).
    // However, we are not proactively trying to catch these. Let's wait for a real life case.
    return false;
  }
}

export default () => (base, source) => {
  nvdebug('FIELD 041 START');
  const b041 = base.fields.filter(f => f.tag === '041');
  const s041 = source.fields.filter(f => f.tag === '041');

  // No need for special handling
  if (b041.length === 0 || s041.length === 0) {
    return {base, source};
  }

  // 041 is a repeatable field. However, since I have no idea how handle that situation, I'll just abort
  if (b041.length !== 1 || s041.length !== 1) {
    return {base, source};
  }

  handleMul(b041[0], s041[0]);
  handleUnd(b041[0], s041[0]);

  // If $a und is/was the only subfield in the record, we might end up subfieldless:
  if (b041[0].subfields.length === 0) {
    // If base is removed, we don't want to lose information in it's IND1!
    if (b041[0].ind1 !== ' ' && s041[0].ind1 === ' ') {
      nvdebug(`Copy ind1='${b041  [0].ind1}' from base to source as base 041 gets deleted`);
      s041[0].ind1 = b041[0].ind1;
    }
    nvdebug('Remove subfieldless base f041');
    base.removeField(b041[0]);
  }
  if (s041[0].subfields.length === 0) {
    nvdebug('Remove subfieldless source f041');
    source.removeField(s041[0]);
  }

  return {base, source};
};
