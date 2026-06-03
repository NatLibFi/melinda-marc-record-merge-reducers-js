import fs from 'fs';
import path from 'path';

//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldToString, nvdebug} from './utils.js';
import {mergeField, NormalizeUTF8Diacritics, postprocessRecords} from '@natlibfi/marc-record-validators-melinda';
import {preprocessBeforeAdd} from './processFilter.js';
import {resetCorrespondingField880} from './resetField880Subfield6AfterFieldTransfer.js';

const defaultConfig = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

// Original *outdated* specs: https://workgroups.helsinki.fi/x/K1ohCw

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeField');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

const defCandFieldsRegexp = /^(?:0[1-9][0-9]|[1-9][0-9][0-9]|CAT|LOW|SID)$/u;


// Should this load default configuration?
//export default (tagPattern = undefined, config = defaultConfig.mergeConfiguration) => (base, source) => {
export default (tagPattern = undefined, config = defaultConfig.mergeConfiguration, internal = false) => (baseRecord, sourceRecord) => {
  nvdebug(`ENTERING mergeField.js`, debugDev);
  //const baseRecord = new MarcRecord(base, {subfieldValues: false});
  //const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  const activeTagPattern = getTagPattern(tagPattern, config);

  //nvdebug(JSON.stringify(baseRecord));
  //nvdebug(JSON.stringify(sourceRecord));

  sourceRecord.fields.forEach(f => nvdebug(`SRC1: ${fieldToString(f)}`, debugDev));

  //nvdebug(`MERGE CONFIG: ${JSON.stringify(config)}`, debugDev);

  const fixer = NormalizeUTF8Diacritics();
  fixer.fix(baseRecord);
  fixer.fix(sourceRecord);

  retagSourceFields(sourceRecord, baseRecord); // source f100->f700
  preprocessBeforeAdd(baseRecord, sourceRecord, config.preprocessorDirectives, internal); // NB! we should rename func, this may have nothing to with add


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

export function retagSourceFields(record, baseRecord) {
  const base240 = baseRecord.get('240');
  const base243 = baseRecord.get('243');

  record.fields.forEach(f => retagField(f));

  // NB! 880$6 stuff is nor currently checked...

  function retagField(field) {
    // 100, 110 and 111 are moved to corresponding (and repeatable) 7XX field. It is possible for them to merge back to base's 1XX field, though.
    // But, in essence, source-1XX never becomes 1XX in the merged record.
    if (['100', '110', '111'].includes(field.tag)) { // 1XX -> 7XX
      const newTag = `7${field.tag.substring(1)}`;
      resetCorrespondingField880(field, record, newTag);
      field.tag = newTag;
      return;
    }
    // 130 (pairs with 240) is a bit trickier, as either f130 and f240 should really exist.
    if (field.tag === '130') {
      // Added base f100/f110/f111&f240 sanity check after MELINDA-12703.
      // If condition is not triggered, the source f130 can now merge with base's f130 or be copied to base, if there's no f130.
      const baseFields = baseRecord.fields.filter(f => ['100', '110', '111', '240'].includes(f.tag));
      if (baseFields.length > 0) {
        resetCorrespondingField880(field, record, '240');
        field.tag = '240';
        field.ind2 = field.ind1;
        field.ind1 = '1';
        field.merged = 1; // triggers ending punctuation check (f130 has punc, and f240 has not)
        // NB! 130 might have a $t, but that's so theoretical, that I'm not checking nor handling it.
        // No other known differences (subfields, punctuation etc.)
        // return; // We might feed the f240->f243 rule
      }
    }

    // 240 and 243 should not co-exist -> make source use the same tag as base
    if (field.tag === '240' && base240.length === 0 && base243.length > 0) {
      field.tag = '243';
      return;
    }
    if (field.tag === '243' && base240.length > 0 && base243.length === 0) {
      field.tag = '240';
      return;
    }

  }
}
