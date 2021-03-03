import createDebugLogger from 'debug';
import {checkIdenticalness} from './utils.js';

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^007$/u);
  const sourceFields = source.get(/^007$/u);

  // ### Tarvitseeko varautua käsittelemään useampaa kenttää?
  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  if (checkIdenticalness(baseFields, sourceFields) === true) {
    return base;
  }

  // Test 04: If 007/00-01 are different in base and source, copy 007 from source to base as new field
  debug(`### base 0: ${baseField.value[0]}`);
  debug(`### base 1: ${baseField.value[1]}`);
  debug(`### source 0: ${sourceField.value[0]}`);
  debug(`### source 1: ${sourceField.value[1]}`);
  if (baseField.value[0] !== sourceField.value[0] || baseField.value[1] !== sourceField.value[1]) {
    debug(`Copying field ${sourceField.tag} from source`);
    base.insertField(sourceField);
    return base;
  }
  // Test 05: If 007/00-01 are the same, keep existing field 007 in base
  debug(`Keeping base field ${baseField.tag}`);
  return base;
};
