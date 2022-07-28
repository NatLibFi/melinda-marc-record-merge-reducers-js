import {mergeOrAddField} from './mergeField.js';
import {postprocessRecord} from './mergePreAndPostprocess.js';
import {fieldToString} from './utils.js';
import {recordPreprocess, sourceRecordPreprocess} from './normalize.js';
import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

export default () => (base, source) => {

  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  // We should clone the records here and just here...
  const record = recordPreprocess(baseRecord); // fix composition et al
  const record2 = sourceRecordPreprocess(record, recordPreprocess(sourceRecord)); // fix composition et al

  const candidateFields = record2.get(/^(?:1[0-9][0-9]|700|710|711|730)$/u);
  candidateFields.forEach(candField => {
    debug(`Now processing ${fieldToString(candField)}`);
    mergeOrAddField(record, candField);
  });


  postprocessRecord(record);
  return record;
};


