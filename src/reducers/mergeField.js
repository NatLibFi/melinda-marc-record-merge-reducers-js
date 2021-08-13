//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {
  fieldHasSubfield,
  fieldIsRepeatable,
  fieldRenameSubfieldCodes,
  fieldToString,
  normalizeStringValue,
  recordHasField
} from './utils.js';

import {controlSubfieldsPermitMerge} from './controlSubfields.js';

import {
  bottomUpSortSubfields,
  isSubfieldGoodForMerge,
  mergeSubfield
} from './mergeSubfield.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

const counterpartRegexps = {
  '100': /^[17]00$/u, '110': /^[17]10$/u, '111': /^[17]11$/u, '130': /^[17]30$/u,
  '700': /^[17]00$/u, '710': /^[17]10$/u, '711': /^[17]11$/u, '730': /^[17]30$/u
};

// "paired" refers to a field that must either exist in both or be absent in both. Typically it's an empty string.
const mergeRestrictions = [
  {'tag': '020', 'required': 'a', 'key': 'a'},
  {'tag': '022', 'required': 'a', 'key': 'a'},
  {'tag': '024', 'required': 'a', 'key': 'a'},
  {'tag': '039', 'required': 'a'},
  {'tag': '040', 'required': '', 'key': ''},
  {'tag': '042', 'required': 'a'},
  // NB! 100, 110 and 111 may have title parts that are handled elsewhere
  {'tag': '100', 'required': 'a', 'paired': 't', 'key': 'abcj'},
  {'tag': '110', 'required': 'a', 'paired': 't', 'key': 'abcdgn'},
  {'tag': '111', 'required': 'a', 'paired': 't', 'key': 'acdgn'},
  // NB! 130 has no name part, key is used for title part
  {'tag': '130', 'required': 'a', 'key': 'adfhklmnoprsxvg'},
  {'tag': '240', 'required': 'a', 'key': 'anp'}, // Is 'key' complete? Probably not...
  {'tag': '245', 'required': 'a'}, // 'paired': 'abnp', 'key': 'abnp'},
  // NB! 700, 710 and 711 may have title parts that are handled elsewhere
  {'tag': '700', 'required': 'a', 'paired': 't', 'key': 'abcj'},
  {'tag': '710', 'required': 'a', 'paired': 't', 'key': 'abcdgn'},
  {'tag': '711', 'required': 'a', 'paired': 't', 'key': 'acdgn'},
  // NB! 730 has no name part, key is used for title part
  {'tag': '730', 'required': 'a', 'key': 'adfhklmnoprsxvg'},
  {'tag': '830', 'required': 'ax', 'key': 'apx'}
];

function getUniqueKeyFields2(tag) {
  const activeTags = mergeRestrictions.filter(entry => tag === entry.tag);
  if (activeTags.length === 0) {
    debug(`Warning\tNo key found for ${tag}`);
    return '';
  }
  if (!('key' in activeTags[0])) {
    debug(`Field ${tag} is missing unique key. Return ''.`);
    return '';
  }
  if (activeTags.length > 1) {
    debug(`Warning\tMultiple keys (N=${activeTags.length}) found for ${tag}`);
    return activeTags[0].key;
  }

  return activeTags[0].key;
}

function getUniqueKeyFields(field) {
  const keys = getUniqueKeyFields2(field.tag);
  debug(`Unique key for ${field.tag}: '${keys}'`);
  // Um... 700$t stuff (sort of 2nd unique key)
  return keys;
}

function uniqueKeyMatches(field1, field2, forcedKeyString = null) {
  // NB! Assume that field1 and field2 have same relevant subfields.
  // We might have 100 vs 700 fields. I haven't check whether their specs are identical.
  const keySubfieldsAsString = forcedKeyString || getUniqueKeyFields(field1);
  const subfieldArray = keySubfieldsAsString.split('');
  return subfieldArray.every(subfieldCode => {
    const subfields1 = field1.subfields.filter(subfield => subfield.code === subfieldCode);
    const subfields2 = field2.subfields.filter(subfield => subfield.code === subfieldCode);
    // Assume that at least 1 instance must exist and that all instances must match
    if (subfields1.length !== subfields2.length) {
      debug(`Unique key: subfield ${subfieldCode} issues...`);
      return false;
    }

    return subfields1.every(sf => {
      const normSubfieldValue = normalizeStringValue(sf.value);
      return subfields2.some(sf2 => {
        const normSubfieldValue2 = normalizeStringValue(sf2.value);
        if (normSubfieldValue === normSubfieldValue2) {
          debug(`pairing succeed for normalized '${normSubfieldValue}'`);
          return true;
        }
        debug(`failed to pair ${normSubfieldValue} and ${normSubfieldValue2}`);
        return false;
      });
    });

  });
}


