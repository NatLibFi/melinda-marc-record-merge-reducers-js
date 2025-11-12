import createDebugLogger from 'debug';
import {filterOperations} from './processFilter.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:utilsForInternalMerge');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

export const defaultInternalPrefix = 'FI-MELINDA';

// Convert all internal (FI-MELINDA) f035 $a control numbers to f035 $z
// This is usable in postProcessor for internal merges, where merged record is added as a new record to database
// and base and source are deleted
// We handle both records, in case this is used before adding f035s from source to base
export function convertInternalControlNumbersToCanceled(base, source, internal, prefix = defaultInternalPrefix) {
  // handle all existing internal f035 $a
  debug(`Editing f035 $a with prefix ${prefix} to f035 $z`);
  const internalIdValuePattern = `^\\(${prefix}\\)`;
  //debug(`internalValuePattern: ${internalIdValuePattern}`);

  const convertInternalControlNumbersToCanceledConfig = [
        {
            operation: "renameSubfield",
            recordType: "both",
            internal: true,
            comment: "Move internal f035 $a to f035 $z",
            fieldSpecification: {
                tag: "035",
                subfieldFilters: [{code: "a"}, {valuePattern: internalIdValuePattern}]
            },
            renamableSubfieldFilter: {code: "a", valuePattern: internalIdValuePattern, newCode: "z"}
        }];

  debug(`convertInternalControlNumbersToCanceledConfig: ${JSON.stringify(convertInternalControlNumbersToCanceledConfig)}`);
  filterOperations(base, source, convertInternalControlNumbersToCanceledConfig, internal);
}

export function removeCATFields(base, source, internal) {
  // delete CAT-fields
  const removeCatsConfig =
      [{
            operation: "removeField",
            recordType: "both",
            internal: true,
            comment: "Remove CAT fields from records",
            fieldSpecification: {
                tagPattern: "^CAT$"
            }
        }];
  filterOperations(base, source, removeCatsConfig, internal);
}

export function removeUnneededFields(base, source, internal) {
  // delete CAT-fields
  const removeCatsConfig =
      [{
            operation: "removeField",
            recordType: "base",
            internal: true,
            comment: "Remove 001, 003 and 005 from base",
            fieldSpecification: {
                tagPattern: "^(001|003|005)$"
            }
        }];
  filterOperations(base, source, removeCatsConfig, internal);
}

// Add merge note based on source and base ids to base
export function addMergeNoteField(base, source, prefix = defaultInternalPrefix) {

  const mergeNoteField = createMergeNote(base, source);
  debugDev(`Adding mergeNote to base: ${JSON.stringify(mergeNoteField)}`);
  base.insertField(mergeNoteField);

  return base;

  function createMergeNote(base, source, prefix = defaultInternalPrefix) {
    // 000036610 583   L $$aMERGED FROM (FI-MELINDA)002673271 + (FI-MELINDA)004776799$$c2015-08-17T15:11:55+03:00$$5MELINDA

    const sourceId = getId(source, prefix);
    const baseId = getId(base, prefix);
    const timeStamp = new Date().toISOString();
    debugDev(`timeStamp: ${timeStamp}`);

    return {tag: '583', ind1: ' ', ind2: ' ', subfields: [
      {code: 'a', value: `MERGED FROM ${baseId} + ${sourceId}`},
      {code: 'c', value: `${timeStamp}`},
      {code: '5', value: 'MELINDA'}]};
    }

    function getId(record, prefix = defaultInternalPrefix) {

      // get first f001 and first f003 (record should have just one of both)
      const [f001] = record.get('001').map(field => field.value);
      const [f003] = record.get('003').map(field => field.value);

      debugDev(`f001: ${f001}`);
      debugDev(`f003: ${f001}`);

      // if we don't have f003 use prefix to build id
      const id = f003 === undefined ? `(${prefix})${f001}` : `(${f003})${f001}`;

      debugDev(`id: ${id}`);

      return id;
    }

}

