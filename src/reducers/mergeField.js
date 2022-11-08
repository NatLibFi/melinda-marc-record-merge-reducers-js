import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldHasSubfield, fieldToString, fieldsAreIdentical, nvdebug} from './utils';
import {cloneAndNormalizeField, cloneAndRemovePunctuation} from './normalize';
import {mergeOrAddSubfield} from './mergeOrAddSubfield';
import {mergeIndicators} from './mergeIndicator';
import {mergableTag} from './mergableTag';
import {getCounterpart} from './counterpartField';
import {default as normalizeEncoding} from '@natlibfi/marc-record-validators-melinda/dist/normalize-utf8-diacritics';
import {postprocessRecords} from './mergePostprocess.js';
import {preprocessBeforeAdd} from './preprocessor.js';

import fs from 'fs';
import path from 'path';

const defaultConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeField');
const debugData = debug.extend('data');

const defCandFieldsRegexp = /^(?:0[1-9][0-9]|[1-9][0-9][0-9]|CAT|LOW|SID)$/u;


// Should this load default configuration?
export default (tagPattern = undefined, config = defaultConfig.mergeConfiguration) => (base, source) => {
  debug(`ENTERING mergeField.js`);
  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  const activeTagPattern = getTagPattern(tagPattern, config);

  debugData(JSON.stringify(baseRecord));
  debugData(JSON.stringify(sourceRecord));
  debug(`MERGE CONFIG: ${JSON.stringify(config)}`);

  normalizeEncoding().fix(baseRecord);
  normalizeEncoding().fix(sourceRecord);

  preprocessBeforeAdd(baseRecord, sourceRecord, config.preprocessorDirectives);


  const candidateFields = sourceRecord.get(activeTagPattern);
  //  .filter(field => !isMainOrCorrespondingAddedEntryField(field)); // current handle main entries as well


  candidateFields.forEach(candField => {
    debug(`Now merging (or trying to) field ${fieldToString(candField)}`);
    mergeField(baseRecord, candField, config);
  });

  // Remove deleted fields and field.merged marks:
  postprocessRecords(baseRecord, sourceRecord);

  return {base: baseRecord, source: sourceRecord};
  //return {baseRecord2, sourceRecord2};

  function getTagPattern(tagPattern, config) {
    if (tagPattern) {
      return tagPattern;
    }
    if (config.tagPattern) {
      return config.tagPattern;
    }
    return defCandFieldsRegexp;
  }
};


// NB! Can be do this via config.json?
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
  // (If our prepub normalizations are ok, this should not be needed.
  //  However, it's simple and works well enough, so let's keep it here.)
  if (fieldHasSubfield(baseField, 'g', 'ENNAKKOTIETO.') && !fieldHasSubfield(sourceField, 'g', 'ENNAKKOTIETO.')) { // eslint-disable-line functional/no-conditional-statement
    removeEnnakkotieto(baseField);
    baseField.merged = 1; // eslint-disable-line functional/immutable-data
  }

  mergeIndicators(baseField, sourceField, config);
  // We want to add the incoming subfields without punctuation, and add puctuation later on.
  // (Cloning is harmless, but probably not needed.)
  // NEW: we also drag the normalized version along. It is needed for the merge-or-add decision
  const normalizedSourceField = cloneAndNormalizeField(sourceField); //cloneAndRemovePunctuation(sourceField);
  const strippedSourceField = cloneAndRemovePunctuation(sourceField);

  nvdebug(`  MERGING SUBFIELDS OF '${fieldToString(normalizedSourceField)}'`);

  normalizedSourceField.subfields.forEach((candSubfield, index) => {
    //sourceField.subfields.forEach(candSubfield => {
    const originalValue = fieldToString(baseField);
    mergeOrAddSubfield(baseRecord, baseField, candSubfield, strippedSourceField.subfields[index]); // candSubfield);
    const newValue = fieldToString(baseField);
    if (originalValue !== newValue) { // eslint-disable-line functional/no-conditional-statement
      debug(`  MERGING SUBFIELD '‡${candSubfield.code} ${candSubfield.value}' TO '${originalValue}'`);
      debug(`   RESULT: '${newValue}'`);
      //debug(`   TODO: sort subfields, handle punctuation...`);
    }
    //else { debug(`  mergeOrAddSubfield() did not add '‡${candSubfield.code} ${candSubfield.value}' to '${originalValue}'`); }

  });
}

function skipMergeField(baseRecord, sourceField, config) {
  if (!mergableTag(sourceField.tag, config)) {
    debug(`mergeField(): field '${fieldToString(sourceField)}' listed as skippable!`);
    return true;
  }
  // Skip duplicate field:
  if (baseRecord.fields.some(baseField => fieldsAreIdentical(sourceField, baseField))) {
    debug(`mergeField(): field '${fieldToString(sourceField)}' already exists! No action required!`);
    sourceField.deleted = 1; // eslint-disable-line functional/immutable-data
    return true;
  }

  return false;
}

export function mergeField(baseRecord, sourceField, config) {
  //nvdebug(`mergeField config: ${JSON.stringify(config)}`);
  // skip duplicates and special cases:
  if (skipMergeField(baseRecord, sourceField, config)) {
    debug(`mergeField(): don't merge '${fieldToString(sourceField)}'`);
    return false;
  }

  nvdebug(`mergeField(): Try to merge '${fieldToString(sourceField)}'.`);
  const counterpartField = getCounterpart(baseRecord, sourceField, config);

  if (counterpartField) {
    debug(`mergeField(): Got counterpart: '${fieldToString(counterpartField)}'. Thus try merge...`);
    mergeField2(baseRecord, counterpartField, sourceField, config);
    sourceField.deleted = 1; // eslint-disable-line functional/immutable-data
    return true;
  }
  // NB! Counterpartless field is inserted to 7XX even if field.tag says 1XX:
  debug(`mergeField(): No mergable counterpart found for '${fieldToString(sourceField)}'.`);
  return false;
}

