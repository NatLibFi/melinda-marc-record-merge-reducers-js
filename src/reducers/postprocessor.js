import fs from 'fs';
import path from 'path';
//import {MarcRecord} from '@natlibfi/marc-record';
import {/*fieldRenameSubfieldCodes, fieldToString,*/ nvdebug /*recordReplaceField, stringToRegex*/} from './utils.js';
import {filterOperations} from './preprocessor.js';
import {deleteWorsePrepublicationFields500, deleteWorsePrepublicationFields594} from './prepublicationUtils';

import {recordNormalizeIndicators} from '@natlibfi/marc-record-validators-melinda/dist/indicator-fixes';
import {deleteAllPrepublicationNotesFromField500} from './prepublicationUtils.js';

const defaultConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

export default (config = defaultConfig) => (base, source) => {
  nvdebug('ENTERING postprocessor.js');
  //nvdebug(JSON.stringify(base));
  //nvdebug(JSON.stringify(source));

  //nvdebug(JSON.stringify(config.postprocessorDirectives));
  //const baseRecord = new MarcRecord(base, {subfieldValues: false});
  //nvdebug(`HSP CONF ${config}`);
  filterOperations(base, source, config.postprocessorDirectives); // declared in preprocessor

  deleteAllPrepublicationNotesFromField500(base);
  deleteWorsePrepublicationFields500(base);
  deleteWorsePrepublicationFields594(base);
  recordNormalizeIndicators(base); // Fix 245 and non-filing indicators
  return {base, source};
};

