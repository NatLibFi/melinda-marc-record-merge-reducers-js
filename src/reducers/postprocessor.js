import createDebugLogger from 'debug';
import fs from 'fs';
import path from 'path';

import {IndicatorFixes, MergeField500Lisapainokset, MultipleSubfield0s, RemoveDuplicateDataFields, RemoveInferiorDataFields, ResolveOrphanedSubfield6s, SortFields,
        recordResetSubfield6OccurrenceNumbers, removeWorsePrepubField500s, removeWorsePrepubField594s} from '@natlibfi/marc-record-validators-melinda';

import {mtsProcessRecord} from './preprocessMetatietosanasto.js';
import {fieldToString, nvdebug} from './utils.js';
import {filterOperations} from './processFilter.js';
import {convertInternalControlNumbersToCanceled, addMergeNoteField, removeCATFields, removeUnneededFields} from './utilsForInternalMerge.js';

// import factoryForMergeingRelatorFields from '@natlibfi/marc-record-validators-melinda/dist/mergeRelatorField'; // Not yet in main

const defaultConfig = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:postprocessor');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

export default (config = defaultConfig, internal = false) => (base, source) => {

  nvdebug('ENTERING postprocessor.js', debugDev);
  base.fields.forEach(field => nvdebug(`WP0: ${fieldToString(field)}`, debugDev));


  //nvdebug(JSON.stringify(base), debugDev);
  //nvdebug(JSON.stringify(source), debugDev);

  //nvdebug(JSON.stringify(config.postprocessorDirectives), debugDev);
  //const baseRecord = new MarcRecord(base, {subfieldValues: false});
  //nvdebug(`HSP CONF ${config}`, debugDev);
  filterOperations(base, source, config.postprocessorDirectives, internal); // declared in preprocessor

  //deleteAllPrepublicationNotesFromField500InNonPubRecord(base); // Already done when LDR/17 was copied from source
  removeWorsePrepubField500s(base);
  removeWorsePrepubField594s(base);
  //base.fields.forEach(field => nvdebug(`WP5: ${fieldToString(field)}`, debugDev));

  IndicatorFixes().fix(base); // Fix 245 and non-filing indicators
  //base.fields.forEach(field => nvdebug(`WP6: ${fieldToString(field)}`, debugDev));

  MergeField500Lisapainokset().fix(base);
  //base.fields.forEach(field => nvdebug(`WP7: ${fieldToString(field)}`, debugDev));
  mtsProcessRecord(base);

  //base.fields.forEach(field => nvdebug(`WP50: ${fieldToString(field)}`, debugDev));
  ResolveOrphanedSubfield6s().fix(base); // remove orphaned $6 fields or set them to 880 $6 700-00...

  //base.fields.forEach(field => nvdebug(`WP51: ${fieldToString(field)}`, debugDev));
  const thereCanBeOnlyOneSubfield0 = MultipleSubfield0s({}); // MRA-392
  thereCanBeOnlyOneSubfield0.fix(base);

  if (internal) {
    debugDev(`*** INTERNAL MERGE postprocessor additions ***`);
    // Adding merge note should maybe be done in UI
    addMergeNoteField(base, source, 'FI-MELINDA');
    // Convert 035 $a to 035 $z
    convertInternalControlNumbersToCanceled(base, source, internal, 'FI-MELINDA');
    removeCATFields(base, source, internal);
    // Remove 001+003+005
    removeUnneededFields(base, source, internal);
  }

  //const res =
  RemoveDuplicateDataFields().fix(base);
  //nvdebug(`Re-DUP ${JSON.stringify(res)}`, debugDev);

  RemoveInferiorDataFields().fix(base);
  //res.message.forEach(msg => nvdebug(msg, debugDev));

  //removeDuplicateDatafieldsOld(base);

  const sorter = SortFields({});
  sorter.fix(base);

  recordResetSubfield6OccurrenceNumbers(base);

  sorter.fix(base);

  //base.fields.forEach(field => nvdebug(`WP99: ${fieldToString(field)}`, debugDev));

  return {base, source};
};

