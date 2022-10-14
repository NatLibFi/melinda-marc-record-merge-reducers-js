
import fs from 'fs';
import path from 'path';
//import {MarcRecord} from '@natlibfi/marc-record';
import {/*fieldRenameSubfieldCodes, fieldToString,*/ nvdebug /*recordReplaceField, stringToRegex*/} from './utils.js';
import {filterOperations} from './preprocessor.js';

const defaultConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

export default (config = defaultConfig) => ({base, source}) => {
  nvdebug('555a');
  nvdebug(JSON.stringify(base));
  nvdebug(JSON.stringify(source));

  nvdebug(JSON.stringify(config.postprocessorDirectives));
  //const baseRecord = new MarcRecord(base, {subfieldValues: false});
  //nvdebug(`HSP CONF ${config}`);
  filterOperations(base, source, config.postprocessorDirectives); // declared in preprocessor
  return {base, source};
};

