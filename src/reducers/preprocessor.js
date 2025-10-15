//import createDebugLogger from 'debug';
import fs from 'fs';
import path from 'path';

import {MarcRecord} from '@natlibfi/marc-record';
import {getCatalogingLanguage} from './utils.js';
import {recordFixRelatorTerms} from '@natlibfi/marc-record-validators-melinda/dist/fixRelatorTerms';
import {filterOperations} from './processFilter.js';
import {default as normalizeEncoding} from '@natlibfi/marc-record-validators-melinda/dist/normalize-utf8-diacritics';
import {fieldTrimSubfieldValues} from '@natlibfi/marc-record-validators-melinda/dist/normalizeFieldForComparison.js';
import {recordRemoveDuplicateSubfieldsFromFields} from './removeDuplicateSubfields.js';
import {reindexDuplicateSubfield6Indexes} from './reindexSubfield6.js';
import {default as fixSourceOfTerm} from '@natlibfi/marc-record-validators-melinda/dist/sanitize-vocabulary-source-codes';
import {default as modernize540} from '@natlibfi/marc-record-validators-melinda/dist/update-field-540';
import {default as normalize505} from '@natlibfi/marc-record-validators-melinda/dist/field-505-separators';
import {default as normalizeQualifyingInformation} from '@natlibfi/marc-record-validators-melinda/dist/normalize-qualifying-information';
import {default as normalizeVariousSubfields} from '@natlibfi/marc-record-validators-melinda/dist/subfieldValueNormalizations';

//const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:preprocessor');
//const debugData = debug.extend('data');
//const debugDev = debug.extend('dev');

const defaultConfig = JSON.parse(fs.readFileSync(path.join(import.meta.dirname , '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

function trimRecord(record) {
  record.fields?.forEach(f => fieldTrimSubfieldValues(f));
}

export default (config = defaultConfig, internal = false) => (base, source) => {

  normalizeEncoding().fix(base);
  normalizeEncoding().fix(source);

  trimRecord(base);
  trimRecord(source);

  fixSourceOfTerm().fix(base);
  fixSourceOfTerm().fix(source);

  const fromLanguage = getCatalogingLanguage(source);
  const toLanguage = getCatalogingLanguage(base);
  recordFixRelatorTerms(source, fromLanguage, fromLanguage); // Expand terms: "säv." => "säveltäjä"
  recordFixRelatorTerms(source, fromLanguage, toLanguage); // "säveltäjä" => "composer"
  recordFixRelatorTerms(base, toLanguage, toLanguage); // Expand terms: "säv." => "säveltäjä"

  normalizeQualifyingInformation().fix(base); // Modernize 015/020/024/028$q
  normalizeQualifyingInformation().fix(source);

  normalizeVariousSubfields().fix(base); // Capitalize 130/240/243/600/.../830$l value etc
  normalizeVariousSubfields().fix(source);

  normalize505().fix(base);
  normalize505().fix(source);

  modernize540().fix(base);
  modernize540().fix(source);

  //nvdebug(`BASE: Reindex $6 duplicates`, debugDev);
  reindexDuplicateSubfield6Indexes(base);
  //nvdebug(`SOURCE: Reindex $6 duplicates`, debugDev);
  reindexDuplicateSubfield6Indexes(source);


  //source.fields.forEach(f => nvdebug(` SRC '${fieldToString(f)}'`, debugDev));
  //const baseRecord = new MarcRecord(base, {subfieldValues: false});

  //const clonedSource = clone(source); // MRA-72
  const clonedSource = new MarcRecord(source, {subfieldValues: false});

  // NB! Filter operations should be moved to their own file...
  filterOperations(base, clonedSource, config.preprocessorDirectives, internal);

  const source2 = clonedSource; // hyphenateISBN(clonedSource, config); // Should these be done to base as well?

  recordFixRelatorTerms(source2, getCatalogingLanguage(base), getCatalogingLanguage(source2)); // map stuff as per base's 040$b

  recordRemoveDuplicateSubfieldsFromFields(source2);
  recordRemoveDuplicateSubfieldsFromFields(base);


  const result = {base, source: source2};
  ///
  //nvdebug(JSON.stringify(result));
  return result;

};

