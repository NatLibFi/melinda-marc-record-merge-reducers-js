import createDebugLogger from 'debug';
import {checkIdenticalness} from './utils.js';

// Test 04: If 007/00-01 are different in base and source, copy 007 from source to base as new field (2x)
// Test 05: If 007/00-01 are the same, keep existing field 007 in base (2x)

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^007$/u);
  const sourceFields = source.get(/^007$/u);

  if (checkIdenticalness(baseFields, sourceFields) === true) {
    return base;
  }

  return mergeField007();

  function mergeField007() {
    // ### Toimii myös tähän suuntaan, mutta onko näillä käytännössä jotain eroa?
    // ### if (baseFields.every(baseField => sourceFields.some(sourceField => copyField(baseField, sourceField)))) {
    if (sourceFields.every(sourceField => baseFields.some(baseField => copyField(baseField, sourceField)))) {
      const addToBase = sourceFields.filter(field => !base.containsFieldWithValue(field.tag, field.value));
      addToBase.forEach(field => base.insertField(field));
      addToBase.forEach(field => debug(`Copying source field ${field.tag} to base`));
      return base;
    }
    function copyField(baseField, sourceField) {
      debug(`### bf 0: ${baseField.value[0]}`);
      debug(`### bf 1: ${baseField.value[1]}`);
      debug(`### sf 0: ${sourceField.value[0]}`);
      debug(`### sf 1: ${sourceField.value[1]}`);

      // Copy source field if source 007/00 and/or 007/01 are different from base
      if (baseField.value[0] !== sourceField.value[0] || baseField.value[1] !== sourceField.value[1]) {
        debug(`### copyField true`);
        return true;
      }
      // If 007/00 and 01 are identical, keep base field
      debug(`### copyField false`);
      debug(`Keeping base field ${baseField.tag}`);
      return false;
    }
    return base;
  }
}
