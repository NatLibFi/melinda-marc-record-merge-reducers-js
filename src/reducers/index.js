/**
 * Erätuonnit: MARC-kenttien käsittely tuonnissa
 * https://workgroups.helsinki.fi/pages/viewpage.action?pageId=154377436
 *
 */
import {copy, select, subsetEquality} from '@natlibfi/marc-record-merge';
import * as localReducers from './reducers';
//import createDebugLogger from 'debug';
export * from './reducers';

//const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

// Processing rules for MARC fields by field tag
// ###MARC-kentät taulukosta: https://workgroups.helsinki.fi/x/K1ohCw

// Copy duplicate instance of (non-identical) repeatable field from source to base
// Note: Tags divided into groups 1-6 for on-screen readability, logically they could all go in the same copyTags group
const copyTags1 = /^(?<tags>013|015|016|017|050|052|055|060|070|080|082|083|084|210|242|246|255|258|321)$/u;
const copyTags2 = /^(?<tags>336|337|338|340|341|342|343|344|346|348|351|352|355|362|363|365|366|370|377)$/u;
const copyTags3 = /^(?<tags>380|381|382|383|385|386|388|490|501|502|504|505|508|509|510|511|513|515|518)$/u;
const copyTags4 = /^(?<tags>520|521|522|524|525|530|534|535|536|538|541|542|544|545|546|547|550|552|555)$/u;
const copyTags5 = /^(?<tags>556|562|563|565|567|580|581|584|585|586|720|730|740|751|752|753|754|758|760)$/u;
const copyTags6 = /^(?<tags>762|765|767|770|772|775|776|777|780|785|786|787|883|886|887|900|910|911|940)$/u;

// Copy non-repeatable field from source only if missing from base
const copyTagsNonRep = /^(?<tags>010|018|027|030|031|043|044|049|085|088|222|243|247|263|306|310|357|384|507|514)$/u;

// ###Erityinen sääntö ISIL-koodin käsittelyyn? (osakenttä 5), ei vielä toteutettu
const copyTagsSpecial1 = /^(?<tags>037|040|506|540|561)$/u;

// Exclude subfields from identicalness comparison and/or drop subfields from source before copying
// Fields are considered identical if all other subfields than excludeSubfields are identical
const copyTagsSpecial2 = /^(?<tags>036)$/u;
const copyTagsSpecial3 = /^(?<tags>648|653|655|656|657)$/u;
const copyTagsSpecial4 = /^(?<tags>700|710|711|800|810|811)$/u;
const copyTagsSpecial5 = /^(?<tags>600|610|611|630|650|651|654|662)$/u;

// If source field is longer, replace base field with source field
const selectTags = /^(?<tags>033|034|039|045|046|257|300)$/u;

export default [
  copy({tagPattern: copyTags1}),
  copy({tagPattern: copyTags2}),
  copy({tagPattern: copyTags3}),
  copy({tagPattern: copyTags4}),
  copy({tagPattern: copyTags5}),
  copy({tagPattern: copyTags6}),
  copy({tagPattern: copyTagsNonRep, compareTagsOnly: true}),
  copy({tagPattern: copyTagsSpecial1}),
  copy({tagPattern: copyTagsSpecial2, excludeSubfields: ['b', '6', '8']}),
  copy({tagPattern: copyTagsSpecial3, excludeSubfields: ['9']}),
  copy({tagPattern: copyTagsSpecial4, dropSubfields: ['4']}),
  copy({tagPattern: copyTagsSpecial5, excludeSubfields: ['9'], dropSubfields: ['4']}),
  select({tagPattern: selectTags, subsetEquality}),

  // Customized reducers
  localReducers.leader(), // Test 01
  localReducers.field006(), // Tests 02 and 03
  localReducers.field007(), // Tests 04 and 05
  localReducers.field008(), // Tests 06, 07, and 08
  localReducers.field020() // Tests 09, 10 and 11
];

// Customized reducers for fields:
// [006, 007, 008, 040, 042, 240, 250, 260, 264, 347, 500, 506, 830, 856, 995]
// [000, 020, 022, 024, 028, 036, 100, 110, 111, 130, 245, 300, 588]
