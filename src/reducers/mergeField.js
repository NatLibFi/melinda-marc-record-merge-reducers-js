//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldHasSubfield, fieldToString, fieldsAreIdentical, nvdebug, hasCopyright, removeCopyright} from './utils';
import {cloneAndNormalizeField, cloneAndRemovePunctuation} from './normalize';
import {mergeOrAddSubfield} from './mergeOrAddSubfield';
import {mergeIndicators} from './mergeIndicator';
import {mergableTag} from './mergableTag';
import {getCounterpart} from './counterpartField';
import {default as normalizeEncoding} from '@natlibfi/marc-record-validators-melinda/dist/normalize-utf8-diacritics';
import {postprocessRecords} from './mergeOrAddPostprocess.js';
import {preprocessBeforeAdd} from './processFilter.js';

import fs from 'fs';
import path from 'path';
import {fieldGetSubfield6Pair} from './subfield6Utils';

const defaultConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeField');
//const debugData = debug.extend('data');

const defCandFieldsRegexp = /^(?:0[1-9][0-9]|[1-9][0-9][0-9]|CAT|LOW|SID)$/u;


// Should this load default configuration?
//export default (tagPattern = undefined, config = defaultConfig.mergeConfiguration) => (base, source) => {
export default (tagPattern = undefined, config = defaultConfig.mergeConfiguration) => (baseRecord, sourceRecord) => {
  nvdebug(`ENTERING mergeField.js`, debug);
  //const baseRecord = new MarcRecord(base, {subfieldValues: false});
  //const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  const activeTagPattern = getTagPattern(tagPattern, config);

  //debugData(JSON.stringify(baseRecord));
  //debugData(JSON.stringify(sourceRecord));

  sourceRecord.fields.forEach(f => nvdebug(`SRC1: ${fieldToString(f)}`));

  nvdebug(`MERGE CONFIG: ${JSON.stringify(config)}`, debug);

  normalizeEncoding().fix(baseRecord);
  normalizeEncoding().fix(sourceRecord);

  preprocessBeforeAdd(baseRecord, sourceRecord, config.preprocessorDirectives);


  sourceRecord.fields.forEach(f => nvdebug(`SRC2: ${fieldToString(f)}`));

  const candidateFields = sourceRecord.get(activeTagPattern);
  //  .filter(field => !isMainOrCorrespondingAddedEntryField(field)); // current handle main entries as well


  candidateFields.forEach(candField => {
    debug(`Now merging (or trying to) field ${fieldToString(candField)}`);
    // If $6 is merged from 700 to 100, the corresponding 880 field will change!
    const candFieldPair880 = candField.tag === '880' ? undefined : fieldGetSubfield6Pair(candField, sourceRecord);
    nvdebug(`SELF: ${fieldToString(candField)}`);
    nvdebug(`PAIR: ${candFieldPair880 ? fieldToString(candFieldPair880) : 'NADA'}`);
    mergeField(baseRecord, candField, config, candFieldPair880);
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


function copyrightYearHack(baseRecord, baseField, sourceField) {
  if (baseField.tag !== '264' || sourceField.tag !== '260') {
    return;
  }
  const relevantSubfields = sourceField.subfields.filter(sf => sf.code === 'c' && hasCopyright(sf.value));

  relevantSubfields.forEach(sf => {
    // Add new:
    const value = sf.value.replace(/\.$/u, '');
    baseRecord.insertField({'tag': '264', 'ind1': ' ', 'ind2': '4', 'subfields': [{'code': 'c', value}]});
    // Modify original subfield:
    sf.value = removeCopyright(sf.value); // eslint-disable-line functional/immutable-data
  });
}

function mergeField2(baseRecord, baseField, sourceField, config, candFieldPair880 = undefined) {
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

  copyrightYearHack(baseRecord, baseField, sourceField);

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
    //const sf8Pair = candSubfield.code === '6' && sourceField.tag === '880' ? fieldGetSubfield6Pair(sourceField)
    mergeOrAddSubfield(baseField, candSubfield, strippedSourceField.subfields[index], candFieldPair880); // candSubfield);
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
    debug(`skipMergeField(): field '${fieldToString(sourceField)}' listed as skippable!`);
    return true;
  }

  // Skip duplicate field:
  if (baseRecord.fields.some(baseField => fieldsAreIdentical(sourceField, baseField))) {
    debug(`skipMergeField(): field '${fieldToString(sourceField)}' already exists! No merge required!`);
    sourceField.deleted = 1; // eslint-disable-line functional/immutable-data
    return true;
  }

  return false;
}

export function mergeField(baseRecord, sourceField, config, candFieldPair880 = undefined) {
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
    mergeField2(baseRecord, counterpartField, sourceField, config, candFieldPair880);
    sourceField.deleted = 1; // eslint-disable-line functional/immutable-data
    return true;
  }
  // NB! Counterpartless field is inserted to 7XX even if field.tag says 1XX:
  debug(`mergeField(): No mergable counterpart found for '${fieldToString(sourceField)}'.`);
  return false;
}

