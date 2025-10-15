//import createDebugLogger from 'debug';
//import internalFields from './internalFields';
import leader from './leader';
import field006 from './field006';
import field007 from './field007';
import field008 from './field008';
//import field995 from './field995';
//import genericDatafield from './genericDatafield';
import reindexSubfield6 from './reindexSubfield6';
import reindexSubfield8 from './reindexSubfield8';


import genericPreprocessor from './preprocessor.js';
import prepublicationPreprocessor from './preprocessPrepublication';
import {default as addDataFields} from './addField.js';
import {default as mergeDataFields} from './mergeField';
import {default as muuntajaMergeDataFields} from './muuntaja';
//import {default as postprocessSubfield6} from './postprocessSubfield6';
import {default as metatietosanastoNormalizations} from './preprocessMetatietosanasto';
import postprocessor from './postprocessor';
import {default as manufacturer260To264} from './transferManufacturerDataFrom260To264';
import {default as removeDuplicatesFromSource} from './removeIdenticalDataFields';
// const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

export const localReducers = [
  //// PREPROCESSOR STUFF:
  // UTF-8 normalization: if wanted, see mergeField.js for an example
  genericPreprocessor(), // Should this be moved downward?
  metatietosanastoNormalizations(),
  prepublicationPreprocessor(),
  removeDuplicatesFromSource(), // handles $6 and $8 chains as well (but apparently badly)
  reindexSubfield6(), // Reindex $6 subfields from source, base remains unchanged.
  reindexSubfield8(), // Reindex $8 subfields from source, base remains unchanged.
  manufacturer260To264(),

  //// ACTUAL MERGE/ADD STUFF:
  //internalFields(), // LOW, CAT, SID. Nowadays part of genericDatafield()
  leader(), // Test 01
  field006(), // Tests 02 and 03
  field007(), // Tests 04 and 05
  field008(), // Tests 06, 07, and 08
  mergeDataFields(),
  addDataFields(),
  postprocessor()
];

export const mergeReducersForMergeUI = [
  //// PREPROCESSOR STUFF:
  // UTF-8 normalization: if wanted, see mergeField.js for an example
  genericPreprocessor(), // Should this be moved downward?
  metatietosanastoNormalizations(),
  prepublicationPreprocessor(),
  removeDuplicatesFromSource(), // handles $6 and $8 chains as well (but apparently badly)
  reindexSubfield6(), // Reindex $6 subfields from source, base remains unchanged.
  reindexSubfield8(), // Reindex $8 subfields from source, base remains unchanged.
  manufacturer260To264(),

  //// ACTUAL MERGE/ADD STUFF:
  //internalFields(), // LOW, CAT, SID. Nowadays part of genericDatafield()
  leader(), // Test 01
  field006(), // Tests 02 and 03
  field007(), // Tests 04 and 05
  field008(), // Tests 06, 07, and 08
  mergeDataFields(),
  addDataFields(),
  postprocessor()
];


export const muuntajaReducers = [
  genericPreprocessor(),
  metatietosanastoNormalizations(),
  muuntajaMergeDataFields(),
  addDataFields(),
  postprocessor()
];
