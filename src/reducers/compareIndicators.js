//import {MarcRecord} from '@natlibfi/marc-record';
//import createDebugLogger from 'debug';
//import {fieldToString, nvdebug} from './utils';

import {marc21NoNeedToCheckInd1, marc21NoNeedToCheckInd2, marc21GetTagsLegalInd1Value, marc21GetTagsLegalInd2Value, nvdebug} from './utils';

//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

// const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeField');


const ind1NonFilingChars = ['130', '630', '730', '740'];
const ind2NonFilingChars = ['222', '240', '242', '243', '245', '830'];

// (010|013|015)
/*

function skippableIndicator1ByDefault(tag) {
  // When checking similarity of indicators, we are not interested in non-filing characters
  if (ind1NonFilingChars.includes(tag)) {
    return true;
  }

  // Exceptions:
  // 245: value is based on the presence of a 1XX field, which may vary
  if (['245'].includes(tag)) {
    return true;
  }

  // NB! There are bunch of indicators that have only one way (typically '#'). Should we list meaningless indicators somewhere?
  return false;
}

function skippableIndicator2ByDefault(tag) {
  // When checking similarity of indicators, we are not interested in non-filing characters
  if (ind2NonFilingChars.includes(tag)) {
    return true;
  }
  return false;
}
*/

export function mergableIndicator1(field1, field2, config) {
  // Indicators are identical:
  if (field1.ind1 === field2.ind1) {
    return true;
  }
  const {tag} = field1;
  // Indicator has but one legal value or is a non-fliing indicator (NB: can not be overridden via config...):
  if (marc21NoNeedToCheckInd1(tag) || ind1NonFilingChars.includes(tag)) {
    return true;
  }
  // Override via config:
  if (config.ignoreIndicator1 && config.ignoreIndicator1.includes(tag)) {
    return true;
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
  // Fail:
  return false;
}

export function mergeIndicators(toField, fromField, config) {
  // NB! For non-filing indicators we deem that bigger is better. This is a bit quick'n'dirty, as usual.
  // We could and should checks the relevant article length (using language information whilst doing it).
  // However, this is a task for record internal fixer, not merge.
  //
  // For other indicators the situation is trickier, as we don't know which one is the good value.
  //
  // NB! We could add fixes for various other indicator types as well. However, it gets quickly pretty ad hoc.
  // nvdebug(fieldToString(toField));
  // nvdebug(fieldToString(fromField));

  mergeIndicator1(toField, fromField, config);
  mergeIndicator2(toField, fromField, config);

  function getIndicatorPreferredValuesArray(tag, indicatorNumber, config) {

    const cands = getIndicatorPreferredValuesWhatever(tag, indicatorNumber, config);
    if (Array.isArray(cands)) {
      return cands;
    }
    if (typeof cands === 'string') { // single cand as string (seen in json in the past)
      return cands.split('');
    }

    return [];

    function getIndicatorPreferredValuesWhatever(tag, indicatorNumber, config) {
      const preferredValues = indicatorNumber === 1 ? config.indicator1PreferredValues : config.indicator2PreferredValues;
      nvdebug(`${tag} IND${indicatorNumber}: get preferred values...\nCONFIG: ${JSON.stringify(config)}`);
      if (preferredValues) {
        //nvdebug(`${tag} PREF VALS: ${JSON.stringify(preferredValues)}`);
        if (tag in preferredValues) {
          return preferredValues[tag];
        }
      }

      // Easter Egg #1: Use good hard-coded defaults as not defined by user:
      if (indicatorNumber === 1 && ind1NonFilingChars.includes(tag)) {
        return '9876543210 ';
      }
      if (indicatorNumber === 2 && ind2NonFilingChars.includes(tag)) {
        return '9876543210 ';
      }

      // Easter Egg #2: Marc21 standard allows just one value:
      const cands = indicatorNumber === 1 ? marc21GetTagsLegalInd1Value(tag) : marc21GetTagsLegalInd2Value(tag);
      if (cands) {
        if (typeof cands === 'string' && cands.length === 1) { // single cand
          return [cands];
        }
        if (Array.isArray(cands) && cands.length === 1) {
          return cands;
        }
      }

      return [];
    }
  }

  function getPreferredValue(preferenceString, val1, val2) {
    const i1 = preferenceString.indexOf(val1);
    const i2 = preferenceString.indexOf(val2);
    if (i1 === -1) {
      return i2 === -1 ? undefined : val2;
    }
    if (i2 === -1) {
      return val1;
    }
    // The sooner, the better:
    return i1 < i2 ? val1 : val2;
  }

  function mergeIndicator1(toField, fromField, config) {
    if (toField.ind1 === fromField.ind1) {
      return; // Do nothing
    }

    const preferredValues = getIndicatorPreferredValuesArray(toField.tag, 1, config);

    if (preferredValues) {
      //nvdebug(`Try to merge indicator 1: '${toField.ind1}' vs '${fromField.ind1}'`);
      //nvdebug(`PREF VALS: ${preferredValues}`);
      const preferredValue = getPreferredValue(preferredValues, fromField.ind1, toField.ind1);
      if (typeof preferredValue !== 'undefined') {
        //nvdebug(`${preferredValue} WINS!`);
        toField.ind1 = preferredValue; // eslint-disable-line functional/immutable-data
        return;
      }
      //nvdebug(`No winner found indicator 1: '${toField.ind1}' vs '${fromField.ind1}', keep '${toField.ind1}'`);
      //return;
    }
    //nvdebug(`TAG '${toField.tag}': No rule to merge indicator 1: '${toField.ind1}' vs '${fromField.ind1}', keep '${toField.ind1}'`);
  }


  function mergeIndicator2(toField, fromField, config) {
    if (toField.ind2 === fromField.ind2) {
      return; // Do nothing
    }
    //nvdebug(`Try to merge indicator 2: '${toField.ind2}' vs '${fromField.ind2}'`);
    const preferredValues = getIndicatorPreferredValuesArray(toField.tag, 2, config);

    if (preferredValues) {
      //nvdebug(`  Try to merge indicator 2. Got preferred values '${preferredValues}'`);
      const preferredValue = getPreferredValue(preferredValues, fromField.ind2, toField.ind2);
      if (typeof preferredValue !== 'undefined') {
        toField.ind2 = preferredValue; // eslint-disable-line functional/immutable-data
        return;
      }
    }

  }

}
