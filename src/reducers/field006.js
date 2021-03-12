import createDebugLogger from 'debug';
import {checkIdenticalness} from './utils.js';

// Test 02: If Leader 000/06 is 'o' or 'p' in source, copy 006 from source to base as new field (2x)
// Test 03: If Leader 000/06 is something else, do nothing

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^006$/u);
  const sourceFields = source.get(/^006$/u);

  if (checkIdenticalness(baseFields, sourceFields) === true) {
    return base;
  }

  if (source.leader[6] === 'o' || source.leader[6] === 'p') {
    const addToBase = sourceFields.filter(field => !base.containsFieldWithValue(field.tag, field.value));
    addToBase.forEach(field => base.insertField(field));
    addToBase.forEach(field => debug(`Copying source field ${field.tag} to base`));
    return base;
  }
  debug(`Keeping base field 006`);
  return base;
}
