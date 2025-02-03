//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldToString, nvdebug} from './utils';
import {default as normalizeEncoding} from '@natlibfi/marc-record-validators-melinda/dist/normalize-utf8-diacritics';
import {postprocessRecords} from '@natlibfi/marc-record-validators-melinda/dist/merge-fields/mergeOrAddPostprocess';
import {preprocessBeforeAdd} from './processFilter.js';

import fs from 'fs';
import path from 'path';
//import {fieldGetOccurrenceNumberPairs} from '@natlibfi/marc-record-validators-melinda/dist/subfield6Utils.js';
//import {fieldsToString} from '@natlibfi/marc-record-validators-melinda/dist/utils';
import {mergeField} from '@natlibfi/marc-record-validators-melinda/dist/merge-fields/mergeField.js';
const defaultConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeField');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

const defCandFieldsRegexp = /^(?:0[1-9][0-9]|[1-9][0-9][0-9]|CAT|LOW|SID)$/u;


// Should this load default configuration?
//export default (tagPattern = undefined, config = defaultConfig.mergeConfiguration) => (base, source) => {
export default (tagPattern = undefined, config = defaultConfig.mergeConfiguration) => (baseRecord, sourceRecord) => {
  nvdebug(`ENTERING mergeField.js`, debugDev);
  //const baseRecord = new MarcRecord(base, {subfieldValues: false});
  //const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  const activeTagPattern = getTagPattern(tagPattern, config);

  nvdebug(JSON.stringify(baseRecord));
  nvdebug(JSON.stringify(sourceRecord));

  sourceRecord.fields.forEach(f => nvdebug(`SRC1: ${fieldToString(f)}`, debugDev));

  //nvdebug(`MERGE CONFIG: ${JSON.stringify(config)}`, debugDev);

  normalizeEncoding().fix(baseRecord);
  normalizeEncoding().fix(sourceRecord);

  preprocessBeforeAdd(baseRecord, sourceRecord, config.preprocessorDirectives);


  sourceRecord.fields.forEach(f => nvdebug(`SRC2: ${fieldToString(f)}`, debugDev));

  const candidateFields = sourceRecord.get(activeTagPattern);
  //  .filter(field => !isMainOrCorrespondingAddedEntryField(field)); // current handle main entries as well


  candidateFields.forEach(candField => {
    nvdebug(`Now merging (or trying to) field ${fieldToString(candField)}`, debug);
    mergeField(baseRecord, sourceRecord, candField, config);
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
