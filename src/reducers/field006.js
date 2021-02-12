import createDebugLogger from 'debug';
import {getTagString, checkIdenticalness} from './utils.js';

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^006$/u);
  const sourceFields = source.get(/^006$/u);
  const tagString = getTagString(baseFields, sourceFields);
  debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  debug(`base.leader: ${base.leader}`);
  debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);
  debug(`source.leader: ${source.leader}`);

  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  if (checkIdenticalness(baseFields, sourceFields, tagString) === true) {
    return base;
  }

  // Test 02: If Leader 000/06 is 'o' or 'p' in source, copy 006 from source to base as new field
  if (source.leader[6] === 'o' || source.leader[6] === 'p') {
    debug(`Copying field ${sourceField.tag} from source to Melinda`);
    base.insertField(sourceField);
    return base;
  }
  // Test 03: If Leader 000/06 is something else, do nothing
  debug(`Keeping Melinda field ${baseField.tag}`);
  return base;
};
