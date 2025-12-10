// Special handling for field 041 before merge.
// Motivation:
// - If R1 has $a und and R2 has $a eng, they should merge as $a eng

function consistsOfThreeLetters(val) {
  return val.match(/^[a-z][a-z][a-z]$/u);
}

function handleUnd(baseField, sourceField) {
  // NB! Each subfield is handled separately from others!
  const relevantSubfieldCodes = ['a', 'b', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'm', 'n', 'p', 'q', 'r', 't'];

  relevantSubfieldCodes.forEach(code => handleUndSubfield(code));

  function handleUndSubfield(subfieldCode) {
    if (hasRemovableUnd(sourceField, baseField, subfieldCode)) {
      sourceField.subfields = sourceField.subfields.filter(sf => sf.code !== subfieldCode || sf.value !== 'und');
      return;
    }
    if (hasRemovableUnd(baseField, sourceField, subfieldCode)) {
      baseField.subfields = baseField.subfields.filter(sf => sf.code !== subfieldCode || sf.value !== 'und');
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
        return  true
      }
      return false;
    }
    // There might be other permutation in which me might deem und removable, eg. $a foo $a und vs $a foo $a bar (does 'und' refer to 'bar' here?).
    // However, we are not proactively trying to catch these. Let's wait for a real life case.
    return false;
  }
}

export default () => (base, source) => {
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

  handleUnd(b041[0], s041[0]);
  // If $a und is the only subfield in the record, we might end up subfieldless:
  if (!b041[0].subfields.length === 0) {
    // If base is removed, we don't want to lose information in it's IND1!
    if (s041[0].ind1 === ' ') {
      s041[0].ind1 = b041[0].ind1;
    }
    base.removeField(b041[0]);
  }
  if (!s041[0].subfields.length === 0) {
    source.removeField(s041[0]);
  }

  return {base, source};
};
