//import createDebugLogger from 'debug';
import {default as normalizeEncoding} from '@natlibfi/marc-record-validators-melinda/dist/normalize-utf8-diacritics';

//const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
//const debugData = debug.extend('data');

//import {nvdebug} from './utils';


export default () => (base, source) => {
  const base2 = recordPreprocess(base);
  const source2 = recordPreprocess(source);
  return {base: base2, source: source2};
};

export function recordPreprocess(record) { // For both base and source record
  if (!record.fields) {
    return record;
  }

  normalizeEncoding().fix(record);

  // We could fix other issues such us:
  // - normalize non-breaking space etc whitespace characters
  // - normalize various '-' letters in ISBN et al?
  // - normalize various copyright signs
  // - FIN01 vs (FI-MELINDA)? No... Probably should not be done here.

  return record;
}

