import createDebugLogger from 'debug';

export default ({tagPattern}) => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(tagPattern);
  const sourceFields = source.get(tagPattern);
  debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  debug(`base.leader: ${base.leader}`);
  debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);
  debug(`source.leader: ${source.leader}`);

  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // First check that these character positions are the same in source and base:
  // 008/07-10 (year of publication), 008/15-17 (country), 008/35-37 (language)
  // Then select the 008 field from the record with the higher Melinda level code

  const basePubYear = baseField.value.slice(7, 11);
  const baseLanguage = baseField.value.slice(35, 38);
  const baseCountry = baseField.value.slice(15, 18);
  const sourcePubYear = sourceField.value.slice(7, 11);
  const sourceCountry = sourceField.value.slice(15, 18);
  const sourceLanguage = sourceField.value.slice(35, 38);

  if (basePubYear === sourcePubYear && baseCountry === sourceCountry && baseLanguage === sourceLanguage) {
    // Test 06: Source level code is better (smaller number)
    if (getLevelCode(source) < getLevelCode(base)) {
        replaceBasefieldWithSourcefield(base)
        return base;
    }
  }
  // Test 07: Base level code is better or the same
  // Test 08: If the character positions are not the same, keep existing field 008
  debug(`Keeping base field ${baseField.tag}`);
  return base;

  function replaceBasefieldWithSourcefield(base) {
    const index = base.fields.findIndex(field => field === baseField);
    base.fields.splice(index, 1, sourceField); // eslint-disable-line functional/immutable-data
    debug(`Replacing base field ${baseField.tag} with source`);
    return base;
  }

  function getLevelCode(field) {
    // Melinda record level codes from highest (1) to lowest (10)
    // levelValue = value of 000/17
    const levelCodes = [
      {levelCode: 1, levelValue: "#"},
      {levelCode: 2, levelValue: "4"},
      {levelCode: 3, levelValue: "1"},
      {levelCode: 4, levelValue: "5"},
      {levelCode: 5, levelValue: "7"},
      {levelCode: 6, levelValue: "2"},
      {levelCode: 7, levelValue: "3"},
      {levelCode: 8, levelValue: "8"},
      {levelCode: 9, levelValue: "u"},
      {levelCode: 10, levelValue: "z"}
    ];
    const fieldLevelCode = (levelCodes.filter(level => level.levelValue === field.leader[17]))[0].levelCode;
    return fieldLevelCode;
  }
}
