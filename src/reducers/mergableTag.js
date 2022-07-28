//import createDebugLogger from 'debug';
//const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

const defaultNonMergableNonAddableFields = [
  '066', // 066 - Character sets present (NR)
  // Them 8XX fields are holdingds related fields:
  '841',
  '842',
  '843',
  '844',
  '845',
  '852',
  '853',
  '854',
  '855',
  '863',
  '864',
  '865',
  '866',
  '867',
  '868',
  '876',
  '877',
  '878',
  'HLI' // Aleph internal noise
];

const defaultNonMergableFields = [
  '382', // 382: merging would be madness... However, this will miss cases, where only $5 or $9 differs...
  // 59X: always copy, never merge. NB! No specs exist!
  '590',
  '591',
  '592',
  '593',
  '594',
  '595',
  '596',
  '597',
  '598',
  '599',
  '654',
  '656',
  '657',
  '658',
  '662',
  '668',
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
  '774',
  '775',
  '776',
  '777',
  '780',
  '785',
  '786',
  '787',
  '856',
  '881',
  '882',
  '883',
  '884',
  '885',
  '886',
  '887',
  '900',
  '901',
  '910',
  '940',
  '960',
  '995',
  'CAT',
  'LOW',
  'SID'
];

export function mergableTag(tag, skipList = []) {
  if (skipList.length > 0) {
    return !skipList.includes(tag);
  }

  return !(defaultNonMergableFields.includes(tag) || defaultNonMergableNonAddableFields.includes(tag));
}

export function addableTag(tag, skipList = []) {
  if (skipList.length > 0) {
    return !skipList.includes(tag);
  }

  //return !(tag in defaultNonMergableNonAddableFields);
  return !defaultNonMergableNonAddableFields.includes(defaultNonMergableNonAddableFields);
}
