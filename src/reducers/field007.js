import createDebugLogger from 'debug';

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^007$/);
  const sourceFields = source.get(/^007$/);
  debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  debug(`base.leader: ${base.leader}`);
  debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);
  debug(`source.leader: ${source.leader}`);

  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // Test 04: Copy field 007 from source if 007/00-01 are the same in base and source
  if (baseField.value[0] === sourceField.value[0] && baseField.value[1] === sourceField.value[1]) {
      debug(`Copying field ${sourceField.tag} from source`);
      base.insertField(sourceField);
      return base;
  }
  // Test 05: Otherwise keep existing field 007
  debug(`Keeping base field ${baseField.tag}`);
  return base;
}
