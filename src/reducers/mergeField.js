//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldHasSubfield, fieldToString, fieldsAreIdentical, nvdebug} from './utils';
import {cloneAndRemovePunctuation} from './normalize';
import {cloneAndPreprocessField} from './mergePreAndPostprocess';
import {mergeSubfield} from './mergeSubfield';
import {mergeIndicators} from './compareIndicators';
import {mergableTag} from './mergableTag';
import {getCounterpart} from './counterpartField';
import {MarcRecord} from '@natlibfi/marc-record';
import {initFieldMergeConfig} from './fieldMergeConfig.js';
import {recordPreprocess, sourceRecordPreprocess} from './normalize.js';
import {addField} from './addField.js';
import {postprocessRecord} from './mergePreAndPostprocess.js';

//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeField');

export default (config = {}) => (base, source) => {

  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  nvdebug(`OBJ: ${JSON.stringify(config)}`);
  // How do we read the config? Config file? Parameters from calling function? Currently this just sets the defaults...
  const processedConfig = initFieldMergeConfig(config);

  // We should clone the records here and just here...
  const baseRecord2 = recordPreprocess(baseRecord); // fix composition et al
  const sourceRecord2 = sourceRecordPreprocess(baseRecord, recordPreprocess(sourceRecord)); // fix composition et al

  const defCandFieldsRegexp = /^(?:0[1-9][0-9]|[1-9][0-9][0-9]|CAT|LOW|SID)$/u;

  const candidateFields = sourceRecord2.get(processedConfig.tagPattern ? processedConfig.tagPattern : defCandFieldsRegexp);
  //  .filter(field => !isMainOrCorrespondingAddedEntryField(field)); // current handle main entries as well

  candidateFields.forEach(candField => {
    nvdebug(`Now processing ${fieldToString(candField)}`, debug);
    if (!mergeField(baseRecord2, candField, processedConfig)) { // eslint-disable-line functional/no-conditional-statement
      addField(baseRecord2, candField, processedConfig);
    }
  });

  postprocessRecord(baseRecord2);
  postprocessRecord(sourceRecord2);

  return [baseRecord2, sourceRecord2];
};

function removeEnnakkotieto(field) {
  const tmp = field.subfields.filter(subfield => subfield.code !== 'g' || subfield.value !== 'ENNAKKOTIETO.');
  // remove only iff some other subfield remains
  if (tmp.length > 0) { // eslint-disable-line functional/no-conditional-statement
    field.subfields = tmp; // eslint-disable-line functional/immutable-data
  }
}


function mergeField2(baseRecord, baseField, sourceField, config) {
  //// Identical fields
  // No need to check every subfield separately.
  // Also no need to postprocess the resulting field.
  if (fieldToString(baseField) === fieldToString(sourceField)) {
    return baseRecord;
  }

  // If a base ennakkotieto is merged with real data, remove ennakkotieto subfield:
  if (fieldHasSubfield(baseField, 'g', 'ENNAKKOTIETO.') && !fieldHasSubfield(sourceField, 'g', 'ENNAKKOTIETO.')) { // eslint-disable-line functional/no-conditional-statement
    removeEnnakkotieto(baseField);
    baseField.merged = 1; // eslint-disable-line functional/immutable-data
  }

  mergeIndicators(baseField, sourceField, config);
  // We want to add the incoming subfields without punctuation, and add puctuation later on.
  // (Cloning is harmless, but probably not needed.)
  const normalizedSourceField = cloneAndRemovePunctuation(sourceField);
  nvdebug(`  MERGING SUBFIELDS OF '${fieldToString(normalizedSourceField)}'`, debug);

  normalizedSourceField.subfields.forEach(candSubfield => {
    //sourceField.subfields.forEach(candSubfield => {
    const originalValue = fieldToString(baseField);
    mergeSubfield(baseRecord, baseField, candSubfield);
    const newValue = fieldToString(baseField);
    if (originalValue !== newValue) { // eslint-disable-line functional/no-conditional-statement
      debug(`  MERGING SUBFIELD '‡${candSubfield.code} ${candSubfield.value}' TO '${originalValue}'`);
      debug(`   RESULT: '${newValue}'`);
      //debug(`   TODO: sort subfields, handle punctuation...`);
    }
    //else { debug(`  mergeSubfield() did not add '‡${candSubfield.code} ${candSubfield.value}' to '${originalValue}'`); }

  });
}


function skipMergeField(baseRecord, sourceField, config) {
  if (!mergableTag(sourceField.tag, config)) {
    nvdebug(`mergeField(): field '${fieldToString(sourceField)}' listed as skippable!`, debug);
    return true;
  }
  // Skip duplicate field:
  if (baseRecord.fields.some(baseField => fieldsAreIdentical(sourceField, baseField))) {
    nvdebug(`mergeField(): field '${fieldToString(sourceField)}' already exists! No action required!`, debug);
    sourceField.deleted = 1; // eslint-disable-line functional/immutable-data
    return true;
  }

  return false;
}

export function mergeField(baseRecord, sourceField, config) {
  const newField = cloneAndPreprocessField(sourceField, config); // probably unnecessary cloning, but safer this way

  // skip duplicates and special cases:
  if (skipMergeField(baseRecord, newField, config)) {
    nvdebug(`mergeField(): don't merge '${fieldToString(sourceField)}'`, debug);
    return false;
  }
  nvdebug(`mergeField(): Try to merge '${fieldToString(sourceField)}'.`, debug);
  const counterpartField = getCounterpart(baseRecord, newField, config);

  if (counterpartField) {
    nvdebug(`mergeField(): Got counterpart: '${fieldToString(counterpartField)}'. Thus try merge...`, debug);
    mergeField2(baseRecord, counterpartField, newField, config);
    sourceField.deleted = 1; // eslint-disable-line functional/immutable-data
    return true;
  }
  // NB! Counterpartless field is inserted to 7XX even if field.tag says 1XX:
  nvdebug(`mergeField(): No mergable counterpart found for '${fieldToString(sourceField)}'.`, debug);
  return false;
}
