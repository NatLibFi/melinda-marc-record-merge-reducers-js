//import createDebugLogger from 'debug';
//const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

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

export function mergableTag(tag, skipPolicy = undefined) {
  // undefined skipPolicy: use defaults (eg. skip non-filing characters)
  if (skipPolicy === undefined) {
    return !(tag in defaultNonMergableFields);
  }

  return !skipPolicy; // if skip merge, it is not mergable and vice versa
}
