//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {
  fieldHasSubfield,
  fieldIsRepeatable,
  fieldToString,
  normalizeStringValue,
  recordHasField
} from './utils.js';

import {
  cloneAndPreprocessField,
  postprocessField
} from './mergePreAndPostprocess.js';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...
//
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

// "key" is an unique key that must match (be absent or exist+be identical) in both.
// "paired" refers to a field that must either exist in both or be absent in both. Typically it's not defined.
// NB: key+paired with identical values is an attempt to prevent copy for (ET) fields, and to force separate fields on (T) fields.

// 'solitary':true : field is not copied, if tag is already present, even if specs say it's repeatable
// NB! If base has eg. no 264, two+ 264 fields can be copied from the source.
// TODO: "key2" (rename?) is an optional, but unique key. If present in both, the value must be identical.
// TODO: lifespan for X00$d-fields
const mergeConstraints = [
  {'tag': '010', 'required': 'a', 'key': 'a'},
  {'tag': '013', 'required': 'a', 'key': 'a'}, // We have 2 instances in Melinda...
  {'tag': '015', 'required': 'a', 'key': 'a'},
  {'tag': '016', 'required': 'a', 'key': 'a2'},
  {'tag': '017', 'required': 'a', 'key': 'a'},
  {'tag': '018', 'required': 'a', 'key': 'a'},
  {'tag': '020', 'required': '', 'pair': 'a', 'key': 'a'}, // NB! how to handle $z-only cases? 'required-fallback'='z'?
  {'tag': '022', 'required': '', 'pair': 'a', 'key': 'alz'},
  {'tag': '024', 'required': '', 'pair': 'a', 'key': 'ad'},
  {'tag': '025', 'required': 'a', 'key': 'a'},
  {'tag': '026', 'required': 'a', 'key': 'a'},
  {'tag': '027', 'required': 'a', 'key': 'a'}, // on tuolla pari $z:ää
  {'tag': '028', 'required': 'a', 'key': 'ab'},
  {'tag': '030', 'required': 'a', 'key': 'a'},
  {'tag': '031', 'required': '', 'key': 'abcegmnopr2'}, // mites tämmöisen käytännössä avaimettoman klaarais? TODO: tests
  {'tag': '032', 'required': 'a', 'key': 'ab'},
  {'tag': '033', 'required': 'a', 'key': 'abcp0123'}, // 0,1% are without $a. Ignore them for now.
  {'tag': '034', 'required': 'ab', 'key': 'abcdefghjkmnprstxyz0123'},
  {'tag': '035', 'required': '', 'key': 'az'},
  {'tag': '036', 'required': 'a', 'key': 'a'},
  {'tag': '037', 'required': 'b', 'key': 'ab'},
  {'tag': '039', 'required': 'a'},
  {'tag': '040', 'required': '', 'key': ''},
  {'tag': '041', 'required': '', 'key': '', 'solitary': true},
  {'tag': '042', 'required': 'a', 'key': ''}, // NB: preprocessor hacks applied
  {'tag': '043', 'required': 'a', 'key': 'abc'},
  {'tag': '044', 'required': '', 'key': 'abc', 'paired': 'abc'},
  {'tag': '045', 'required': '', 'key': 'abc', 'paired': 'abc'}, // (ET) // 045 is problematic either-$a or $b or $c...
  {'tag': '046', 'required': 'a', 'key': 'abcdejklmnop', 'paired': 'abcdejklmnop'},
  {'tag': '047', 'required': 'a', 'key': 'a2'},
  {'tag': '048', 'required': 'a', 'key': 'ba'}, // TODO: check multiple instances of $a vs key
  {'tag': '049', 'required': '', 'key': 'abcd'},
  {'tag': '050', 'required': 'a', 'key': 'ab13'},
  {'tag': '051', 'required': 'a', 'key': 'abc'}, // 2021-08-27: only one field in the whole Melinda
  {'tag': '052', 'required': 'a', 'key': 'abd'},
  {'tag': '055', 'required': 'a', 'key': 'ab'},
  {'tag': '060', 'required': 'a', 'key': 'ab'},
  {'tag': '061', 'required': 'a', 'paired': 'b', 'key': 'abc'},
  {'tag': '066', 'skip': true, 'required': 'c'},
  {'tag': '070', 'required': 'a', 'key': 'ab'},
  {'tag': '071', 'required': 'a', 'paired': 'abc', 'key': 'abc'}, // N=3
  {'tag': '072', 'required': 'a', 'key': 'ax'},
  {'tag': '074', 'required': '', 'paired': 'a', 'key': 'az'},
  {'tag': '080', 'required': 'a', 'paired': 'bx', 'key': 'abx'},
  {'tag': '082', 'required': 'a', 'paired': 'b', 'key': 'abmq2'},
  {'tag': '083', 'required': 'a', 'paired': 'b', 'key': 'abmqy'},
  {'tag': '084', 'required': 'a', 'paired': 'b', 'key': 'abq'},
  {'tag': '085', 'required': '', 'paired': 'abcfrstuvwyz', 'key': 'abcfrstuvwxyz'},
  {'tag': '086', 'required': '', 'paired': 'a', 'key': 'a'},
  {'tag': '088', 'required': '', 'paired': 'a', 'key': 'a'},
  // NB! 100, 110 and 111 may have title parts that are handled elsewhere
  {'tag': '100', 'required': 'a', 'paired': 't', 'key': 'abcj'},
  {'tag': '110', 'required': 'a', 'paired': 't', 'key': 'abcdgn'},
  {'tag': '111', 'required': 'a', 'paired': 't', 'key': 'acdgn'},
  // NB! 130 has no name part, key is used for title part
  {'tag': '130', 'required': 'a', 'key': 'adfhklmnoprsxvg'},
  {'tag': '210', 'required': 'a', 'key': 'ab'},
  {'tag': '222', 'required': 'a', 'key': 'ab'},
  {'tag': '240', 'required': 'a', 'key': 'adfghklmnoprs'},
  {'tag': '242', 'required': 'a', 'key': 'abchnpy'},
  {'tag': '243', 'required': 'a', 'key': 'adfghklmnoprs'},
  {'tag': '245', 'required': 'a', 'key': 'abcghnps'}, // 'paired': 'abnp', 'key': 'abnp'},
  {'tag': '246', 'required': 'a', 'key': 'abfnp'},
  {'tag': '247', 'required': 'a', 'key': 'abfnpx'},
  {'tag': '250', 'required': 'a', 'key': 'ab'},
  {'tag': '251', 'required': 'a', 'key': 'a'},
  {'tag': '254', 'required': 'a', 'key': 'a'},
  {'tag': '255', 'required': 'a', 'key': 'abcdefg', 'paired': 'abcdefg'},
  {'tag': '256', 'required': 'a', 'key': 'a'},
  {'tag': '257', 'required': 'a', 'key': 'a'},
  {'tag': '258', 'required': 'a', 'key': 'a'}, // Melinda: N=1
  {'tag': '260', 'required': '', 'paired': 'abc', 'key': 'abcdefg', 'solitary': true},
  {'tag': '263', 'required': 'a', 'key': 'a'},
  {'tag': '264', 'required': '', 'paired': 'abc', 'key': 'abc', 'solitary': true}, // TODO: more tests. "S.l." normalizations?"
  // SKIP TAG 270 ON PURPOSE! Melinda's N=43.
  {'tag': '300', 'required': 'a', 'key': 'abcefg', 'solitary': true}, // TODO: tests
  {'tag': '306', 'required': 'a', 'key': 'a'},
  // SKIP TAG 307 ON PURPOSE! N=0
  {'tag': '310', 'required': 'a', 'key': 'ab', 'solitary': true},
  {'tag': '321', 'required': 'a', 'key': 'ab', 'solitary': true},
  {'tag': '335', 'required': 'a', 'key': 'ab', 'solitary': true}, // Melinda N=1 (a test field). M might increase?
  {'tag': '336', 'required': 'b2', 'key': 'b', 'solitary': true},
  {'tag': '337', 'required': 'b2', 'key': 'b', 'solitary': true},
  {'tag': '338', 'required': 'b2', 'key': 'b', 'solitary': true},
  {'tag': '340', 'required': '', 'paired': 'abcdefghijkmnop', 'key': 'abcdefghijkmnop'},
  {'tag': '341', 'required': '', 'paired': 'abcde', 'key': 'abcde'},// SKIP 341. NOT SEEN!
  {'tag': '342', 'required': '', 'paired': 'abcdefghijklmnopqrstuvw', 'key': 'abcdefghijklmnopqrstuvw'},// SKIP 342. NOT SEEN!
  {'tag': '343', 'required': '', 'paired': 'abcdefghi', 'key': 'abcdefghi'},// SKIP 343.
  {'tag': '344', 'required': '', 'paired': 'abcdefgh', 'key': 'abcdefgh'},
  {'tag': '345', 'required': '', 'paired': 'abcd', 'key': 'abcd'},
  {'tag': '346', 'required': '', 'paired': 'ab', 'key': 'ab'},
  {'tag': '347', 'required': '', 'paired': 'abcdef', 'key': 'abcdef'},
  {'tag': '348', 'required': '', 'paired': 'ab', 'key': 'ab'},
  {'tag': '348', 'required': '', 'paired': 'abc', 'key': 'abc'},
  {'tag': '351', 'required': '', 'paired': 'abc', 'key': 'abc'},
  {'tag': '352', 'required': '', 'paired': 'abcdefgiq', 'key': 'abcdefgiq'},
  {'tag': '355', 'required': '', 'paired': 'abcdefghj', 'key': 'abcdefghj'},
  {'tag': '357', 'required': 'a', 'key': 'abcg'},
  // NB! 700, 710 and 711 may have title parts that are handled elsewhere
  {'tag': '650', 'required': 'a', 'key': 'axyz20'}, // TODO: $g
  {'tag': '653', 'required': 'a', 'key': 'a'}, // this is interesting as a can be repeated
  {'tag': '655', 'required': 'a', 'key': 'axyz20'},
  {'tag': '700', 'required': 'a', 'paired': 't', 'key': 'abcj'}, // h/i/m/o/r/s/x are missing from 100
  {'tag': '710', 'required': 'a', 'paired': 't', 'key': 'abcdgn'}, // h/j/m/o/r/s/x are missing from 110
  {'tag': '711', 'required': 'a', 'paired': 't', 'key': 'acdgn'}, // h/i/s/x are missing from 711
  // NB! 730 has no name part, key is used for title part
  {'tag': '730', 'required': 'a', 'key': 'adfhklmnoprsxvg'}, // i/x are missing from 130
  {'tag': '830', 'required': 'ax', 'key': 'apx'},
  {'tag': '880', 'required': '', 'paired': 'a', 'key': 'abcdefghijklmnopqrstuvwxyz'},
  // 995: paired-ac is there to prevent koha and arto stuff from merging
  {'tag': '995', 'required': '', 'paired': 'ac', 'key': 'abcdefghijklmnopqrstuvwxyz'} // key: a-z practically means we know nothing of the field
];

