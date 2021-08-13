import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {
  fieldHasSubfield,
  // fieldIsRepeatable,
  fieldToString,
  normalizeStringValue
  //normalizeStringValue
} from './utils.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

const mergeRestrictions = [
  {'tag': '020', 'required': 'a', 'paired': '', 'key': ''},
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
        return normSubfieldValue === normSubfieldValue2;
      });
    });

  });
}

function mergeGetPairedSubfieldCodes(tag) {
  const activeTags = mergeRestrictions.filter(entry => tag === entry.tag);
  if (activeTags.length === 0) {
    debug(`Warning\tNo merge subfield rules found for ${tag}`);
    return '';
  }
  if (activeTags.length > 1) {
    debug(`Warning\tMultiple merge subfield rules (N=${activeTags.length}) found for ${tag}`);
    return activeTags[0].required;
  }

  return activeTags[0].required;
}

function mergeGetRequiredSubfieldCodes(tag) {
  const activeTags = mergeRestrictions.filter(entry => tag === entry.tag);
  if (activeTags.length === 0) {
    debug(`Warning\tNo merge subfield rules found for ${tag}`);
    return '';
  }
  if (activeTags.length > 1) {
    debug(`Warning\tMultiple merge subfield rules found for ${tag}`);
    return activeTags[0].required;
  }

  return activeTags[0].required;
}

