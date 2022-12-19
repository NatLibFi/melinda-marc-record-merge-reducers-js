//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
//import {fieldHasSubfield, fieldIsRepeatable, fieldToString, fieldsAreIdentical, debug, recordHasField} from './utils';

import {nvdebug} from './utils';
import fs from 'fs';
import path from 'path';


const defaultConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'muuntajaConfig.json'), 'utf8'));

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:swapFields');
//const debugData = debug.extend('data');

export default (config = defaultConfig.swapConfiguration) => (base, source) => {
  if (!config) {
    return {base, source};
  }

  const tagPattern = getTagPattern(config);
  if (!tagPattern) {
    return {base, source};
  }

  const baseFields = base.get(tagPattern);
  const sourceFields = source.get(tagPattern);

  baseFields.forEach(field => base.removeField(field));
  sourceFields.forEach(field => source.removeField(field));

  baseFields.forEach(field => source.insertField(field));
  sourceFields.forEach(field => base.insertField(field));

  nvdebug(`Moved ${baseFields.length} field(s) from base to source`, debug);
  nvdebug(`Moved ${sourceFields.length} field(s) from source to base`, debug);


  return {base, source};

  function getTagPattern(config) {
    if (config.tagPattern) {
      return config.tagPattern;
    }
    return null;
  }
};