function getMergeConstraintsForTag(tag, constraint) {
  const activeTags = mergeConstraints.filter(entry => tag === entry.tag);
  if (activeTags.length === 0) {
    debug(`WARNING\tNo key found for ${tag}. Returning NULL!`);
    return null;
  }
  if (!(constraint in activeTags[0])) {
    debug(`WARNING\tField ${tag} is missing '${constraint}'. Return NULL instead of a set of constraints.`);
    return null;
  }
  if (activeTags.length > 1) {
    debug(`WARNING\tMultiple values for '${constraint}' (N=${activeTags.length}) found in ${tag}`);
    return activeTags[0][constraint];
  }
  // NB! "" might mean "apply to everything" (eg. 040.key) while null means that it is not applied.
  // Thus we return string and not array. We might have think this further later on...

  return activeTags[0][constraint];
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

function uniqueKeyMatches(baseField, sourceField, forcedKeyString = null) {
  // NB! Assume that field1 and field2 have same relevant subfields.
  // What to do if if base
  // const keySubfieldsAsString = forcedKeyString || getUniqueKeyFields(field1);
  const keySubfieldsAsString = forcedKeyString || getMergeConstraintsForTag(baseField.tag, 'key');
  //return mandatorySubfieldComparison(baseField, sourceField, keySubfieldsAsString);
  return optionalSubfieldComparison(baseField, sourceField, keySubfieldsAsString);
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
          debug(` mandatory pairing succeeded for normalized subfield ‡${sf.code} '${normSubfieldValue}'`);
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
    if (subfields1.length == 0 || subfields2.lenght == 0) {
      return true;
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
  const subfieldString = getMergeConstraintsForTag(field.tag, 'required');
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
  const subfieldString = getMergeConstraintsForTag(field1.tag, 'paired');
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


function mergablePair(baseField, sourceField, fieldSpecificCallback = null) {
  // Indicators *must* be equal:
  if (!indicatorsMatch(baseField, sourceField) ||
    !controlSubfieldsPermitMerge(baseField, sourceField)) {
    return false;
  }
  //debug('mergablePair()... wp2');
  // NB! field1.tag and field2.tag might differ (1XX vs 7XX). Therefore required subfields might theoretically differ as well. Thus check both:
  if (!areRequiredSubfieldsPresent(baseField) || !areRequiredSubfieldsPresent(sourceField)) {
    return false;
  }
  //debug('mergablePair()... wp3');
  // Stuff of Hacks! Eg. require that both fields either have or have not X00$t:
  if (!arePairedSubfieldsInBalance(baseField, sourceField)) {
    debug('required subfield pair check failed.');
    return false;
  }
  debug('Test semantics...');
  if (!semanticallyMergablePair(baseField, sourceField)) {
    return false;
  }
  return fieldSpecificCallback === null || fieldSpecificCallback(baseField, sourceField);
}

function compareName(baseField, sourceField) {
  // 100$a$t: remove $t and everything after that
  const reducedField1 = fieldToNamePart(baseField);
  const reducedField2 = fieldToNamePart(sourceField);

  // compare the remaining subsets:
  return uniqueKeyMatches(reducedField1, reducedField2);
}


function semanticallyMergablePair(baseField, sourceField) {
  // On rare occasions a field contains a title part and partial checks are required:
  if (!compareTitlePart(baseField, sourceField)) {
    debug(' ${field1.tag} is unmergable: Title part mismatch.');
    return false;
  }


  // TODO: we should check lifespan here
  // TODO: we should check "optional" fields (such as possibly 245$b) here

  // Handle the field specific "unique key" (=set of fields that make the field unique
  if (!compareName(baseField, sourceField)) {
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


function compareTitlePart(field1, field2) {
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
    const originalValue = fieldToString(targetField)
    mergeSubfield(record, targetField, candSubfield);
    const newValue = fieldToString(targetField);
    if ( originalValue !== newValue ) {
      debug(`  MERGING SUBFIELD '‡${candSubfield.code} ${candSubfield.value}' TO '${originalValue}'`);
      debug(`   RESULT: '${newValue}'`);
      debug(`   TODO: sort subfields, handle punctuation...`);
      // { code: x, value: foo }
    }
    else {
      debug(`  mergeSubfield() did not add '‡${candSubfield.code} ${candSubfield.value}' to '${originalValue}'`);
    }

  });
  postprocessField(targetField);
  return record;
}

function checkSolitariness(record, tag){
  // Some of the fields are repeatable as per Marc21 specs, but we still don't want to multiple instances of tag.
  // These are listed in https://workgroups.helsinki.fi/x/K1ohCw . (However, we do not always agree with specs.)
  const solitary = getMergeConstraintsForTag(tag, 'solitary');
  if (solitary) {
    // Blocking is requested by specs for a field with 'solitary':true.
    // However, we won't block if all existing relevant fields come from source record. 
    const candidateFields = record.get(tagToRegexp(tag));
    //return true;
    return candidateFields.some(field => !field.sourced); 

  }
  // No reason to block:
  return false;
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
  // Solitariness is a hack, see checkSolitariness() for details.
  return checkSolitariness(record, tag);
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

  field.subfields = field.subfields.filter(sf => isSubfieldGoodForMerge(field.tag, sf.code));

  debug(`Add as ${fieldToString(field)}`);
  // Do we need to sort unmerged subfields?
  return record.insertField(bottomUpSortSubfields(field));
}

export function mergeOrAddField(record, field) {
  // We are not interested in this field, whatever the case:
  // (Currently fields: 066)
  if (getMergeConstraintsForTag(field.tag, 'skip')) {
    return record;
  }
  const newField = cloneAndPreprocessField(field, record);
  const counterpartField = getCounterpart(record, newField);
  debug(`INCOMING FIELD: ${fieldToString(field)}`);
  if (counterpartField) {
    debug(`mergeOrAddField: Got counterpart: '${fieldToString(counterpartField)}'. Thus try merge...`);
    mergeField(record, counterpartField, newField);
    return record;
  }
  // NB! Counterpartless field is inserted to 7XX even if field.tag says 1XX:
  debug(`No mergable counterpart found for '${fieldToString(field)}'. Try to add it instead.`);
  return addField(record, newField);
}
