import createDebugLogger from 'debug';
import {default as mergeDataFieldsProto} from './mergeField';
import {default as addDataFieldsProto} from './addField';
import {nvdebug} from './utils';
import fs from 'fs';
import path from 'path';
//import {default as swapFieldsProto} from './swapAuthorFields';
import {default as createField776Proto} from './muuntaja776';
import {filterOperations} from './processFilter';
const muuntajaConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'muuntajaConfig.json'), 'utf8'));

//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:muuntajaMergeField');
//const debugData = debug.extend('data');

//const defCandFieldsRegexp = /^(?:0[1-9][0-9]|[1-9][0-9][0-9]|CAT|LOW|SID)$/u;

export default (tagPattern = false, config = muuntajaConfig) => (base, source) => {
  // Wrapper for mergeDatafields that uses muuntaja's config
  nvdebug(`ENTERING muuntajaMergeField.js using fake ${tagPattern}`, debug);
  nvdebug(`MUUNTAJA CONFIG: ${JSON.stringify(config)}`);

  const createField776 = createField776Proto();
  const val4 = createField776(base, source);

  filterOperations(base, source, config.preprocessorDirectives);

  //const swapAuthorFields = swapFieldsProto(false); // Create a reducer
  //const val3 = swapAuthorFields(val4.base, val4.source);

  const mergeDataFields = mergeDataFieldsProto(tagPattern, config.mergeConfiguration);
  const val = mergeDataFields(val4.base, val4.source); // eslint-disable-line functional/immutable-data

  const addDataFields = addDataFieldsProto(config.addConfiguration); // base, source);
  const val2 = addDataFields(val.base, val.source); // eslint-disable-line functional/immutable-data

  nvdebug(`PAST MERGE'N'ADD`);

  return {base: val2.base, source: val2.source};
};

