import {copy} from '@natlibfi/marc-record-merge';
import * as localReducers from './reducers';
import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
export * from './reducers';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

// ### Keskeneräinen

// Processing rules for MARC fields by field tag
// Copy duplicate instance of non-identical field from source to base
/* eslint-disable require-unicode-regexp */
const copyIfDifferent = new RegExp(String((/^(?<tags>013|015|016|017|028|050|052|055|060|070|080|082|083|084|210|242|246|255|258|321)$/u).source) +
  (/^(?<tags>336|337|338|340|341|342|343|344|346|348|351|352|355|362|363|365|366|370|377)$/u).source +
  (/^(?<tags>380|381|382|383|385|386|388|490|500|501|502|504|505|508|509|510|511|513|515|518)$/u).source +
  (/^(?<tags>520|521|522|524|525|530|534|535|536|538|541|542|544|545|546|547|550|552|555)$/u).source +
  (/^(?<tags>556|562|563|565|567|580|581|584|585|586|720|740|751|752|753|754|758|760)$/u).source +
  (/^(?<tags>762|765|767|770|772|775|776|777|780|785|786|787|883|886|887|900|910|911|940)$/u).source);

// Copy field from source only if missing from base (compareTagsOnly = true)
const copyIfMissing = /^(?<tags>010|018|027|030|031|043|044|049|085|088|222|243|247|260|263|264|306|310|357|384|507|514)$/u;

// Special rules defined for certain sets of fields
// Exclude subfields from identicalness comparison and/or drop subfields from source before copying
// Fields are considered identical if all other subfields than excludeSubfields are identical
const copySpecial1 = /^(?<tags>036)$/u; // Exclude subfields b, 6 and 8
const copySpecial2 = /^(?<tags>648|653|655|656|657)$/u; // Exclude subfield 9
const copySpecial3 = /^(?<tags>800|810|811)$/u; // Drop subfield 4
const copySpecial4 = /^(?<tags>600|610|611|630|650|651|654|662)$/u; // Exclude subfield 9 and drop 4

// Customized reducers still to be done for fields:
// mainEntry: 100|110|111|130|240|700|710|711|730
// [240, 250, 347, 506, 540, 561, 588, 856]

// Huom. tarkistettava missä järjestyksessä reducerit ajetaan
// Ensin ajetaan ne joiden tuottama tulos vaikuttaa siihen mitä joillekin toisille kentille tehdään
const allReducers = [
  copy({tagPattern: copyIfDifferent}),
  copy({tagPattern: copyIfMissing, compareTagsOnly: true}),
  copy({tagPattern: copySpecial1, excludeSubfields: ['b', '6', '8']}),
  copy({tagPattern: copySpecial2, excludeSubfields: ['9']}),
  copy({tagPattern: copySpecial3, dropSubfields: ['4']}),
  copy({tagPattern: copySpecial4, excludeSubfields: ['9'], dropSubfields: ['4']}),
  localReducers.internalFields(), // LOW, CAT, SID
  localReducers.leader(), // Test 01
  localReducers.mainEntry(), // Main entry fields
  localReducers.selectLonger(), // Used for fields 033, 034, 046, 257, 300 (repeatable) and 039, 045 (non-repeatable)
  localReducers.field006(), // Tests 02 and 03
  localReducers.field007(), // Tests 04 and 05
  localReducers.field008(), // Tests 06, 07, and 08
  localReducers.field020(), // Tests 09, 10 and 11
  localReducers.field022(), // Tests 12, 13 and 14
  localReducers.field024(), // Tests 15, 16 and 17
  localReducers.field040(), // Tests 18 and 19
  localReducers.field042(), // Tests 20 and 21
  localReducers.field245(), // Tests 31, 32 and 33
  localReducers.field830(), // Tests 22-29
  localReducers.field995() // Test 30
];

// ### Miten tästä rakennetaan kokonaisuus jossa tutkitaan tietueen kaikki kentät?
// Eli kaikki ne joissa käytetään vain copya sekä ne, joille on erikseen kustomoitu omat säännöt.
// Miten päästään tarkistamaan eri numeroisia kenttiä toisiaan vasten?
// Siis esim. speksin mukaan kentän 540 arvo riippuu siitä, mikä on kentän 506 arvo.
// Pannaanko silloin samaan reduceriin sekä 540 että 506?
// täytyy panna oikeaan järjestykseen tähän allReducers arrayhin
// molemmat kentät samaan testiin ja siihen source/base.get(506)
export {localReducers};
export default ({base, source, allReducers}) => {
  debug(`inside export default`);
  const sourceRecord = MarcRecord.clone(source);
  return allReducers.reduce((baseRecord, reducer) => reducer(baseRecord, sourceRecord), MarcRecord.clone(base));
};
