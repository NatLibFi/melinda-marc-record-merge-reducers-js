import {mergeOrAddField} from './mergeField.js';
import {postprocessRecord} from './mergePreAndPostprocess.js';
import {fieldToString} from './utils.js';
import {recordPreprocess, sourceRecordPreprocess} from './normalize.js';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

export default () => (baseRecord, sourceRecord) => {
  // We should clone the records here and just here...
  const record = recordPreprocess(baseRecord); // fix composition et al
  const record2 = sourceRecordPreprocess(record, recordPreprocess(sourceRecord)); // fix composition et al

  const candidateFields = record2.get(/^(?:0[1-9][0-9]|[1-9][0-9][0-9]|CAT|LOW|SID)$/u);
  candidateFields.forEach(candField => {
    debug(`Now processing ${fieldToString(candField)}`);
    mergeOrAddField(record, candField);
  });


  postprocessRecord(record);
  return record;
};


