import createDebugLogger from 'debug';

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^007$/u);
  const sourceFields = source.get(/^007$/u);
  debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  debug(`base.leader: ${base.leader}`);
  debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);
  debug(`source.leader: ${source.leader}`);

  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // Test 04: If 007/00-01 are different in base and source, copy 007 from source to base as new field
  debug(`base 0: ${baseField.value[0]}`);
  debug(`base 1: ${baseField.value[1]}`);
  debug(`source 0: ${sourceField.value[0]}`);
  debug(`source 1: ${sourceField.value[1]}`);
  if (baseField.value[0] !== sourceField.value[0] || baseField.value[1] !== sourceField.value[1]) {
    debug(`Copying field ${sourceField.tag} from source`);
    base.insertField(sourceField);
    return base;
  }
  // Test 05: If 007/00-01 are the same, keep existing field 007 in base
  debug(`Keeping Melinda field ${baseField.tag}`);
  return base;
};
