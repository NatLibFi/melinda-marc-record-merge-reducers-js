//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldIsRepeatable, fieldToString, nvdebug} from './utils';

import {MarcRecord} from '@natlibfi/marc-record';
import {postprocessRecords} from './mergeOrAddPostprocess.js';
import {preprocessBeforeAdd} from './processFilter.js';
import fs from 'fs';
import path from 'path';
import {isValidSubfield6} from './subfield6Utils';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const defaultConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:addField');
const debugData = debug.extend('data');

// Default list of (repeatable) fields that we don't copy if the field is already present in the base record
//const defaultDoNotCopyIfFieldPresentRegexp = /^(?:041|260|264|300|310|321|335|336|337|338)/u;

const defCandFieldsRegexp = /^(?:0[1-9][0-9]|[1-9][0-9][0-9]|CAT|LOW|SID)$/u;

export default (config = defaultConfig.addConfiguration) => (base, source) => {

  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  debugData(`Base: ${JSON.stringify(base)}`);
  debugData(`Source: ${JSON.stringify(source)}`);

  debug(`CONFIG: ${JSON.stringify(config.preprocessorDirectives)}`);
  // There are bunch of rules we want to apply after field merge and before field add.
  // They are run here.
  preprocessBeforeAdd(baseRecord, sourceRecord, config.preprocessorDirectives);

  // NR fields are removed from source if they can not be added to base.
  removeNonRepeatableDataFieldsFromSourceIfFieldExistsInBase(baseRecord, sourceRecord);

  const activeTagPattern = getTagPattern(config);
  debug(`TAG PATTERN: ${JSON.stringify(activeTagPattern)}`);
  const candidateFields = sourceRecord.get(activeTagPattern);
  //  .filter(field => !isMainOrCorrespondingAddedEntryField(field)); // current handle main entries as well

  candidateFields.forEach(candField => {
    nvdebug(`add field: Now processing ${fieldToString(candField)}`, debug);
    addField(baseRecord, candField, config);
  });

  postprocessRecords(baseRecord, sourceRecord);

  debugData(`Base after addField: ${JSON.stringify(baseRecord)}`);
  debugData(`Source after addField: ${JSON.stringify(sourceRecord)}`);


  return {base: baseRecord, source: sourceRecord};

  function getTagPattern(config) {
    if (config.tagPattern) {
      return config.tagPattern;
    }
    return defCandFieldsRegexp;
  }
};

function removeNonRepeatableDataFieldsFromSourceIfFieldExistsInBase(base, source) {
  source.fields = source.fields.filter(f => keepField(f)); // eslint-disable-line functional/immutable-data

  function keepField(field) {
    if (!field.subfields) {
      return true;
    }

    if (repetitionBlocksAdding(base, field)) {
      nvdebug(`Drop field ${fieldToString(field)}`);
      return false;
    }
    return true;
  }
}


function recordHasOriginalFieldWithTag(record, tag) {
  const candidateFields = record.get(new RegExp(`^${tag}$`, 'u'));
  // Only original fields matter here Added fields are not counted.
  return candidateFields.some(field => !field.added);
}


function repetitionBlocksAdding(record, field) {
  const {tag} = field;
  // It's not a repetition:
  if (!recordHasOriginalFieldWithTag(record, tag)) {
    return false;
  }

  // Non-repeatable marc field:
  // NB! config.doNotCopyIfFieldPresent does not override this (as of 2022-08-10):
  if (!fieldIsRepeatable(tag)) {
    return true; // blocked
  }

  if (tag === '880') {
    const subfield = field.subfields.find(sf => isValidSubfield6(sf));
    if (subfield) {
      const tag = subfield.value.substring(0, 3);
      return !fieldIsRepeatable(tag);
    }
  }

  return false;
}


function skipAddField(record, field) {
  // - Non-addable NR fields have already been removed from source.
  // - Add also duplicates. Postprocessing removes them. Not this files problem.
  // - Repeatable (R) fields (26X, 33X...) we don't want to add already handle (through config file)

  // Syntactic crap is handled here:
  if (field.subfields && field.subfields.length === 0) {
    nvdebug(`WARNING or ERROR: No subfields in field-to-add`, debug);
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
  if (skipAddField(record, field, config)) { // syntactic crap or something else we don't like
    nvdebug(`addField(): don't add '${fieldToString(field)}'`, debug);
    return false;
  }

  // Normal situation: marc field as deleted from source
  const newField = cloneAddableField(field, config); // clone for base + set field.added = 1
  field.deleted = 1; // eslint-disable-line functional/immutable-data

  nvdebug(`ADD NEW FIELD: '${fieldToString(field)}'`, debug);
  // NB! We don't we sort subfields in added fields.
  return record.insertField(newField);
}
