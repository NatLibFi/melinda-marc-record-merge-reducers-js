//import createDebugLogger from 'debug';
//import internalFields from './internalFields.js';
import leader from './leader.js';
import field006 from './field006.js';
import field007 from './field007.js';
import field008 from './field008.js';
//import field995 from './field995.js';
//import genericDatafield from './genericDatafield.js';
import reindexSubfield6 from './reindexSubfield6.js';
import reindexSubfield8 from './reindexSubfield8.js';


import genericPreprocessor from './preprocessor.js';
import prepublicationPreprocessor from './preprocessPrepublication.js';
import {default as addDataFields} from './addField.js';
import {default as mergeDataFields} from './mergeField.js';
import {default as muuntajaMergeDataFields} from './muuntaja.js';
//import {default as postprocessSubfield6} from './postprocessSubfield6.js';
import {default as metatietosanastoNormalizations} from './preprocessMetatietosanasto.js';
import postprocessor from './postprocessor.js';
import {default as manufacturer260To264} from './transferManufacturerDataFrom260To264.js';
import {default as removeDuplicatesFromSource} from './removeIdenticalDataFields.js';
// const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

const defaultConfig = JSON.parse(fs.readFileSync(path.join(import.meta.dirname , '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

export const localReducers = [
  //// PREPROCESSOR STUFF:
  // UTF-8 normalization: if wanted, see mergeField.js for an example
  genericPreprocessor(), // Should this be moved downward? // (1 param config, uses config.json as default config, 2 param. internal)
  metatietosanastoNormalizations(),  // (no config)
  prepublicationPreprocessor(), // (noconfig)
  removeDuplicatesFromSource(), // handles $6 and $8 chains as well (but apparently badly) // (no config)
  reindexSubfield6(), // Reindex $6 subfields from source, base remains unchanged. // (no config)
  reindexSubfield8(), // Reindex $8 subfields from source, base remains unchanged. // (no config)
  manufacturer260To264(), // (no config)

  //// ACTUAL MERGE/ADD STUFF:
  //internalFields(), // LOW, CAT, SID. Nowadays part of genericDatafield()
  leader(), // Test 01 // (no config) // NOTE: this one errors differing LDR/06 + LDR/07
  field006(), // Tests 02 and 03 // (no config)
  field007(), // Tests 04 and 05 // (no config)
  field008(), // Tests 06, 07, and 08 // (no config)
  mergeDataFields(), // (1. param tagPattern, 2. param config, uses config.json as default config)
  addDataFields(), // (1. param config, uses config.json as default config)
  postprocessor() // (1. param config, uses config.json as default config)
];

// Currently same as localReducers
// these are used for human supervised merge of two Melinda database records to a new Melinda record
export const mergeReducersForMergeUI = [
  //// PREPROCESSOR STUFF:
  // UTF-8 normalization: if wanted, see mergeField.js for an example
  genericPreprocessor(defaultConfig, true), // Should this be moved downward?
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
  genericPreprocessor(), // Should this be moved downward? // (1 param config, uses config.json as default config)
  metatietosanastoNormalizations(),  // (no config)
  muuntajaMergeDataFields(), // (1. param tagPattern, 2. param config, uses muuntajaConfig.json as default config)
  addDataFields(), // (1. param config, uses config.json as default config)
  postprocessor() // (1. param config, uses config.json as default config)
];