function areRequiredSubfieldsPresent(field) {
  const subfieldString = mergeGetRequiredSubfieldCodes(field.tag);
  const subfieldArray = subfieldString.split('');
  return subfieldArray.every(sfcode => fieldHasSubfield(field, sfcode));
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

function namePartThreshold(field) {
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

function compareName(field1, field2) {
  // 100$a$t: remove $t and everything after that
  const subset1 = fieldToNamePart(field1);
  const subset2 = fieldToNamePart(field2);
  // compare the remaining subsets:
  return uniqueKeyMatches(subset1, subset2);
}

function compareTitle(field1, field2) {
  // 100$a$t: remove $t and everything after that
  const subset1 = fieldToTitlePart(field1);
  const subset2 = fieldToTitlePart(field2);
  // "dfhklmnoprstxvg" is ok for 100, 110, 111, 700, 710 and 711. 130/730 is not handled here!
  return uniqueKeyMatches(subset1, subset2, 'dfhklmnoprstxvg');
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

function indicatorsMatch(field1, field2) {
  if (field1.ind1 !== field2.ind1 || field1.ind2 !== field2.ind2) {
    debug('indicator check failed');
    return false;
  }
  // NB! There are cases where indicator values are, says # and 1, and the define value (here 1) should be used.
  // However, we do not let them pass yet.
  return true;
}

function subfieldsPermitMerge(field1, field2) {
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
  return true;
}

export function mergablePair(field1, field2, fieldSpecificCallback = null) {
  // Indicators *must* be equal:
  if (!indicatorsMatch(field1, field2) ||
      !subfieldsPermitMerge(field1, field2) ||
      !controlSubfieldsPermitMerge(field1, field2)) {
    return false;
  }

  if (!compareNameAndTitle(field1, field2)) {
    return false;
  }
  return fieldSpecificCallback === null || fieldSpecificCallback(field1, field2);
}

function subfieldsAreEqual(field1, field2, subfieldCode) {
// Check OK if neither one has given subfield.
  // Check fails if one field has given subfield and the other one does not
  if (!fieldHasSubfield(field1, subfieldCode)) {
    return !fieldHasSubfield(field2, subfieldCode);
  }
  if (!fieldHasSubfield(field2, subfieldCode)) {
    return false;
  }
  // Compare $3 subfields. If everything matches, OK, else FAIL:
  const sfSet1 = field1.subfields.filter(subfield => subfield.code === subfieldCode);
  const sfSet2 = field2.subfields.filter(subfield => subfield.code === subfieldCode);
  return MarcRecord.isEqual(sfSet1, sfSet2);
}

function subfieldsAreEmpty(field1, field2, subfieldCode) {
  if (!fieldHasSubfield(field1, subfieldCode) && !fieldHasSubfield(field2, subfieldCode)) {
    return true;
  }
  return false;
}


function controlSubfield6PermitsMerge(field1, field2) {
  if (subfieldsAreEmpty(field1, field2, '6')) {
    return true;
  }
  debug(`controlSubfield6PermitsMerge() not properly implemented. FAIL`);
  return false;
}


function controlSubfield9PermitsMerge(field1, field2) {
  if (subfieldsAreEmpty(field1, field2, '9')) {
    return true;
  }
  const sf9lessField1 = field1.subfields.filter(subfield => subfield.code !== '9' || !(/(?:<KEEP>|<DROP>)/u).test(subfield.value));
  const sf9lessField2 = field2.subfields.filter(subfield => subfield.code !== '9' || !(/(?:<KEEP>|<DROP>)/u).test(subfield.value));
  const result = MarcRecord.isEqual(sf9lessField1, sf9lessField2);
  if (!result) {
    debug(` control subfield 9 disallows merge`);
    return false;
  }
  return true;
}

function getPrefix(currSubfield) {
  if (currSubfield.value.match(/^\([^)]+\)[0-9]+$/u)) {
    return currSubfield.value.substr(0, currSubfield.value.indexOf(')') + 1);
  }
  if (currSubfield.value.match(/^https?:/u)) {
    return currSubfield.value.substr(0, currSubfield.value.lastindexOf('/') + 1);
  }
  return null;
}

function prefixIsOK(currSubfield, otherField, subfieldCode) {
  const prefix = getPrefix(currSubfield);
  if (prefix === null) {
    return false;
  }
  // Look for same prefix + different identifier
  const hits = otherField.subfields.filter(sf2 => sf2.code === subfieldCode && currSubfield.value !== sf2.value && sf2.value.indexOf(prefix) === 0);
  if (hits.length > 0) {
    debug(`Subfield ‡${subfieldCode} check FAILED: ‡${subfieldCode} '${currSubfield.value}' vs ‡${subfieldCode} '${hits[0].value}'.`);
    return false;
  }
  debug(`Subfield ‡${subfieldCode} check OK: ${prefix} not found on ${fieldToString(otherField)}`);
  return true;
}

function controlSubfieldContainingIdentifierPermitsMerge(field1, field2, subfieldCode) {
  if (!fieldHasSubfield(field1, subfieldCode, null) || !fieldHasSubfield(field2, subfieldCode, null)) {
    return true;
  }
  const result = field1.subfields.every(subfield => {
    if (subfield.code !== subfieldCode) {
      return true;
    }
    // NB! Here we assume that value have been normalized beforehand.
    // Eg. (isni) 0000 1234 5678 0000 vs https://isni.org/isni/0000123456780000
    // Eg. FIN11 vs FI-ASTERI-N vs kanton uri

    debug(`Compare ‡${subfieldCode} '${subfield.value}' with '${fieldToString(field2)}'.`);
    if (fieldHasSubfield(field2, field1.code, field1.value)) {
      return true;
    }

    return prefixIsOK(subfield, field2, subfieldCode);

  });
  if (!result) {
    debug(`Control subfield '${subfieldCode}' check failed.`);
    return false;
  }
  return true;
}

const controlSubfieldsContainingIdentifier = ['w', '0', '1'];

export function controlSubfieldsPermitMerge(field1, field2) {
  if (!controlSubfieldsContainingIdentifier.every(subfieldCode => controlSubfieldContainingIdentifierPermitsMerge(field1, field2, subfieldCode))) {
    debug(' control subfields with identifiers failed');
    return false;
  }

  if (!subfieldsAreEqual(field1, field2, '3') || !subfieldsAreEqual(field1, field2, '5')) {
    debug(' similar control subfield failes');
    return false;
  }

  if (!controlSubfield6PermitsMerge(field1, field2) ||
      !controlSubfield9PermitsMerge(field1, field2)) {
    return false;
  }
  // We don't handle $8 subfields here at all, as they affect multiple fields!
  if (!subfieldsAreEmpty(field1, field2, '8')) {
    debug(' csf8 failed');
    return false;
  }

  return true;
}