function localTagToRegexp(tag) {
  if (tag in counterpartRegexps) {
    const regexp = counterpartRegexps[tag];
    //debug(`regexp for ${tag} found: ${regexp}`);
    return regexp;
  }
  // debug(`WARNING: locallocalTagToRegexp(${tag}): no precompiled regexp found.`);
  return new RegExp(`^${tag}$`, 'u');
}

export function tagToRegexp(tag) {
  return localTagToRegexp(tag);
}

function areRequiredSubfieldsPresent(field) {
  const subfieldString = mergeGetRequiredSubfieldCodes(field.tag);
  const subfieldArray = subfieldString.split('');
  return subfieldArray.every(sfcode => {
    const result = fieldHasSubfield(field, sfcode);
    if (!result) {
      debug(`Required subfield ‡${sfcode} not found in '${fieldToString(field)}'!`);
      return false;
    }
    return true;
  });
}

function mergeGetRequiredSubfieldCodes(tag) {
  const activeTags = mergeRestrictions.filter(entry => tag === entry.tag);
  if (activeTags.length === 0) {
    debug(`Warning\tNo merge subfield rules found for ${tag}`);
    return '';
  }
  if (!('required' in activeTags[0])) {
    return '';
  }
  if (activeTags.length > 1) {
    debug(`Warning\tMultiple merge subfield rules found for ${tag}`);
    return activeTags[0].required;
  }

  return activeTags[0].required;
}

function mergeGetPairedSubfieldCodes(tag) {
  const activeTags = mergeRestrictions.filter(entry => tag === entry.tag);
  if (activeTags.length === 0) {
    debug(`Warning\tNo merge subfield rules found for ${tag}`);
    return '';
  }
  if (!('paired' in activeTags[0])) {
    return '';
  }
  if (activeTags.length > 1) {
    debug(`Warning\tMultiple merge subfield rules (N=${activeTags.length}) found for ${tag}`);
    return activeTags[0].paired;
  }
  return activeTags[0].paired;
}

function arePairedSubfieldsInBalance(field1, field2) {
  const subfieldString = mergeGetPairedSubfieldCodes(field1.tag);
  const subfieldArray = subfieldString.split('');
  return subfieldArray.every(sfcode => {
    if (fieldHasSubfield(field1, sfcode)) {
      // Return true if present in f1 and f1. Return false if present in f1 but missing in f2:
      return fieldHasSubfield(field2, sfcode);
    }
    // subfield is missing in both
    return !fieldHasSubfield(field2, sfcode);
  });
}


function indicatorsMatch(field1, field2) {
  // The value of 245 IND1 depends on other fields, and those field might diffent from Melinda and incoming record:
  if (field1.ind1 !== field2.ind1 && !['245'].includes(field1.tag)) {
    debug('indicator 1 check failed');
    return false;
  }
  // "ohitusindikaattori" difference does not trigger failure:
  if (field1.ind2 !== field2.ind2 && !['240', '243', '245'].includes(field1.tag)) {
    debug('indicator 1 check failed');
    return false;
  }
  // NB! There are cases where indicator values are, says # and 1, and the define value (here 1) should be used. (Eg. field 100.)
  // However, we do not let them pass yet.
  return true;
}


function mergablePair(field1, field2, fieldSpecificCallback = null) {
  // Indicators *must* be equal:
  if (!indicatorsMatch(field1, field2) ||
    !controlSubfieldsPermitMerge(field1, field2)) {
    return false;
  }

  // NB! field1.tag and field2.tag might differ (1XX vs 7XX). Therefore required subfields might theoretically differ as well. Thus check both:
  if (!areRequiredSubfieldsPresent(field1) || !areRequiredSubfieldsPresent(field2)) {
    return false;
  }

  // NB! field1.tag and field2.tag might differ. Therefore required subfields may differ as well.
  if (!arePairedSubfieldsInBalance(field1, field2)) {
    // Eg. require that both fields either have or have not X00$t:
    debug('required subfield pair check failed.');
    return false;
  }

  if (!compareNameAndTitle(field1, field2)) {
    return false;
  }
  return fieldSpecificCallback === null || fieldSpecificCallback(field1, field2);
}

