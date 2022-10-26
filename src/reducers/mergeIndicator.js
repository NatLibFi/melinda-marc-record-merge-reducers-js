//import {MarcRecord} from '@natlibfi/marc-record';
//import createDebugLogger from 'debug';
//import {/*fieldToString,*/ nvdebug} from './utils';

import {marc21GetTagsLegalInd1Value, marc21GetTagsLegalInd2Value, nvdebug} from './utils';

//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

// const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeField');


const ind1NonFilingChars = ['130', '630', '730', '740'];
const ind2NonFilingChars = ['222', '240', '242', '243', '245', '830'];


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

  function getIndicatorPreferredValues(tag, indicatorNumber, config) {
    const cands = getIndicatorPreferredValuesForGivenTag(tag, indicatorNumber, config);
    // More complex systems where multiple indicators have same priority are objects.
    // Example: field 506 might return {"0": 1, "1": 1, " ": 2}
    // Here indicator values '0' and '1' share top priority 1, and '#' is of lesser importance, namely 2.
    if (Array.isArray(cands) || typeof cands === 'object') {
      return cands;
    }
    if (typeof cands === 'string') { // single cand as string (seen in json in the past), though now they should all be arrays
      return cands.split('');
    }

    return [];

    function getIndicatorPreferredValuesForGivenTag(tag, indicatorNumber, config) {
      const preferredValues = indicatorNumber === 1 ? config.indicator1PreferredValues : config.indicator2PreferredValues;
      nvdebug(`${tag} IND${indicatorNumber}: get preferred values...\nCONFIG: ${JSON.stringify(config)}`);
      if (preferredValues) {
        //nvdebug(`${tag} PREF VALS: ${JSON.stringify(preferredValues)}`);
        if (tag in preferredValues) {
          return preferredValues[tag];
        }
      }

      // Easter Egg #1: Use good-ish hard-coded defaults as not defined by user:
      if (indicatorNumber === 1 && ind1NonFilingChars.includes(tag)) {
        return '9876543210 ';
      }
      if (indicatorNumber === 2 && ind2NonFilingChars.includes(tag)) {
        return '9876543210 ';
      }

      // Easter Egg #2: Marc21 standard has just one value for given indicator, so prefer it:
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

  function getPreferredValue(preferences, val1, val2) {
    const i1 = scoreValue(preferences, val1);
    const i2 = scoreValue(preferences, val2);
    if (i1 === -1) {
      return i2 === -1 ? undefined : val2;
    }
    if (i2 === -1) {
      return val1;
    }
    // The sooner, the better:
    return i1 < i2 ? val1 : val2;

    function scoreValue(preferences, val) {
      if (Array.isArray(preferences)) {
        return preferences.indexOf(val);
      }
      // preferences may be an object, since diffent values can return same score
      // (eg. 506 ind1 values '0' and '1' are equal but better than '#')
      if (!(val in preferences)) {
        return -1;
      }
      return preferences[val];
    }
  }

  function mergeIndicator1(toField, fromField, config) {
    if (toField.ind1 === fromField.ind1) {
      return; // Do nothing
    }

    const preferredValues = getIndicatorPreferredValues(toField.tag, 1, config);

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
    const preferredValues = getIndicatorPreferredValues(toField.tag, 2, config);

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
