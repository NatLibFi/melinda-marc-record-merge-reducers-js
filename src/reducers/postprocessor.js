import fs from 'fs';
import path from 'path';

import {fieldToString, nvdebug} from './utils.js';
import {filterOperations} from './processFilter.js';
import createDebugLogger from 'debug';

//import {removeDuplicateDatafields as removeDuplicateDatafieldsOld} from './removeIdenticalDataFields';

import {recordNormalizeIndicators} from '@natlibfi/marc-record-validators-melinda/dist/indicator-fixes.js';
import {removeWorsePrepubField500s, removeWorsePrepubField594s} from '@natlibfi/marc-record-validators-melinda/dist/prepublicationUtils.js';
import {mergeLisapainokset} from '@natlibfi/marc-record-validators-melinda/dist/mergeField500Lisapainokset.js';
import {recordResetSubfield6OccurrenceNumbers} from '@natlibfi/marc-record-validators-melinda/dist/reindexSubfield6OccurenceNumbers.js';
import {removeInferiorDatafields} from '@natlibfi/marc-record-validators-melinda/dist/removeInferiorDataFields.js';


import {mtsProcessRecord} from './preprocessMetatietosanasto.js';
import {removeDuplicateDatafields} from '@natlibfi/marc-record-validators-melinda/dist/removeDuplicateDataFields.js';
import {recordFixSubfield6OccurrenceNumbers} from '@natlibfi/marc-record-validators-melinda/dist/resolveOrphanedSubfield6s.js';
import factoryForThereCanBeOnlyOneSubfield0 from '@natlibfi/marc-record-validators-melinda/dist/multiple-subfield-0.js';
import factoryForSortFields from '@natlibfi/marc-record-validators-melinda/dist/sortFields.js';
// import factoryForMergeingRelatorFields from '@natlibfi/marc-record-validators-melinda/dist/mergeRelatorField'; // Not yet in main

const defaultConfig = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:postprocessor');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

export default (config = defaultConfig) => (base, source) => {

  nvdebug('ENTERING postprocessor.js', debugDev);
  base.fields.forEach(field => nvdebug(`WP0: ${fieldToString(field)}`, debugDev));

  //nvdebug(JSON.stringify(base), debugDev);
  //nvdebug(JSON.stringify(source), debugDev);

  //nvdebug(JSON.stringify(config.postprocessorDirectives), debugDev);
  //const baseRecord = new MarcRecord(base, {subfieldValues: false});
  //nvdebug(`HSP CONF ${config}`, debugDev);
  filterOperations(base, source, config.postprocessorDirectives); // declared in preprocessor

  //deleteAllPrepublicationNotesFromField500InNonPubRecord(base); // Already done when LDR/17 was copied from source
  removeWorsePrepubField500s(base);
  removeWorsePrepubField594s(base);
  //base.fields.forEach(field => nvdebug(`WP5: ${fieldToString(field)}`, debugDev));

  recordNormalizeIndicators(base); // Fix 245 and non-filing indicators
  //base.fields.forEach(field => nvdebug(`WP6: ${fieldToString(field)}`, debugDev));

  mergeLisapainokset(base);
  //base.fields.forEach(field => nvdebug(`WP7: ${fieldToString(field)}`, debugDev));
  mtsProcessRecord(base);

  //base.fields.forEach(field => nvdebug(`WP50: ${fieldToString(field)}`, debugDev));
  recordFixSubfield6OccurrenceNumbers(base); // remove orphaned $6 fields or set them to 880 $6 700-00...
  //base.fields.forEach(field => nvdebug(`WP51: ${fieldToString(field)}`, debugDev));
  const thereCanBeOnlyOneSubfield0 = factoryForThereCanBeOnlyOneSubfield0({}); // MRA-392
  thereCanBeOnlyOneSubfield0.fix(base);

  //const res =
  removeDuplicateDatafields(base, true);
  //nvdebug(`Re-DUP ${JSON.stringify(res)}`, debugDev);

  removeInferiorDatafields(base, true);
  //res.message.forEach(msg => nvdebug(msg, debugDev));

  //removeDuplicateDatafieldsOld(base);

  const sorter = factoryForSortFields({});
  sorter.fix(base);

  recordResetSubfield6OccurrenceNumbers(base);

  sorter.fix(base);

  //base.fields.forEach(field => nvdebug(`WP99: ${fieldToString(field)}`, debugDev));

  return {base, source};
};

