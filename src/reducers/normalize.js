import clone from 'clone';
import {fieldStripPunctuation} from './punctuation.js';
import {fieldToString, isControlSubfieldCode, nvdebug} from './utils.js';

import {default as normalizeEncoding, fieldFixComposition, fieldRemoveDecomposedDiacritics} from './normalizeEncoding';
import {fieldNormalizePrefixes} from './normalizeIdentifier';
import {getMaxSubfield6, reindexSubfield6s} from './reindexSubfield6.js';
import {getMaxSubfield8, reindexSubfield8s} from './reindexSubfield8.js';
import createDebugLogger from 'debug';
import {recordNormalizeSubfield9Linkage} from './normalizeSubfield9Linkage.js';
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:normalize');

/*
// We might want something like this:
function normalizationExceptions(value = "") {
  // This is just a placeholder for now.
  // Possible normalizations include but are not limited to:
  // ø => ö? Might be language dependent: 041 $a fin => ö, 041 $a eng => o?
  // Ø => Ö?
  // ß => ss
  // þ => th (NB! Both upper and lower case)
  // ...
  // Probably nots:
  // ü => y (probably not, though this correlates with Finnish letter-to-sound rules)
  // w => v (OK for Finnish sorting in certain cases, but we are not here, are we?)
  // I guess we should use decomposed values in code here. (Not sure what composition my examples above use.)
  return value;
}
*/


// NB! These are defined also in mergeSubfield.js. Do something...
const notYear = /^\([1-9][0-9]*\)[,.]?$/u;

function fieldRemoveDatesAssociatedWithName(field) {
  // Skip irrelevant fields:
  if (!field.tag.match(/^[1678]00$/u)) {
    return field;
  }
  field.subfields = field.subfields.filter(sf => !isIndexNotDate(sf)); // eslint-disable-line functional/immutable-data
  return field;

  function isIndexNotDate(subfield) {
    if (subfield.code !== 'd') {
      return false;
    }
    debug(`INSPECT $d '${subfield.value}'`);
    if (!notYear.test(subfield.value)) {
      return false;
    }
    debug(`MATCH $d '${subfield.value}`);
    return true;
  }
}

/*
function dontLowercase(tag, subfieldCode) {
  if (isControlSubfieldCode(subfieldCode)) {
    return true;
  }
  // (Used mostly when merging subfields (as if normalized version exists, adding new subfield is skipped.)
  return false;
}
*/

function fieldLowercase(field) {
  // Skip non-interesting fields
  if (!['100', '110', '240', '245', '600', '610', '630', '700', '710', '800', '810'].includes(field.tag)) {
    return;
  }
  field.subfields.forEach(sf => {
    if (isControlSubfieldCode(sf.code)) {
      return;
    }
    sf.value = sf.value.toLowerCase(); // eslint-disable-line functional/immutable-data
  });
}

function fieldPreprocess(field) {
  // Do nothing for control fields or corrupted data fields:
  if (!field.subfields) {
    return field;
  }

  //// 1. Fix composition
  // I don't want to use normalizeSync(). "åäö" => "aao". Utter crap! NB: Use something else later on!
  fieldFixComposition(field);
  //// 2. Fix other shit
  // - remove crappy 100$d subfields:
  fieldRemoveDatesAssociatedWithName(field); // eg. "100$d (1)"
  field.subfields.forEach(sf => {
    // Possible things to do:
    // 2. Fix other issues
    // - normalize non-breaking space etc whitespace characters
    // - normalize various '-' letters in ISBN et al?
    // - normalize various copyright signs
    // - FIN01 vs (FI-MELINDA)? No... Probably should not be done here.
    // - remove 020$c? This one would a bit tricky, since it often contains non-price information...
    // 3. Trim
    sf.value.replace(/\s+/gu, ' ').trim(); // eslint-disable-line functional/immutable-data
    sf.value.replace(/^\s/u, '').trim(); // eslint-disable-line functional/immutable-data
    sf.value.replace(/\s$/u, '').trim(); // eslint-disable-line functional/immutable-data
  });
  return field;
}


function normalizeField(field) {
  fieldPreprocess(field); // spacing, composition, diacritics, remap wrong utf-8 characters (eg. various - characters)
  //sf.value = removeDecomposedDiacritics(sf.value); // eslint-disable-line functional/immutable-data
  fieldStripPunctuation(field);
  fieldLowercase(field);
  fieldNormalizePrefixes(field);
  return field;
}

function fieldComparison(oldField, newField) {
  if (oldField.subfields.length === newField.subfields.length) {
    oldField.subfields.forEach((subfield, index) => {
      const newValue = newField.subfields[index].value;
      if (subfield.value !== newValue) { // eslint-disable-line functional/no-conditional-statement
        debug(`NORMALIZE: '${subfield.value}' => '${newValue}'`);
      }
    });
    return;
  }
  debug(`NORMALIZE: '${fieldToString(oldField)}' => '${fieldToString(newField)}'`);
}

export function cloneAndRemovePunctuation(field) {
  const clonedField = clone(field);
  fieldPreprocess(clonedField);
  fieldStripPunctuation(clonedField);
  debug('PUNC');
  fieldComparison(field, clonedField);

  return clonedField;
}

export function cloneAndNormalizeField(field) {
  const clonedField = normalizeField(clone(field));
  fieldRemoveDecomposedDiacritics(clonedField);
  fieldComparison(field, clonedField);

  return clonedField;
}


export function recordPreprocess(record) { // For both base and source record
  if (!record.fields) {
    return record;
  }
  // externalFixes(record); // Fixes from outside this module

  //record = result.record; // eslint-disable-line functional/immutable-data
  normalizeEncoding().fix(record);
  recordNormalizeSubfield9Linkage(record);
  record.fields.forEach(field => fieldPreprocess(field));
  return record;
}

function retagSource1XX(base, source) {
  // Even if base hasn't got a 1XX, source's 1XX go to 7XX...
  /*
  const base1XX = base.get(/^1..$/u);
  if (base1XX.length === 0) {
    return;
  }

  */
  // Base has 1XX fields. Retag source's 1XX fields
  const source1XX = source.get(/^1..$/u);
  source1XX.forEach(field => retagField(field));

  function retagField(field) {
    const newTag = `7${field.tag.substring(1)}`;
    nvdebug(`Retag ${field.tag} => ${newTag}`);
    field.tag = newTag; // eslint-disable-line functional/immutable-data
  }

}

export function sourceRecordPreprocess(baseRecord, sourceRecord) {
  const max6 = getMaxSubfield6(baseRecord);
  const max8 = getMaxSubfield8(baseRecord);
  //nvdebug(`MAX8 FROM BASE: ${max8}`);
  reindexSubfield6s(sourceRecord, max6);
  reindexSubfield8s(sourceRecord, max8);

  retagSource1XX(baseRecord, sourceRecord);
  return sourceRecord;
}


