import createDebugLogger from 'debug';
import {checkIdenticalness} from './utils.js';

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^008$/u);
  const sourceFields = source.get(/^008$/u);

  // Field 008 is non-repeatable
  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }

  // First check that these character positions are the same in source and base:
  // 008/07-10 (year of publication), 008/15-17 (country), 008/35-37 (language)
  // Then select the 008 field from the record with the higher base level code

  const basePubYear = baseField.value.slice(7, 11);
  const baseLanguage = baseField.value.slice(35, 38);
  const baseCountry = baseField.value.slice(15, 18);
  const sourcePubYear = sourceField.value.slice(7, 11);
  const sourceCountry = sourceField.value.slice(15, 18);
  const sourceLanguage = sourceField.value.slice(35, 38);

  if (basePubYear === sourcePubYear && baseCountry === sourceCountry && baseLanguage === sourceLanguage) {
    // Test 06: If the level code of the source record is better (smaller number)
    // Replace base field 008 with field 008 from source
    if (getLevelCode(source) < getLevelCode(base)) {
      replaceBasefieldWithSourcefield(base);
      return base;
    }
  }
  // Test 07: If the level code of the base record is better or the same, keep existing 008
  // Test 08: If the character positions are not the same, keep existing 008
  debug(`Keeping base field ${baseField.tag}`);
  return base;

  function replaceBasefieldWithSourcefield(base) {
    const index = base.fields.findIndex(field => field === baseField);
    base.fields.splice(index, 1, sourceField); // eslint-disable-line functional/immutable-data
    debug(`Replacing base field ${baseField.tag} with source`);
    return base;
  }

  function getLevelCode(field) {
    // base record level codes from highest (1) to lowest (10)
    // levelValue = value of 000/17
    // levelCode 1 is given if the value is either empty ' ' (space) or '^', depending on where the record comes from
    const levelCodes = [
      {levelCode: 1, levelValue: ' '},
      {levelCode: 1, levelValue: '^'},
      {levelCode: 2, levelValue: '4'},
      {levelCode: 3, levelValue: '1'},
      {levelCode: 4, levelValue: '5'},
      {levelCode: 5, levelValue: '7'},
      {levelCode: 6, levelValue: '2'},
      {levelCode: 7, levelValue: '3'},
      {levelCode: 8, levelValue: '8'},
      {levelCode: 9, levelValue: 'u'},
      {levelCode: 10, levelValue: 'z'}
    ];
    return levelCodes.filter(level => level.levelValue === field.leader[17])[0].levelCode;
  }
};
