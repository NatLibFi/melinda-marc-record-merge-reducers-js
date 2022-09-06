import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {getEncodingLevelRanking, getNonIdenticalFields, recordReplaceField} from './utils.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
const regexp008 = /^008$/u;


function yearLanguageAndCountryAgree(field1, field2) {
  // First check that these character positions are the same in source and base:
  // 008/07-10 (year of publication), 008/15-17 (country), 008/35-37 (language)
  // Then select the 008 field from the record with the higher base level code
  const basePubYear = field1.value.slice(7, 11);
  const baseLanguage = field1.value.slice(35, 38);
  const baseCountry = field1.value.slice(15, 18);
  const sourcePubYear = field2.value.slice(7, 11);
  const sourceCountry = field2.value.slice(15, 18);
  const sourceLanguage = field2.value.slice(35, 38);
  return basePubYear === sourcePubYear && baseCountry === sourceCountry && baseLanguage === sourceLanguage;
}

function requiresModification(baseRecord, sourceRecord) {
  if (getEncodingLevelRanking(baseRecord) <= getEncodingLevelRanking(sourceRecord)) { // smaller is better!
    // The original version is better than or as good as the alternative version.
    return false;
  }

  const baseFields = baseRecord.get(regexp008);
  const sourceFields = sourceRecord.get(regexp008);

  const nonIdenticalFields = getNonIdenticalFields(baseFields, sourceFields);

  if (nonIdenticalFields.length === 0 || sourceFields.length === 0) {
    // debug('Identical fields in source and base');
    return false;
  }
  if (baseFields.length === 0) {
    return true;
  }
  // Field 008 is (or at least it should be) non-repeatable. Examine only the 1st elements:
  return yearLanguageAndCountryAgree(baseFields[0], sourceFields[0]);
}

export default () => (base, source) => {

  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  if (requiresModification(baseRecord, sourceRecord)) {
    const baseFields = baseRecord.get(regexp008);
    const sourceFields = sourceRecord.get(regexp008);
    // Test 06: If the level code of the source record is better (smaller number)
    // Replace base field 008 with field 008 from source
    debug(`Replacing base field ${baseFields[0].tag}`);
    // Field 008 is non-repeatable. This [0] is/should be a safe approach:
    return {base: recordReplaceField(baseRecord, baseFields[0], sourceFields[0]), source};
  }
  // Test 07: If the level code of the base record is better or the same, keep existing 008
  // Test 08: If the character positions for year, language and country are not the same, keep existing 008
  debug('Keeping base field 008');
  return {base, source};
};
