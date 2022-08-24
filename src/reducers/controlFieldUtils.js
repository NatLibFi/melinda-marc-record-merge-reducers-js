function getBetterControlFieldPositionValue(c1, c2) {
  if (fieldPositionValueContainsInformation(c1)) {
    return c1;
  }
  if (fieldPositionValueContainsInformation(c2)) {
    return c2;
  }
  return c1;

  function fieldPositionValueContainsInformation(val) {
    if (val === '' || val === '|' || val === ' ' || val === '#') {
      return false;
    }
    return true;
  }
}


export function mergeControlFields(baseField, sourceField) {
  // NB! Mergability must be checked before calling this!

  if (baseField.value.length !== sourceField.value.length) {
    return;
  }
  const arr1 = baseField.value.split('');
  const arr2 = sourceField.value.split('');

  const mergedCharArray = arr1.map((c, i) => getBetterControlFieldPositionValue(c, arr2[i]));

  baseField.value = mergedCharArray.join(''); // eslint-disable-line functional/immutable-data
}
