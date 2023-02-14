import isbnIssn from '@natlibfi/marc-record-validators-melinda/dist/isbn-issn';
import {MarcRecord} from '@natlibfi/marc-record';
import {getCatalogingLanguage, nvdebug, subfieldToString} from './utils.js';
import {translateRecord} from './fixRelatorTerms.js';
import {filterOperations} from './processFilter.js';
import {default as normalizeEncoding} from '@natlibfi/marc-record-validators-melinda/dist/normalize-utf8-diacritics';
import fs from 'fs';
import path from 'path';
import {fieldTrimSubfieldValues} from './normalize.js';
import {recordRemoveDuplicateSubfieldsFromFields} from './removeDuplicateSubfields.js';

const defaultConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

function normalizeField505Separator(record) {
  const fields = record.fields.filter(field => isRelevantField505(field));

  fields.forEach(field => fixField505(field));

  function fixField505(field) {
    const subfields = field.subfields.filter(sf => sf.code === 'a');
    subfields.forEach(sf => {
      nvdebug(`Try to process ${subfieldToString(sf)}`);
      sf.value = sf.value.replace(/ ; /gu, ' -- '); // eslint-disable-line functional/immutable-data
      nvdebug(`Result ${subfieldToString(sf)}`);
    });
  }

  function isRelevantField505(field) {
    if (field.tag !== '505') {
      return false;
    }
    if (field.subfields.some(sf => ['g', 'r', 't'].includes(sf.code))) {
      return false;
    }
    return true;
  }
}

function trimRecord(record) {
  record.fields?.forEach(f => fieldTrimSubfieldValues(f));
}

export default (config = defaultConfig) => (base, source) => {

  normalizeEncoding().fix(base);
  normalizeEncoding().fix(source);

  trimRecord(base);
  trimRecord(source);


  //const baseRecord = new MarcRecord(base, {subfieldValues: false});

  //const clonedSource = clone(source); // MRA-72
  const clonedSource = new MarcRecord(source, {subfieldValues: false});

  // NB! Filter operations should be moved to their own file...
  filterOperations(base, clonedSource, config.preprocessorDirectives);

  const source2 = hyphenateISBN(clonedSource, config); // Should these be done to base as well?

  normalizeField505Separator(base);
  normalizeField505Separator(source2);

  translateRecord(source2, getCatalogingLanguage(base)); // map stuff as per base's 040$b

  recordRemoveDuplicateSubfieldsFromFields(source2);
  recordRemoveDuplicateSubfieldsFromFields(base);

  const result = {base, source: source2};
  //nvdebug(JSON.stringify(result));
  return result;


  function hyphenateISBN(record) {
    // Not sure whether this should be done, or should we normalize ISBNs during comparison.
    const addHyphensToISBN = isbnIssn({hyphenateISBN: true});
    addHyphensToISBN.fix(record);

    return record;
  }
};
