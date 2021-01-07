import createDebugLogger from 'debug';

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^006$/u);
  const sourceFields = source.get(/^006$/u);
  debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  debug(`base.leader: ${base.leader}`);
  debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);
  debug(`source.leader: ${source.leader}`);

  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // Test 02: If field 006 is missing in Melinda, copy it from source if Leader 000/06 is 'o' or 'p'
  if (baseFields.length === 0 && (source.leader[6] === 'o' || source.leader[6] === 'p')) {
    debug(`Copying field ${sourceField.tag} from source`);
    base.insertField(sourceField);
    return base;
  }
  // Test 03: If field 006 exists in Melinda, keep it
  debug(`Keeping base field ${baseField.tag}`);
  return base;
};
