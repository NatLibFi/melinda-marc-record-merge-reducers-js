//import createDebugLogger from 'debug';
import fs from 'fs';
import path from 'path';

import {MarcRecord} from '@natlibfi/marc-record';
import {Field505Separators, fieldTrimSubfieldValues, NormalizeQualifyingInformation, NormalizeUTF8Diacritics, recordFixRelatorTerms, SanitizeVocabularySourceCodes, SubfieldValueNormalizations, UpdateField540} from '@natlibfi/marc-record-validators-melinda';


import {getCatalogingLanguage} from './utils.js';
import {filterOperations} from './processFilter.js';
import {recordRemoveDuplicateSubfieldsFromFields} from './removeDuplicateSubfields.js';
import {reindexDuplicateSubfield6Indexes} from './reindexSubfield6.js';
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:preprocessor');
const debugData = debug.extend('data');
//const debugDev = debug.extend('dev');

const defaultConfig = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

function trimRecord(record) {
  record.fields?.forEach(f => fieldTrimSubfieldValues(f));
}

export default (config = defaultConfig, internal = false) => (base, source) => {
  debug(`Running preprocessor with ${JSON.stringify(config)}, ${internal}`);
  debugData(`base: ${JSON.stringify(base)}`);
  debugData(`source: ${JSON.stringify(base)}`);
  const fixers = [ NormalizeUTF8Diacritics(), SanitizeVocabularySourceCodes(), NormalizeQualifyingInformation(), SubfieldValueNormalizations(), Field505Separators(), UpdateField540() ];


  trimRecord(base);
  trimRecord(source);

  fixers.forEach(fixer => applyFixer(fixer));

  function applyFixer(fixer) {
    fixer.fix(base);
    fixer.fix(source);
  }

  const fromLanguage = getCatalogingLanguage(source);
  const toLanguage = getCatalogingLanguage(base);
  recordFixRelatorTerms(source, fromLanguage, fromLanguage); // Expand terms: "säv." => "säveltäjä"
  recordFixRelatorTerms(source, fromLanguage, toLanguage); // "säveltäjä" => "composer"
  recordFixRelatorTerms(base, toLanguage, toLanguage); // Expand terms: "säv." => "säveltäjä"

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