function compareName(field1, field2) {
  // 100$a$t: remove $t and everything after that
  const subset1 = fieldToNamePart(field1);
  const subset2 = fieldToNamePart(field2);
  // compare the remaining subsets:
  return uniqueKeyMatches(subset1, subset2);
}


function compareNameAndTitle(field1, field2) {
  // Both name and title parts exist:
  if (fieldHasSubfield(field1, 't') && field1.tag in ['100', '110', '111', '700', '710', '711'] && !compareTitle(field1, field2)) {
    debug(' Unmergable: Title part mismatch.');
    return false;
  }

  // Handle the field specific "unique key" (=set of fields that make the field unique
  if (compareName(field1, field2)) {
    debug('Unique key matches. We are MERGABLE :-)');
    return true;
  }
  debug('Unmergable: Name part mismatch');
  return false;
}


function namePartThreshold(field) {
  // Threshold is only applicaple to some tags..
  if (!(/[10]0$/u).test(field.tag)) {
    return -1;
  }
  const t = field.subfields.findIndex(currSubfield => currSubfield.code === 't');
  const u = field.subfields.findIndex(currSubfield => currSubfield.code === 'u');
  if (t === -1) {
    return u;
  }
  if (u === -1) {
    return t;
  }
  return t > u ? u : t;
}

function fieldToNamePart(field) {
  const index = namePartThreshold(field);
  const subsetField = {'tag': field.tag, 'ind1': field.ind1, 'ind2': field.ind2, subfields: field.subfields.filter((sf, i) => i < index || index === -1)};

  debug(`Name subset: ${fieldToString(subsetField)}`);
  return subsetField;
}

function fieldToTitlePart(field) {
  const index = field.subfields.findIndex(currSubfield => currSubfield.code === 't');
  const subsetField = {'tag': field.tag, 'ind1': field.ind1, 'ind2': field.ind2, subfields: field.subfields.filter((sf, i) => i >= index)};
  debug(`Title subset: ${fieldToString(subsetField)}`);
  return subsetField;
}


function compareTitle(field1, field2) {
  // 100$a$t: remove $t and everything after that
  const subset1 = fieldToTitlePart(field1);
  const subset2 = fieldToTitlePart(field2);
  // "dfhklmnoprstxvg" is ok for 100, 110, 111, 700, 710 and 711. 130/730 is not handled here!
  return uniqueKeyMatches(subset1, subset2, 'dfhklmnoprstxvg');
}


export function getCounterpart(record, field) {
  // Get tag-wise relevant 1XX and 7XX fields:
  const counterpartCands = record.get(localTagToRegexp(field.tag));
  // debug(counterpartCands);

  if (!counterpartCands || counterpartCands.length === 0) {
    return null;
  }
  const fieldStr = fieldToString(field);
  debug(`Compare incoming '${fieldStr}' with (up to) ${counterpartCands.length} existing field(s)`);
  const index = counterpartCands.findIndex((currCand) => {
    const currCandStr = fieldToString(currCand);
    debug(`  CAND: '${currCandStr}'`);
    if (mergablePair(currCand, field)) {
      debug(`  OK pair found: '${currCandStr}'. Returning it!`);
      return true;
    }
    debug(`  FAILED TO PAIR: '${currCandStr}'. Skipping it!`);
    return false;
  });
  if (index > -1) {
    return counterpartCands[index];
  }
  return null;
}

export function mergeField(record, targetField, sourceField) {
  sourceField.subfields.forEach(candSubfield => {
    debug(`  CAND4ADDING '‡${candSubfield.code} ${candSubfield.value}'`);
    mergeSubfield(record, targetField, candSubfield);
    debug(`  NOW '${fieldToString(targetField)}`);
    debug(`  TODO: sort subfields, handle punctuation...`);
    // { code: x, value: foo }

  });
  postprocessField(targetField);
  return record;
}


