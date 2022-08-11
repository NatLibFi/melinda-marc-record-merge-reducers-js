//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldHasSubfield, fieldToString, fieldsAreIdentical, nvdebug} from './utils';
import {cloneAndRemovePunctuation} from './normalize';
import {cloneAndPreprocessField} from './mergePreAndPostprocess';
import {mergeSubfield} from './mergeSubfield';
import {mergeIndicators} from './compareIndicators';
import {mergableTag} from './mergableTag';
import {getCounterpart} from './counterpartField';

//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeField');

function removeEnnakkotieto(field) {
  const tmp = field.subfields.filter(subfield => subfield.code !== 'g' || subfield.value !== 'ENNAKKOTIETO.');
  // remove only iff some other subfield remains
  if (tmp.length > 0) { // eslint-disable-line functional/no-conditional-statement
    field.subfields = tmp; // eslint-disable-line functional/immutable-data
  }
}


function mergeField2(record, targetField, sourceField, config) {
  //// Identical fields
  // No need to check every subfield separately.
  // Also no need to postprocess the resulting field.
  if (fieldToString(sourceField) === fieldToString(targetField)) {
    return record;
  }

  // If a base ennakkotieto is merged with real data, remove ennakkotieto subfield:
  if (fieldHasSubfield(targetField, 'g', 'ENNAKKOTIETO.') && !fieldHasSubfield(sourceField, 'g', 'ENNAKKOTIETO.')) { // eslint-disable-line functional/no-conditional-statement
    removeEnnakkotieto(targetField);
    targetField.merged = 1; // eslint-disable-line functional/immutable-data
  }

  mergeIndicators(targetField, sourceField, config);
  // We want to add the incoming subfields without punctuation, and add puctuation later on.
  // (Cloning is harmless, but probably not needed.)
  const normalizedSourceField = cloneAndRemovePunctuation(sourceField);
  nvdebug(`  MERGING SUBFIELDS OF '${fieldToString(normalizedSourceField)}'`, debug);

  normalizedSourceField.subfields.forEach(candSubfield => {
    //sourceField.subfields.forEach(candSubfield => {
    const originalValue = fieldToString(targetField);
    mergeSubfield(record, targetField, candSubfield);
    const newValue = fieldToString(targetField);
    if (originalValue !== newValue) { // eslint-disable-line functional/no-conditional-statement
      debug(`  MERGING SUBFIELD '‡${candSubfield.code} ${candSubfield.value}' TO '${originalValue}'`);
      debug(`   RESULT: '${newValue}'`);
      //debug(`   TODO: sort subfields, handle punctuation...`);
    }
    //else { debug(`  mergeSubfield() did not add '‡${candSubfield.code} ${candSubfield.value}' to '${originalValue}'`); }

  });
  return record;
}


function skipMergeField(record, field, config) {
  if (!mergableTag(field.tag, config)) {
    nvdebug(`mergeField(): field '${fieldToString(field)}' listed as skippable!`, debug);
    return true;
  }
  // Skip duplicate field:
  if (record.fields.some(baseField => fieldsAreIdentical(field, baseField))) {
    nvdebug(`mergeField(): field '${fieldToString(field)}' already exists! No action required!`, debug);
    return true;
  }

  return false;
}

export function mergeField(record, field, config) {
  const newField = cloneAndPreprocessField(field, config); // probably unnecessary cloning, but safer this way

  // skip duplicates and special cases:
  if (skipMergeField(record, newField, config)) {
    nvdebug(`mergeField(): don't merge '${fieldToString(field)}'`, debug);
    return false;
  }
  nvdebug(`mergeField(): Try to merge '${fieldToString(field)}'.`, debug);
  const counterpartField = getCounterpart(record, newField, config);

  if (counterpartField) {
    nvdebug(`mergeField(): Got counterpart: '${fieldToString(counterpartField)}'. Thus try merge...`, debug);

    mergeField2(record, counterpartField, newField, config);
    return true;
  }
  // NB! Counterpartless field is inserted to 7XX even if field.tag says 1XX:
  nvdebug(`mergeField(): No mergable counterpart found for '${fieldToString(field)}'.`, debug);
  return false;
}
