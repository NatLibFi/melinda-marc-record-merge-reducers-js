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

// Possible modifications:
// Move 040 back to a separate file, as it differs from everything else.
// We might be able to simplify things after that.
// Special treatments needed for:
// - punctuation between fields..
// - X00$d
// - indicator for article length (eg. 245)
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

// "paired" refers to a field that must either exist in both or be absent in both. Typically it's not defined.
// "key" is an unique key that must match (be absent or exist+be identical) in both.
// 'solitary':'y' is used when field is not copied, if tag is already present, even if specs say it's repeatable
// TODO: "key2" (rename?) is an optional, but unique key. If present in both, the value must be identical.
// TODO: lifespan for X00$d-fields
const mergeRestrictions = [
  {'tag': '020', 'required': 'a', 'key': 'a'}, // how to handle $z?
  {'tag': '022', 'required': 'a', 'key': 'a'},
  {'tag': '024', 'required': 'a', 'key': 'a'},
  {'tag': '028', 'required': 'a', 'key': 'ab'},
  {'tag': '039', 'required': 'a'},
  {'tag': '040', 'required': '', 'key': ''},
  {'tag': '042', 'required': 'a', 'key': ''},
  // NB! 100, 110 and 111 may have title parts that are handled elsewhere
  {'tag': '100', 'required': 'a', 'paired': 't', 'key': 'abcj'},
  {'tag': '110', 'required': 'a', 'paired': 't', 'key': 'abcdgn'},
  {'tag': '111', 'required': 'a', 'paired': 't', 'key': 'acdgn'},
  // NB! 130 has no name part, key is used for title part
  {'tag': '130', 'required': 'a', 'key': 'adfhklmnoprsxvg'},
  {'tag': '240', 'required': 'a', 'key': 'anp'}, // Is 'key' complete? Probably not...
  {'tag': '245', 'required': 'a', 'key': 'a', 'key2': 'bcnp'}, // 'paired': 'abnp', 'key': 'abnp'},
  {'tag': '260', 'required': '', 'key': '', 'key2': 'abcdefg'},
  // NB! 700, 710 and 711 may have title parts that are handled elsewhere
  {'tag': '700', 'required': 'a', 'paired': 't', 'key': 'abcj'},
  {'tag': '710', 'required': 'a', 'paired': 't', 'key': 'abcdgn'},
  {'tag': '711', 'required': 'a', 'paired': 't', 'key': 'acdgn'},
  // NB! 730 has no name part, key is used for title part
  {'tag': '730', 'required': 'a', 'key': 'adfhklmnoprsxvg'},
  {'tag': '830', 'required': 'ax', 'key': 'apx'}
];

function getMergeRestrictionsForTag(tag, restriction) {
  const activeTags = mergeRestrictions.filter(entry => tag === entry.tag);
  if (activeTags.length === 0) {
    debug(`WARNING\tNo key found for ${tag}. Returning NULL!`);
    return null;
  }
  if (!(restriction in activeTags[0])) {
    debug(`WARNING\tField ${tag} is missing '${restriction}'. Return NULL.`);
    return null;
  }
  if (activeTags.length > 1) {
    debug(`WARNING\tMultiple values for '${restriction}' (N=${activeTags.length}) found in ${tag}`);
    return activeTags[0][restriction];
  }
  // NB! "" might mean "apply to everything" (eg. 040.key) while null means that it is not applied.
  // Thus we return string and not array. We might have think this further later on...

  return activeTags[0][restriction];
}

function equalishFields(field1, field2) {
  const s1 = fieldToString(field1);
  const s2 = fieldToString(field2);
  if (s1 === s2) {
    return true;
  }
  // TODO; strip at least $9's keeps (and drops)
  return false;
}

function uniqueKeyMatches(field1, field2, forcedKeyString = null) {
  // NB! Assume that field1 and field2 have same relevant subfields.
  // We might have 100 vs 700 fields. I haven't check whether their specs are identical.
  // const keySubfieldsAsString = forcedKeyString || getUniqueKeyFields(field1);
  const keySubfieldsAsString = forcedKeyString || getMergeRestrictionsForTag(field1.tag, 'key');
  return mandatorySubfieldComparison(field1, field2, keySubfieldsAsString);
}

