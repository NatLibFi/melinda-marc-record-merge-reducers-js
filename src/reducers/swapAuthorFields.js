import createDebugLogger from 'debug';
import {default as swapFieldsProto} from './swapFields';
import {nvdebug} from './utils';
//import fs from 'fs';
//import path from 'path';

//const muuntajaConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'muuntajaConfig.json'), 'utf8'));

//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:muuntajaMergeField');
//const debugData = debug.extend('data');

//const defCandFieldsRegexp = /^(?:0[1-9][0-9]|[1-9][0-9][0-9]|CAT|LOW|SID)$/u;


const tagPattern = /^(?:100|110|111|130|700|710|711|730)/u;
const swapConfiguration = {
  tagPattern
};


export default () => (base, source) => {
  // Wrapper for mergeDatafields that uses muuntaja's config
  nvdebug(`ENTERING swapAuthorFields.js using fake ${tagPattern}`, debug);

  const swapFields = swapFieldsProto(swapConfiguration);
  const val = swapFields(base, source); // eslint-disable-line functional/immutable-data
  nvdebug(`PAST SWAP`);

  return val; // val = { base, source}
};

