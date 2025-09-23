import fs from 'fs';
import path from 'path';

//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldToString, nvdebug} from './utils.js';
import {mergeField, NormalizeUTF8Diacritics, postprocessRecords} from '@natlibfi/marc-record-validators-melinda';
import {preprocessBeforeAdd} from './processFilter.js';
import {resetCorrespondingField880} from './resetField880Subfield6AfterFieldTransfer.js';

const defaultConfig = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

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

  const fixer = NormalizeUTF8Diacritics();
  fixer.fix(baseRecord);
  fixer.fix(sourceRecord);

  retagSource1XX(sourceRecord);
  preprocessBeforeAdd(baseRecord, sourceRecord, config.preprocessorDirectives); // NB! we should rename func, this may have nothing to with add


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

export function retagSource1XX(record) {
  record.fields.forEach(f => retagField(f));

  // NB! 880$6 stuff is nor currently checked...

  function retagField(field) {
    if (['100', '110', '111'].includes(field.tag)) { // 1XX -> 7XX
      const newTag = `7${field.tag.substring(1)}`;
      resetCorrespondingField880(field, record, newTag);
      field.tag = newTag;
      return;
    }
    if (field.tag === '130') {
      resetCorrespondingField880(field, record, '240');
      field.tag = '240';
      field.ind2 = field.ind1;
      field.ind1 = '1';
      // NB! 130 might have a $t, but that's so theoretical, that I'm not checking nor handling it.
      // No other known differences (subfields, punctuation etc.)
      return;
    }
  }
}
