//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
//import {fieldHasSubfield, fieldIsRepeatable, fieldToString, fieldsAreIdentical, nvdebug, recordHasField} from './utils';

import {fieldIsRepeatable, fieldToString, fieldsAreIdentical, nvdebug} from './utils';

import {MarcRecord} from '@natlibfi/marc-record';
import {postprocessRecord} from './mergePostprocess.js';
import {preprocessBeforeAdd} from './hardcodedSourcePreprocessor.js';
import fs from 'fs';
import path from 'path';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const defaultConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:addField');

// Default list of (repeatable) fields that we don't copy if the field is already present in the base record
//const defaultDoNotCopyIfFieldPresentRegexp = /^(?:041|260|264|300|310|321|335|336|337|338)/u;

const defCandFieldsRegexp = /^(?:0[1-9][0-9]|[1-9][0-9][0-9]|CAT|LOW|SID)$/u;

export default (config = defaultConfig.addConfiguration) => (base, source) => {

  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  nvdebug(`CONFIG: ${JSON.stringify(config.preprocessorDirectives)}`);
  // There are bunch of rules we want to apply after field merge and before field add.
  // They are run here.
  preprocessBeforeAdd(baseRecord, sourceRecord, config.preprocessorDirectives);

  const activeTagPattern = getTagPattern(config);
  nvdebug(`TAG PATTERN: ${JSON.stringify(activeTagPattern)}`);
  const candidateFields = sourceRecord.get(activeTagPattern);
  //  .filter(field => !isMainOrCorrespondingAddedEntryField(field)); // current handle main entries as well

  candidateFields.forEach(candField => {
    nvdebug(`add field: Now processing ${fieldToString(candField)}`, debug);
    addField(baseRecord, candField, config);
  });

  postprocessRecord(baseRecord);
  postprocessRecord(sourceRecord);

  return {base: baseRecord, source: sourceRecord};

  function getTagPattern(config) {
    if (config.tagPattern) {
      return config.tagPattern;
    }
    return defCandFieldsRegexp;
  }
};


/*
function getConfigDoNotCopyIfFieldPresentAsRegexp(config) {
  if (config.doNotCopyIfFieldPresent) {
    nvdebug(`Regexpify: '${config.doNotCopyIfFieldPresent}'`);
    return new RegExp(`^${config.doNotCopyIfFieldPresent}`, 'u');
  }
  return undefined;
}
*/

function recordHasOriginalFieldWithTag(record, tag) {
  const candidateFields = record.get(new RegExp(`^${tag}$`, 'u'));
  // Only original fields matter here Added fields are not counted.
  return candidateFields.some(field => !field.added);
}


function repetitionBlocksAdding(record, tag) {
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
  /*
  const configRegexp = getConfigDoNotCopyIfFieldPresentAsRegexp(config);
  if (configRegexp) {
    return tag.match(configRegexp);
  }
  */

  // Some of the fields are repeatable as per Marc21 specs, but we still don't want to multiple instances of the tag.
  // The original listing is from https://workgroups.helsinki.fi/x/K1ohCw .
  // However, we might have deviated from the specs.
  //return tag.match(defaultDoNotCopyIfFieldPresentRegexp);
  return false;
}

function skipAddField(record, field) {
  if (repetitionBlocksAdding(record, field.tag)) {
    nvdebug(`Unrepeatable field already exists. Failed to add '${fieldToString(field)}'.`, debug);
    return true;
  }

  // We could block 260/264 pairs here.

  // Skip duplicate field (Should we have something like config.forceAdd):
  if (record.fields.some(baseField => fieldsAreIdentical(field, baseField))) {
    //debug(`addField(): field '${fieldToString(field)}' already exists! No action required!`);
    return true;
  }

  // NB! Subfieldless fields (and control fields (00X)) are not handled here.
  if (field.subfields.length === 0) {
    debug(`WARNING or ERROR: No subfields in field-to-add`);
    return true;
  }

  return false;
}

function cloneAddableField(field) {
  // mark it as coming from source:
  field.added = 1; // eslint-disable-line functional/immutable-data
  return JSON.parse(JSON.stringify(field));
}


export function addField(record, field, config = {}) {
  // Skip duplicates and special cases:
  if (skipAddField(record, field, config)) {
    nvdebug(`addField(): don't add '${fieldToString(field)}'`, debug);
    return false;
  }

  // Normal situation: marc field as deleted from source
  const newField = cloneAddableField(field, config); // clone for base + set field.added = 1
  field.deleted = 1; // eslint-disable-line functional/immutable-data

  nvdebug(`Add as ${fieldToString(field)}`, debug);
  // NB! We don't we sort subfields in added fields.
  return record.insertField(newField);
}
