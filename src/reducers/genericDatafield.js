//import createDebugLogger from 'debug';

import {
  tagToRegexp,
  mergeOrAddField
} from './mergeField.js';

// const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

// Array of datafields *that are handled by the generic code*!
// NB! 100/110/111/130-700/710/711/730 stuff is in mainEntry.js
// Hmm... This list is incomplete. How to handle 6XX etc?
// 384|507|514
const datafields = [
  '010', // non-repeatable
  '013',
  '015',
  '016',
  '017',
  '018', // non-repeatable
  '020',
  '022',
  '024',
  '027', // is repeatable but listed in copyIfMissing. Why?
  '028',
  '030', // is repeatable but listed in copyIfMissing. Why?
  '031', // is repeatable but listed in copyIfMissing. Why?
  '033',
  '034',
  '028',
  '035',
  '040',
  '042',
  '043', // is repeatable but listed in copyIfMissing. Why?
  '044', // non-repeatable
  '046',
  '049', // non-repeatable
  '050',
  '052',
  '055',
  '060',
  '070',
  '080',
  '082',
  '083',
  '084',
  '085', // is repeatable but listed in copyIfMissing. Why?
  '088', // is repeatable but listed in copyIfMissing. Why?
  // 100, 110, 111 and 130 are handled by mainEntry.js
  '100', '110', '111', '130',
  '210',
  '222', // is repeatable but listed in copyIfMissing. Why?
  '240',
  '242',
  '243', // non-repeatable
  '245',
  '246',
  '247', // is repeatable but listed in copyIfMissing. Why?
  '250',
  '255',
  '258',
  '260', // non-repeatable (also 260 and 264 shouldn't co-exist, but don't worry about it here)
  '263', // non-repeatable
  '264', // non-repeatable (also 260 and 264 shouldn't co-exist, but don't worry about it here)
  // 300 needs thinking... technically repeatable, but we don't want to repeat it...
  '306', // non-repeatable
  '310', // is repeatable but listed in copyIfMissing. Why?
  '321',
  '336',
  '337',
  '338',
  '340',
  '341',
  '342',
  '343',
  '344',
  '346',
  '347',
  '348',
  '351',
  '352',
  '355',
  '357', // non-repeatable
  '362',
  '363',
  '365',
  '366',
  '370',
  '377',
  '380',
  '381',
  '382',
  '383',
  '384', // is repeatable but listed in copyIfMissing. Why?
  '385',
  '386',
  '388',
  '490',
  '500',
  '501',
  '502',
  '504',
  '505',
  '505',
  '506',
  '507', // non-repeatable
  '508',
  '509',
  '510',
  '511',
  '513',
  '514', // non-repeatable
  '515',
  '518',
  '520',
  '521',
  '522',
  '524',
  '525',
  '530',
  '534',
  '535',
  '536',
  '538',
  '540',
  '541',
  '542',
  '544',
  '545',
  '546',
  '547',
  '550',
  '552',
  '555',
  '556',
  '561',
  '562',
  '563',
  '565',
  '567',
  '580',
  '581',
  '584',
  '585',
  '586',
  '588',
  '600',
  '610',
  '611',
  '630',
  '647',
  '648',
  '650',
  '651',
  '653',
  '654',
  '655',
  '656',
  '657',
  '658',
  '662',
  '688',
  // 700, 710, 711 and 730 are handled by mainEntry.js
  '700', '710', '711', '730',
  '720',
  '740',
  '751',
  '752',
  '753',
  '754',
  '758',
  '760',
  '762',
  '765',
  '767',
  '770',
  '772',
  '775',
  '776',
  '777',
  '780',
  '785',
  '786',
  '787',
  '800',
  '810',
  '811',
  '830',
  '856',
  '880',
  '883',
  '886',
  '887',
  '900',
  '910',
  '911',
  '940',
  '995'
];

export default () => (record, record2) => {
  datafields.forEach(tag => {
    const tagAsRegexp = tagToRegexp(tag);
    const candidateFields = record2.get(tagAsRegexp); // Get array of source fields
    candidateFields.forEach(candField => mergeOrAddField(record, candField));
  });
  return record;
};


