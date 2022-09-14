function fieldPositionValueContainsInformation(val) {
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

function hasLegalLength(field) {
  if (field.tag === '006') {
    return field.value.length === 18;
  }

  // 007 length depends on 007/00. Add more checks later here.
  if (field.tag === '007') {
    if (field.length < 2) {
      return false;
    }
    return true;
  }

  if (field.tag === '008') {
    return field.value.length === 40;
  }

  return false;
}

export function isFillableControlFieldPair(baseField, sourceField) {
  if (baseField.value.length !== sourceField.value.length || !hasLegalLength(baseField)) {
    return false;
  }

  if (baseField.tag === '006' && baseField.value[0] !== sourceField.value[0]) {
    return false;
  }

  if (baseField.tag === '007') {
    // 007/00 values must be equal:
    if (baseField.value.charAt(0) !== sourceField.value.charAt(0)) {
      return false;
    }

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

  if (baseField.value.length !== sourceField.value.length) {
    return;
  }
  const arr1 = baseField.value.split('');
  const arr2 = sourceField.value.split('');

  const mergedCharArray = arr1.map((c, i) => i < min || i > max ? c : getBetterControlFieldPositionValue(c, arr2[i]));

  baseField.value = mergedCharArray.join(''); // eslint-disable-line functional/immutable-data
}
