import createDebugLogger from 'debug';
import clone from 'clone';
import {fieldStripPunctuation} from './punctuation.js';
import {fieldToString, isControlSubfieldCode} from './utils.js';

import fieldExclusion from '@natlibfi/marc-record-validators-melinda/dist/field-exclusion';
import subfieldExclusion from '@natlibfi/marc-record-validators-melinda/dist/subfield-exclusion';
import isbnIssn from '@natlibfi/marc-record-validators-melinda/dist/isbn-issn';
import {default as normalizeEncoding, fieldFixComposition, fieldRemoveDecomposedDiacritics} from './normalizeEncoding';
import {fieldNormalizePrefixes} from './normalizeIdentifier';

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


function externalFixes(record) {
  //externalFieldsPresent(record, [/^336$/u, /^337$/u], true); // Comps don't always have 338
  //await FieldsPresent([/^336$/u, /^337$/u, /^338$/u]), // Comps don't always have 338


  const fieldExcluder = fieldExclusion([
    // /^(001|091|092|093|094|095|256|533|574|575|576|577|578|599)$/,
    //{tag: /^264$/, subfields: [{code: /^a$/, value: /^\[.*\]$/}]}, // Not sure about this either
    //{tag: /^650$/, subfields: [{code: /^a$/, value: /^overdrive$/i}]}, // Not sure what this is
    //{tag: /^041$/u, dependencies: [{leader: /^.{6}[g|i]/u}]},
    {tag: /^(?:648|650|651|655)$/u, subfields: [{code: /^2$/u, value: /^(?:ysa|musa|allars|cilla)$/u}]}
  ]);

  fieldExcluder.fix(record);

  const subfieldExcluder = subfieldExclusion([
    {tag: /^041$/u, subfields: [{code: /^[ad]$/u, value: /^zxx$/u}]},
    {tag: /^02[04]$/u, subfields: [{code: /^c$/u, value: /^.*(?:€|£|\$|FIM).*$/u}]} // price info
  ]);

  subfieldExcluder.fix(record);

  const addHyphensToISBN = isbnIssn({hyphenateISBN: true});

  addHyphensToISBN.fix(record);

  /*
  await EmptyFields(),
  await IsbnIssn({hyphenateISBN: true}),
  await SubfieldExclusion([
    {tag: /^041$/u, subfields: [{code: /^[ad]$/u, value: /^zxx$/u}]},
    {tag: /^02[04]$/u, subfields: [{code: /^c$/u, value: /^.*(?:€|£|\$|FIM).*$/u}]} // price info
  ]),
  //await FieldStructure([{tag: /^007$/u, dependencies: [{leader: /^.{6}[^at]/u}]}]),
  await Punctuation(),
  await EndingPunctuation()
  */
  return record;
}

export function recordPreprocess(record) {
  if (!record.fields) {
    return record;
  }
  externalFixes(record); // Fixes from outside this module

  //record = result.record; // eslint-disable-line functional/immutable-data
  normalizeEncoding().fix(record);
  record.fields.forEach(field => fieldPreprocess(field));
  return record;
}

