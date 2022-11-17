//import {MarcRecord} from '@natlibfi/marc-record';
//import createDebugLogger from 'debug';
//import {/*fieldToString,*/ nvdebug} from './utils';

import {marc21GetTagsLegalInd1Value, marc21GetTagsLegalInd2Value} from './utils';

//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

// const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeField');


const ind1NonFilingChars = ['130', '630', '730', '740'];
const ind2NonFilingChars = ['222', '240', '242', '243', '245', '830'];

function marc21NoNeedToCheckInd1(tag) {
  const cands = marc21GetTagsLegalInd1Value(tag);
  if (typeof cands === 'string') { // single cand
    return true;
  }
  return false;
}

function marc21NoNeedToCheckInd2(tag) {
  const cands = marc21GetTagsLegalInd2Value(tag);
  if (typeof cands === 'string') { // single cand
    return true;
  }
  return false;
}


export function mergableIndicator1(field1, field2, config) {
  // Indicators are identical:
  if (field1.ind1 === field2.ind1) {
    return true;
  }
  const {tag} = field1; // means "tag = field1.tag"
  // Indicator has but one legal value or is a non-filing indicator (NB: can not be overridden via config...):
  if (marc21NoNeedToCheckInd1(tag) || ind1NonFilingChars.includes(tag)) {
    return true;
  }
  // Override via config:
  if (config.ignoreIndicator1 && config.ignoreIndicator1.includes(tag)) {
    return true;
  }
  // Tolerate value '#' (reason: not spefified etc, the other value is supposedly a good one)
  if (field1.ind1 === ' ' || field2.ind1 === ' ') {
    return config.tolerateBlankIndicator1 && config.tolerateBlankIndicator1.includes(tag);
  }
  // Fail:
  return false;
}

export function mergableIndicator2(field1, field2, config) {
  // Indicators are identical:
  if (field1.ind2 === field2.ind2) {
    return true;
  }
  const {tag} = field1;
  // Indicator has but one legal value or is a non-fliing indicator (NB: can not be overridden via config...):
  if (marc21NoNeedToCheckInd2(tag) || ind2NonFilingChars.includes(tag)) {
    return true;
  }
  // Override via config:
  if (config.ignoreIndicator2 && config.ignoreIndicator2.includes(tag)) {
    return true;
  }
  // Tolerate value '#' (reason: not spefified etc, the other value is supposedly a good one)
  if (field1.ind2 === ' ' || field2.ind2 === ' ') {
    return config.tolerateBlankIndicator2 && config.tolerateBlankIndicator2.includes(tag);
  }
  // Fail:
  return false;
}
