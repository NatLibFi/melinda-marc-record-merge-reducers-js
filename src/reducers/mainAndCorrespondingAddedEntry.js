import {mergeField} from './mergeField.js';
import {addField} from './addField.js';
import {postprocessRecord} from './mergePreAndPostprocess.js';
import {fieldToString} from './utils.js';
import {recordPreprocess, sourceRecordPreprocess} from './normalize.js';
import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {initFieldMergeConfig} from './fieldMergeConfig.js';
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

export default () => (base, source) => {
  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  // How do we read the config? Config file? Parameters from calling function? Currently this just sets the defaults...
  const config = initFieldMergeConfig();

  // We should clone the records here and just here...
  const record = recordPreprocess(baseRecord); // fix composition et al
  const record2 = sourceRecordPreprocess(record, recordPreprocess(sourceRecord)); // fix composition et al

  const candidateFields = record2.get(/^(?:1[0-9][0-9]|700|710|711|730|880)$/u);
  //const candidateFields = record2.get(/^FFS$/u); // Return [] on purpose. Keep this disabled for now...
  candidateFields.forEach(candField => {
    debug(`Now (not processing main or added entry ${fieldToString(candField)}`);

    if (!mergeField(record, candField, config)) { // eslint-disable-line functional/no-conditional-statement
      addField(record, candField, config);
    }

  });

  postprocessRecord(record);
  return record;


};


