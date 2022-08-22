//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldToString, nvdebug} from './utils';
import {mergeField} from './mergeField';

import {MarcRecord} from '@natlibfi/marc-record';
import {recordPreprocess} from './hardcodedPreprocessor.js';
import {postprocessRecord} from './mergePreAndPostprocess.js';
import {preprocessBeforeAdd} from './hardcodedSourcePreprocessor.js';
import {addField} from './addField';

//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:field240');

// Should this load default configuration?
export default () => (base, source) => {

  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  const config = {'config': {'tagPattern': '^240$',
    'addConfiguration': {
      'preprocessorDirectives': [
        {
          'operation': 'removeField',
          'comment': 'this should be done after field merge and before copy (could be merged, but not added)',
          'recordType': 'source',
          'fieldSpecification': {
            'tag': '240'
          },
          'requireBaseField': {
            'tagPattern': '^(130|240)$'
          }
        }
      ]
    }}};

  // We should clone the records here and just here...
  recordPreprocess(baseRecord); // fix composition et al
  recordPreprocess(sourceRecord); // fix composition et al


  addField(baseRecord, sourceRecord, config);

  const activeTagPattern = /^240$/u;
  nvdebug(`MERGE CONFIG: ${JSON.stringify(config)}`);
  preprocessBeforeAdd(baseRecord, sourceRecord, config.preprocessorDirectives);

  const candidateFields = sourceRecord.get(activeTagPattern);

  candidateFields.forEach(candField => {
    nvdebug(`Now merging (or trying to) field ${fieldToString(candField)}`, debug);
    if (!mergeField(baseRecord, candField, config)) {
      addField(baseRecord, sourceRecord, config);
      return;
    }
  });

  // Remove deleted fields and field.merged marks:
  postprocessRecord(baseRecord);
  postprocessRecord(sourceRecord);

  return [baseRecord, sourceRecord];
  //return {baseRecord2, sourceRecord2};

};
