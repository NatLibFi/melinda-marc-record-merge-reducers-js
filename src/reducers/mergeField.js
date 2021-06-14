import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {
  fieldHasSubfield,
  fieldIsRepeatable, // SHOULD WE USE THIS FOR SOMETHING?
  fieldToString,
  normalizeStringValue
  //normalizeStringValue
} from './utils.js';

import {
  controlSubfieldsPermitMerge
} from './controlSubfields.js';

import {
  isDroppableSubfield,
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
  {'tag': '042', 'required': 'a'},

  // NB! 100, 110 and 111 may have title parts that are handled elsewhere
  {'tag': '100', 'required': 'a', 'paired': 't', 'key': 'abcj'},
  {'tag': '110', 'required': 'a', 'paired': 't', 'key': 'abcdgn'},
  {'tag': '111', 'required': 'a', 'paired': 't', 'key': 'acdgn'},
  // NB! 130 has no name part, key is used for title part
  {'tag': '130', 'required': 'a', 'paired': '', 'key': 'adfhklmnoprsxvg'},
  // NB! 700, 710 and 711 may have title parts that are handled elsewhere
  {'tag': '700', 'required': 'a', 'paired': 't', 'key': 'abcj'},
  {'tag': '710', 'required': 'a', 'paired': 't', 'key': 'abcdgn'},
  {'tag': '711', 'required': 'a', 'paired': 't', 'key': 'acdgn'},
  // NB! 730 has no name part, key is used for title part
  {'tag': '730', 'required': 'a', 'paired': '', 'key': 'adfhklmnoprsxvg'}
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
  // NB! We should add exceptions here, eg 710$a$t tekijänimekkeet...
  /*
      if ( field.tag === '100' && fieldHasSubfield(field, 't') ) {

      }*/

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
          debug(`paired ${normSubfieldValue}`);
          return true;
        }
        debug(`failed to pair ${normSubfieldValue} and ${normSubfieldValue2}`);
        return false;
      });
    });

  });
}

function tagToRegexp(tag) {
  if (tag in counterpartRegexps) {
    const regexp = counterpartRegexps[tag];
    //debug(`regexp for ${tag} found: ${regexp}`);
    return regexp;
  }
  debug(`WARNING: TagToRegexp(${tag}): no precompiled regexp found.`);
  return new RegExp(`^${tag}$`, 'u');
}

function areRequiredSubfieldsPresent(field) {
  const subfieldString = mergeGetRequiredSubfieldCodes(field.tag);
  const subfieldArray = subfieldString.split('');
  return subfieldArray.every(sfcode => fieldHasSubfield(field, sfcode));
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
  if (field1.ind1 !== field2.ind1 || field1.ind2 !== field2.ind2) {
    debug('indicator check failed');
    return false;
  }
  // NB! There are cases where indicator values are, says # and 1, and the define value (here 1) should be used.
  // However, we do not let them pass yet.
  return true;
}


function mergablePair(field1, field2, fieldSpecificCallback = null) {
  // Indicators *must* be equal:
  if (!indicatorsMatch(field1, field2) ||
        !controlSubfieldsPermitMerge(field1, field2)) {
    return false;
  }

  // NB! field1.tag and field2.tag might differ. Therefore required subfields might theoretically differ as well. (1XX vs 7XX)
  if (!areRequiredSubfieldsPresent(field1) || !areRequiredSubfieldsPresent(field2)) {
    debug('required subfield presence check failed.');
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
  const counterpartCands = record.get(tagToRegexp(field.tag));
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
  debug(' No counterpart found!');
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

  return record;
}

function fieldCanBeAdded(record, newField) {
    // Repeatable fields cause no problems:
    if ( fieldIsRepeatable(newField.tag) ) {
        return true;
    }
    // If 1st field in record return true (so that it can be added),
    // otherwise false;
    const re = new RegExp(`^${newField.tag}$`, 'u');
    const yeOldeFields = record.get(re);
    return yeOldeFields.length === 0;
}

function addField(record, field) {
    if ( !fieldCanBeAdded(record, field) ) {
        debug(`Unrepeatable field already exists. Failed to add '${fieldToString(field)}'.`);
        return record;
    }

    const newSubfields = field.subfields.filter(sf => { return !isDroppableSubfield(field, sf.code); });
    if ( newSubfields.length === 0 ) {
        return record;
    }
    const newField = { 'tag': field.tag,
        'ind1': field.ind1,
        'ind2': field.ind2,
        'subfields': newSubfields };
    return record.insertField(newField);

}

export function mergeOrAddField(record, field) {
    const counterpartField = getCounterpart(record, field);
    if (counterpartField) {
      debug(`Got counterpart: '${fieldToString(counterpartField)}'`);
      mergeField(record, counterpartField, field);
      return record;
    }
    // NB! Counterpartless field is inserted to 7XX even if field.tag says 1XX:
    debug(`No counterpart found for '${fieldToString(field)}'.`);
    return addField(record, field);
}
