//import {MarcRecord} from '@natlibfi/marc-record';
//import createDebugLogger from 'debug';
import {fieldToString, nvdebug} from './utils';

//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

// const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeField');

const ind1NonFilingChars = ['130', '630', '730', '740'];
const ind2NonFilingChars = ['222', '240', '242', '243', '245', '830'];

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

  // There are bunch of indicators that should always be '#'. Should we include them here?
  return false;
}

function skippableIndicator2ByDefault(tag) {
  // When checking similarity of indicators, we are not interested in non-filing characters
  if (ind2NonFilingChars.includes(tag)) {
    return true;
  }
  return false;
}

export function indicator1Matches(field1, field2, skipPolicy = undefined) {
  // skipPolicy explained:
  // - undefined: use defaults (eg. skip non-filing characters)
  // - true: return true (user allows this in some configuration file)
  // - false: skip defaults, always compare field1.ind1 === field2.ind1

  if (skipPolicy === true) {
    return true;
  }

  if (skipPolicy === undefined && skippableIndicator1ByDefault(field1.tag)) {
    return true;
  }

  // Default: require that indicators match
  return field1.ind1 === field2.ind1;
}

export function indicator2Matches(field1, field2, skipPolicy = undefined) {
  // skipPolicy is explained in indicator1Matches() above.
  if (skipPolicy === true) {
    return true;
  }
  if (skipPolicy === undefined && skippableIndicator2ByDefault(field1.tag)) {
    return true;
  }

  // Default: indicators must match
  return field1.ind2 === field2.ind2;
}

export function mergeIndicators(toField, fromField) {
  // NB! For non-filing indicators we deem that bigger is better. This is a bit quick'n'dirty, as usual.
  // We could and should checks the relevant article length (using language information whilst doing it).
  // However, this is a task for record internal fixer, not merge.
  //
  // NB! We could add fixes for various other indicator types as well. However, it gets quickly pretty ad hoc.
  nvdebug(fieldToString(toField));
  nvdebug(fieldToString(fromField));
  mergeIndicator1(toField, fromField);
  mergeIndicator2(toField, fromField);
  function mergeIndicator1(toField, fromField) {
    if (toField.ind1 === fromField.ind1) {
      return; // Do nothing
    }
    if (ind1NonFilingChars.includes(toField.tag)) {
      toField.ind1 = getBigger(toField.ind1, fromField.ind1); // eslint-disable-line functional/immutable-data
      return;
    }
  }

  function mergeIndicator2(toField, fromField) {
    if (ind2NonFilingChars.includes(toField.tag)) {
      toField.ind2 = getBigger(toField.ind2, fromField.ind2); // eslint-disable-line functional/immutable-data
      return;
    }
  }

  function stringIsDigit(val) {
    return (/^[0-9]$/u).test(val);
  }

  function getBigger(value1, value2) {
    if (value1 === ' ' && stringIsDigit(value2)) {
      return value2;
    }
    if (stringIsDigit(value1) && stringIsDigit(value2)) {
      if (parseInt(value2, 10) > parseInt(value1, 10)) {
        return value2;
      }
    }
    return value1;
  }
}
