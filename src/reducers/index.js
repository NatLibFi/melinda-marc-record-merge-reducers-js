/**
 * Erätuonnit: MARC-kenttien käsittely tuonnissa
 * https://workgroups.helsinki.fi/pages/viewpage.action?pageId=154377436
 *
 */
import {reducers} from '@natlibfi/marc-record-merge';
import * as localReducers from './reducers';
import createDebugLogger from 'debug';


//export reducers;
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

export default [
  // ###MARC-kentät taulukosta: https://workgroups.helsinki.fi/x/K1ohCw
  // Copy duplicate instance of (non-identical) repeatable field from source to base
  copy({tagPattern: /^(013|015|016|017|050|052|055|060|070|080|082|083|084|210|242|246|255|258|321)$/}),
  copy({tagPattern: /^(336|337|338|340|341|342|343|344|346|348|351|352|355|362|363|365|366|370|377)$/}),
  copy({tagPattern: /^(380|381|382|383|385|386|388|490|501|502|504|505|508|509|510|511|513|515|518)$/}),
  copy({tagPattern: /^(520|521|522|524|525|530|534|535|536|538|541|542|544|545|546|547|550|552|555)$/}),
  copy({tagPattern: /^(556|562|563|565|567|580|581|584|585|586|720|730|740|751|752|753|754|758|760)$/}),
  copy({tagPattern: /^(762|765|767|770|772|775|776|777|780|785|786|787|883|886|887|900|910|911|940)$/}),
  // ###Erityinen sääntö ISIL-koodin käsittelyyn? (osakenttä 5):
  copy({tagPattern: /^(037|040|506|540|561)$/}),

  // Copy non-repeatable field from source only if missing from base
  copy({tagPattern: /^(010|018|027|030|031|043|044|049|085|088|222|243|247|263|306|310|357|384|507|514)$/, compareTagsOnly: true}),

  // Exclude subfields from identicalness comparison and/or drop subfields from source before copying
  // Fields are considered identical if all other subfields than excludeSubfields are identical
  copy({tagPattern: /^036$/, excludeSubfields: ["b", "6", "8"]}),
  copy({tagPattern: /^(648|653|655|656|657)$/, excludeSubfields: ["9"]}),
  copy({tagPattern: /^(700|710|711|800|810|811)$/, dropSubfields: ["4"]}),
  copy({tagPattern: /^(600|610|611|630|650|651|654|662)$/, excludeSubfields: ["9"], dropSubfields: ["4"]}),

  // If source field is longer, replace base field with source field
  select({tagPattern: /^(033|034|039|045|046|257|300)/, equalityFunction = subsetEquality}),

  // Customized reducers
  leader({tagPattern: /^LDR$/}), // Test 01
  field006({tagPattern: /^006$/}), // Tests 02 and 03
  field007({tagPattern: /^007$/}), // Tests 04 and 05
  field008({tagPattern: /^008$/}) // Tests 06, 07, and 08
];

// Customized reducers for fields:
// [006, 007, 008, 040, 042, 240, 250, 260, 264, 347, 500, 506, 830, 856, 995]
// [000, 020, 022, 024, 028, 036, 100, 110, 111, 130, 245, 300, 588]