function mandatorySubfieldComparison(field1, field2, keySubfieldsAsString) {
  if (keySubfieldsAsString === null) {
    // If keySubfieldsAsString is undefined, (practically) everything is the string.
    // When everything is the string, the strings need to be (practically) identical.
    // (NB! Here order matters. We should probably make it matter everywhere.)
    // (However, keySubfieldsAsString === '' will always succeed. Used by 040 at least.)
    return equalishFields(field1, field2);
  }

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

function optionalSubfieldComparison(field1, field2, keySubfieldsAsString) {
  if (keySubfieldsAsString === null) {
    return true;
  }
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
    // Are the hard-coded hacks actually used? Check...
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
  const subfieldString = getMergeRestrictionsForTag(field.tag, 'required');
  if (subfieldString === null) {
    return true;
  } // nothing is required
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

function arePairedSubfieldsInBalance(field1, field2) {
  const subfieldString = getMergeRestrictionsForTag(field1.tag, 'paired');
  if (subfieldString === null) {
    return true;
  }
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
  debug('mergablePair()... wp2');
  // NB! field1.tag and field2.tag might differ (1XX vs 7XX). Therefore required subfields might theoretically differ as well. Thus check both:
  if (!areRequiredSubfieldsPresent(field1) || !areRequiredSubfieldsPresent(field2)) {
    return false;
  }
  debug('mergablePair()... wp3');
  // Stuff of Hacks! Eg. require that both fields either have or have not X00$t:
  if (!arePairedSubfieldsInBalance(field1, field2)) {
    debug('required subfield pair check failed.');
    return false;
  }
  debug('Test semanrics...');
  if (!semanticallyMergablePair(field1, field2)) {
    return false;
  }
  return fieldSpecificCallback === null || fieldSpecificCallback(field1, field2);
}

function compareName(field1, field2) {
  // 100$a$t: remove $t and everything after that
  const reducedField1 = fieldToNamePart(field1);
  const reducedField2 = fieldToNamePart(field2);

  // compare the remaining subsets:
  return uniqueKeyMatches(reducedField1, reducedField2);
}


function semanticallyMergablePair(field1, field2) {
  // On rare occasions a field contains a title part and partial checks are required:
  if (!compareTitle(field1, field2)) {
    debug(' ${field1.tag} is unmergable: Title part mismatch.');
    return false;
  }


  // TODO: we should check lifespan here
  // TODO: we should check "optional" fields (such as possibly 245$b) here

  // Handle the field specific "unique key" (=set of fields that make the field unique
  if (!compareName(field1, field2)) {
    debug('Unmergable: Name part mismatch');
    return false;
  }
  debug(' Semantic checks passed! We are MERGABLE!');

  return true;
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
  // Take everything after 1st subfield $t...
  const index = field.subfields.findIndex(currSubfield => currSubfield.code === 't');
  const subsetField = {'tag': field.tag, 'ind1': field.ind1, 'ind2': field.ind2, subfields: field.subfields.filter((sf, i) => i >= index)};
  debug(`Title subset: ${fieldToString(subsetField)}`);
  return subsetField;
}


function compareTitle(field1, field2) {
  // HACK ALERT! Tags, ‡t and ‡dfhklmnoprstxvg should typically be parametrized.
  // If it is just this one case, I'll leave this as it is.
  if (fieldHasSubfield(field1, 't') && field1.tag in ['100', '110', '111', '700', '710', '711']) {
    // 100$a$t: remove $t and everything after that
    const subset1 = fieldToTitlePart(field1);
    const subset2 = fieldToTitlePart(field2);
    return mandatorySubfieldComparison(subset1, subset2, 'dfhklmnoprstxvg');
  }
  return true;
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

function repetitionBlocksAdding(record, tag) {
  // It's not a repetition:
  if (!recordHasField(record, tag)) {
    return false;
  }
  // It's a repetition:
  if (!fieldIsRepeatable(tag)) {
    return true; // blocked
  }
  // Some of the fields are repeatable as per Marc21 specs, but we still don't want to multiple instances of tag.
  // These are listed in https://workgroups.helsinki.fi/x/K1ohCw . (However, we do not always agree with specs.)
  const solitary = getMergeRestrictionsForTag(tag, 'solitary');
  if (solitary) {
    return true; // Blocked by our cataloguers.
  }
  // No reason to block:
  return false;
}

function fieldCanBeAdded(record, field) {
  if (repetitionBlocksAdding(record, field.tag)) {
    debug(`Unrepeatable field already exists. Failed to add '${fieldToString(field)}'.`);
    return false;
  }

  if (field.tag === '240' && recordHasField(record, '130')) {
    return false;
  }
  if (field.tag === '830' && !fieldHasSubfield(field, 'x')) {
    return false;
  }
  // We could block 260/264 pairs here.

  return true;
}

function addField(record, field) {
  if (!fieldCanBeAdded(record, field)) {
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

  // Hacky hacks.
  if (newField.tag === '040') {
    // This is ugly, and it probably should not be done here...
    fieldRenameSubfieldCodes(newField, 'a', 'd');
    return true;
  }

  // Do we need to sort unmerged subfields?
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