function fieldCanBeAdded(record, newField) {
  // Non-repeatable field cannot be added, if same tag already exists
  if (!fieldIsRepeatable(newField.tag) && recordHasField(record, newField.tag)) {
    return false;
  }
  // Hacky hacks:
  if (newField.tag === '040') {
    fieldRenameSubfieldCodes(newField, 'a', 'd');
    return true;
  }
  if (newField.tag === '240' && recordHasField(record, '130')) {
    return false;
  }
  if (newField.tag === '830' && !fieldHasSubfield(newField, 'x')) {
    return false;
  }

  return true;
}

function addField(record, field) {
  if (!fieldCanBeAdded(record, field)) {
    debug(`Unrepeatable field already exists. Failed to add '${fieldToString(field)}'.`);
    return record;
  }

  const newSubfields = field.subfields.filter(sf => isSubfieldGoodForMerge(field.tag, sf.code));
  if (newSubfields.length === 0) {
    return record;
  }
  const newField = {
    'tag': field.tag,
    'ind1': field.ind1,
    'ind2': field.ind2,
    'subfields': newSubfields
  };
  // Do we need to sort unmerged fields?
  return record.insertField(bottomUpSortSubfields(newField));
}


function postprocessX00a(field) {
  if (!field.tag.match(/^[1678]00$/u)) {
    return field;
  }
  debug(`postprocessX00a(${fieldToString(field)})`);
  field.subfields.forEach((sf, index) => {
    if (sf.code !== 'a' || index + 1 === field.subfields.length) {
      return;
    }
    if ('de'.indexOf(field.subfields[index + 1].code) > -1) {
      if (sf.value.match(/[aeiouyäö][a-zåäö]$/u)) {
        debug(`ADD ',' TO '${sf.value}'`);
        sf.value += ','; // eslint-disable-line functional/immutable-data
        return;
      }
      // Final '.' => ','
      if (sf.value.match(/[aeiouyäö][a-zåäö]\.$/u)) {
        sf.value = `${sf.value.slice(0, -1)},`; // eslint-disable-line functional/immutable-data
        return; // KESKEN
      }
    }
  });
}

function postprocessXX0eFunction(field) {
  if (!field.tag.match(/^[1678][01]0$/u)) {
    return field;
  }
  debug(`postprocessXX0e(${fieldToString(field)})`);
  field.subfields.forEach((sf, index) => {
    if (sf.code !== 'e' || index + 1 === field.subfields.length) {
      return;
    }
    if ('e'.indexOf(field.subfields[index + 1].code) > -1) {
      // Final '.' => ',' if followed by $e (and if '.' follows an MTS term)
      if (sf.value.match(/(?:esittäjä|kirjoittaja|sanoittaja|sovittaja|säveltäjä|toimittaja)\.$/u)) {
        sf.value = `${sf.value.slice(0, -1)},`; // eslint-disable-line functional/immutable-data
        return; // KESKEN
      }
    }
  });
}

function postprocessLifespan(field) {
  if (!field.tag.match(/^[1678]00$/u)) {
    return field;
  }
  debug(`postprocessLifespan(${fieldToString(field)})`);
  field.subfields.forEach((sf, index) => {
    if (sf.code !== 'd' || index + 1 === field.subfields.length) {
      return;
    }
    if (field.subfields[index + 1].code === 'e') {
      if (sf.value.match(/^[0-9]+-[0-9]+$/u)) {
        debug(`ADD ',' TO '${sf.value}'`);
        sf.value += ','; // eslint-disable-line functional/immutable-data
        return;
      }
      // Final '.' => ','
      if (sf.value.match(/^[0-9]+-(?:[0-9]+)?\.$/u)) {
        sf.value = `${sf.value.slice(0, -1)},`; // eslint-disable-line functional/immutable-data
        return; // KESKEN
      }
    }
  });
}

function postprocessField(field) {
  // Placeholder for proper
  postprocessX00a(field);
  postprocessXX0eFunction(field); // X00$e and X10$e
  postprocessLifespan(field); // X00$d
  return field;
}

export function mergeOrAddField(record, field) {
  // Should we clone record and field here?
  const newField = JSON.parse(JSON.stringify(field));
  const counterpartField = getCounterpart(record, newField);
  if (counterpartField) {
    debug(`mergeOrAddField: Got counterpart: '${fieldToString(counterpartField)}'. Thus try merge...`);
    mergeField(record, counterpartField, field);
    return record;
  }
  // NB! Counterpartless field is inserted to 7XX even if field.tag says 1XX:
  debug(`No counterpart found for '${fieldToString(field)}'.`);
  return addField(record, field);
}
