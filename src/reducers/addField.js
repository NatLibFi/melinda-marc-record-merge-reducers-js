//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
//import {fieldHasSubfield, fieldIsRepeatable, fieldToString, fieldsAreIdentical, nvdebug, recordHasField} from './utils';

import {fieldIsRepeatable, fieldToString, fieldsAreIdentical, nvdebug} from './utils';

import {isSubfieldGoodForMerge} from './mergeSubfield';

import {MarcRecord} from '@natlibfi/marc-record';
import {initFieldMergeConfig} from './fieldMergeConfig.js';
import {postprocessRecord} from './mergePreAndPostprocess.js';
import {recordPreprocess/*, sourceRecordPreprocess*/} from './hardcodedPreprocessor.js';

//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:addField');

// Default list of (repeatable) fields that we don't copy if the field is already present in the base record
const defaultDoNotCopyIfFieldPresentRegexp = /^(?:041|260|264|300|310|321|335|336|337|338)/u;

export default (config = {}) => (base, source) => {

  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  //nvdebug(`OBJ: ${JSON.stringify(config)}`);
  // How do we read the config? Config file? Parameters from calling function? Currently this just sets the defaults...
  const processedConfig = initFieldMergeConfig(config);

  // We should clone the records here and just here...
  const baseRecord2 = recordPreprocess(baseRecord); // fix composition et al
  const sourceRecord2 = recordPreprocess(sourceRecord); // fix composition et al

  const defCandFieldsRegexp = /^(?:0[1-9][0-9]|[1-9][0-9][0-9]|CAT|LOW|SID)$/u;

  const candidateFields = sourceRecord2.get(processedConfig.tagPattern ? processedConfig.tagPattern : defCandFieldsRegexp);
  //  .filter(field => !isMainOrCorrespondingAddedEntryField(field)); // current handle main entries as well

  candidateFields.forEach(candField => {
    nvdebug(`add field: Now processing ${fieldToString(candField)}`, debug);
    addField(baseRecord2, candField, processedConfig);
  });

  postprocessRecord(baseRecord2);
  postprocessRecord(sourceRecord2);

  return [baseRecord2, sourceRecord2];
};

function getConfigDoNotCopyIfFieldPresentAsRegexp(config) {
  if (config.doNotCopyIfFieldPresent) {
    nvdebug(`Regexpify: '${config.doNotCopyIfFieldPresent}'`);
    return new RegExp(`^${config.doNotCopyIfFieldPresent}`, 'u');
  }
  return undefined;
}

function recordHasOriginalFieldWithTag(record, tag) {
  const candidateFields = record.get(new RegExp(`^${tag}$`, 'u'));
  // Only original fields matter here Added fields are not counted.
  return candidateFields.some(field => !field.added);
}

/*
function repeatableTagIsNonAddable(record, tag, config) {
  // NB! DO WE WAN'T TO OVERRIDE THESE VIA CONFIG? Can't think of a case, so not implementing support for that.
  if (tag.match(getNonAddableRegexp(config))) {
    return recordHasOriginalFieldWithTag(record, tag);
  }

  // No reason to block:
  return false;

  function getNonAddableRegexp(config) {
    const configRegexp = getConfigDoNotCopyIfFieldPresentRegexp(config);
    return configRegexp ? configRegexp : defaultDoNotCopyIfFieldPresentRegexp;
  }
}
*/

function repetitionBlocksAdding(record, tag, config) {
  // It's not a repetition:
  if (!recordHasOriginalFieldWithTag(record, tag)) {
    return false;
  }

  // Non-repeatable marc field:
  // NB! config.doNotCopyIfFieldPresent does not override this (as of 2022-08-10):
  if (!fieldIsRepeatable(tag)) {
    return true; // blocked
  }

  // config.doNotCopyIfFieldPresent  overrides only default regexp of repeatable tags
  const configRegexp = getConfigDoNotCopyIfFieldPresentAsRegexp(config);
  if (configRegexp) {
    return tag.match(configRegexp);
  }

  // Some of the fields are repeatable as per Marc21 specs, but we still don't want to multiple instances of the tag.
  // The original listing is from https://workgroups.helsinki.fi/x/K1ohCw .
  // However, we might have deviated from the specs.
  return tag.match(defaultDoNotCopyIfFieldPresentRegexp);
}

function skipAddField(record, field, config = {}) {
  if (repetitionBlocksAdding(record, field.tag, config)) {
    nvdebug(`Unrepeatable field already exists. Failed to add '${fieldToString(field)}'.`, debug);
    return true;
  }

  // https://workgroups.helsinki.fi/pages/viewpage.action?pageId=186735147#MARCkenttienk%C3%A4sittelykoodissa-240-kentt%C3%A4.1
  // NB! NB! Fields 240&830: these hacks are required by specs. But should these be configured?
  // NB! 240 is non-repeatable, so there no need to check the presence of a base-240 field separately.
  /* // handled by configuration nowadays
  if (field.tag === '240' && recordHasField(record, '130')) {
    return true;
  }
  */

  // Handled by configuration
  /*
  if (field.tag === '830' && !fieldHasSubfield(field, 'x')) {
    return true;
  }
  */

  // We could block 260/264 pairs here.

  // Skip duplicate field (Should we have something like config.forceAdd):
  if (record.fields.some(baseField => fieldsAreIdentical(field, baseField))) {
    //debug(`addField(): field '${fieldToString(field)}' already exists! No action required!`);
    return true;
  }

  return false;
}


function cloneField(field) {
  // mark it as coming from source:
  field.added = 1; // eslint-disable-line functional/immutable-data
  return JSON.parse(JSON.stringify(field));
}


function addField2(record, field) {
  // NB! Some subfields are never added. Strip them.
  field.subfields = field.subfields.filter(sf => isSubfieldGoodForMerge(field.tag, sf.code)); // eslint-disable-line functional/immutable-data

  // NB! Subfieldless fields (and control fields (00X)) are not handled here.
  if (field.subfields.length === 0) {
    debug(`ERROR: No subfields in field-to-add`);
    return record;
  }
  nvdebug(`Add as ${fieldToString(field)}`, debug);
  // Do we need to sort unmerged subfields?
  //return record.insertField(sortAdjacentSubfields(field));
  return record.insertField(field);
}

export function addField(record, field, config = {}) {
  // skip duplicates and special cases:
  if (skipAddField(record, field, config)) {
    nvdebug(`addField(): don't add '${fieldToString(field)}'`, debug);
    return false;
  }

  const newField = cloneField(field, config); // clone for base+ field.added = 1
  field.deleted = 1; // eslint-disable-line functional/immutable-data

  nvdebug(`addField(): Try to add '${fieldToString(field)}'.`, debug);
  return addField2(record, newField);
}
