// For each incoming field that

import createDebugLogger from 'debug';
import {fieldHasSubfield, fieldHasNSubfields, fieldHasMultipleSubfields, fieldToString, nvdebug, removeCopyright} from './utils';
import {cloneAndNormalizeFieldForComparison, cloneAndRemovePunctuation} from '@natlibfi/marc-record-validators-melinda/dist/normalizeFieldForComparison';
// This should be done via our own normalizer:
import {normalizeControlSubfieldValue} from '@natlibfi/marc-record-validators-melinda/dist/normalize-identifiers';

import {getMergeConstraintsForTag} from './mergeConstraints';
import {controlSubfieldsPermitMerge} from './controlSubfields';
import {mergableIndicator1, mergableIndicator2} from './mergableIndicator';
import {partsAgree} from '@natlibfi/marc-record-validators-melinda/dist/normalizeSubfieldValueForComparison';
import {normalizeForSamenessCheck, valueCarriesMeaning} from './worldKnowledge';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeField:counterpart');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

const counterpartRegexps = { // NB! tag is from source!
  // Note that in the normal case, all source 1XX fields have been converted to 7XX fields.
  '100': /^[17]00$/u, '110': /^[17]10$/u, '111': /^[17]11$/u, '130': /^[17]30$/u,
  '260': /^26[04]$/u, '264': /^26[04]$/u,
  '700': /^[17]00$/u, '710': /^[17]10$/u, '711': /^[17]11$/u, '730': /^[17]30$/u,
  // Hacks:
  '940': /^[29]40$/u, '973': /^[79]73$/u
};

/*
function differentPublisherSubfields(field1, field2) {
  if (field1.tag === '260' && field2.tag === '264' && field2.ind2 === '3') {
    return true;
  }
  if (field1.tag === '264' && field1.ind2 === '3' && field2.tag === '260') {
    return true;
  }
  return false;
}
*/

function pairableValue(tag, subfieldCode, value1, value2) {
  if (partsAgree(value1, value2, tag, subfieldCode)) {
    // Pure baseness: here we assume that base's value1 is better than source's value2.
    return value1;
  }

  return undefined;
}


function counterpartExtraNormalize(tag, subfieldCode, value) {
  /* eslint-disable prefer-named-capture-group, no-param-reassign */
  // Remove trailing punctuation:
  value = value.replace(/(\S)(?:,|\.|\?|!|\. -| *:| *;| =| \/)$/u, '$1');
  // Remove brackets:
  value = value.replace(/^\(([^()]+)\)$/u, '$1'); // Remove starting-'(' and ending-')'
  value = value.replace(/^\[([^[\]]+)\]$/u, '$1'); // Remove starting-'[' and ending-']'
  // Mainly for field 260$c:
  value = removeCopyright(value);


  value = normalizeForSamenessCheck(tag, subfieldCode, value);

  /* eslint-enable */
  return value;
}

function uniqueKeyMatches(baseField, sourceField, forcedKeyString = null) {
  // NB! Assume that field1 and field2 have same relevant subfields.
  // What to do if if base
  // const keySubfieldsAsString = forcedKeyString || getUniqueKeyFields(field1);
  const keySubfieldsAsString = forcedKeyString || getMergeConstraintsForTag(baseField.tag, 'key');
  //return mandatorySubfieldComparison(baseField, sourceField, keySubfieldsAsString);
  return optionalSubfieldComparison(baseField, sourceField, keySubfieldsAsString);
}


function optionalSubfieldComparison(originalBaseField, originalSourceField, keySubfieldsAsString) {
  // Here "optional subfield" means a subfield, that needs not to be present, but if present, it must be identical...
  // (Think of a better name...)
  // We use clones here, since these changes done below are not intented to appear on the actual records.
  const field1 = cloneAndNormalizeFieldForComparison(originalBaseField);
  const field2 = cloneAndNormalizeFieldForComparison(originalSourceField);

  if (keySubfieldsAsString === null) { // does not currently happen
    // If keySubfieldsAsString is undefined, (practically) everything is the string.
    // When everything is the string, the strings need to be (practically) identical.
    // (NB! Here order matters. We should probably make it matter everywhere.)
    // (However, keySubfieldsAsString === '' will always succeed. Used by 040 at least.)
    // TEE: SKIPPAA INDIKAATTORIT!
    return fieldToString(field1) === fieldToString(field2);
  }
  const subfieldArray = keySubfieldsAsString.split('');

  // Long forgotten, but my educated guess about this: if 'key' is defined in merge constraints
  // for this field, then at least one of the subfield codes in 'key' must be present in both fields.
  // However, this is not necessarily right.
  if (subfieldArray.length > 0 && !subfieldArray.some(sfCode => hasCommonNominator(sfCode))) {
    return false;
  }


  return subfieldArray.every(subfieldCode => testOptionalSubfield(originalBaseField.tag, subfieldCode));


  function hasCommonNominator(subfieldCode) {
    nvdebug(`hasCommonNominator(${subfieldCode}): '${fieldToString(originalBaseField)}' vs '${fieldToString(originalSourceField)}'`, debugDev);

    // If base has $a and source has $b, there's no common nominator, thus fail...
    const subfields1 = field1.subfields.filter(subfield => subfield.code === subfieldCode && valueCarriesMeaning(field1.tag, subfield.code, subfield.value));
    const subfields2 = field2.subfields.filter(subfield => subfield.code === subfieldCode && valueCarriesMeaning(field2.tag, subfield.code, subfield.value));

    return subfields1.length > 0 && subfields2.length > 0;
  }

  function testOptionalSubfield(tag, subfieldCode) {
    // NB! Don't compare non-meaningful subfields
    const subfields1 = field1.subfields.filter(subfield => subfield.code === subfieldCode && valueCarriesMeaning(field1.tag, subfield.code, subfield.value));
    const subfields2 = field2.subfields.filter(subfield => subfield.code === subfieldCode && valueCarriesMeaning(field2.tag, subfield.code, subfield.value));

    // If one side is empty, all is good
    if (subfields1.length === 0 || subfields2.length === 0) {
      return true;
    }

    //nvdebugSubfieldArray(subfields1, 'SF1', debugDev);
    //nvdebugSubfieldArray(subfields2, 'SF2', debugDev);

    // When pairing we can use stronger normalizations than the generic one:
    const subfieldValues1 = subfields1.map(sf => counterpartExtraNormalize(tag, subfieldCode, sf.value));
    const subfieldValues2 = subfields2.map(sf => counterpartExtraNormalize(tag, subfieldCode, sf.value));

    //nvdebug(`SF1 NORM: ${subfieldValues1.join(' --')}`, debugDev);
    //nvdebug(`SF2 NORM: ${subfieldValues2.join(' --')}`, debugDev);

    // If one set is a subset of the other, all is probably good (how about 653$a, 505...)
    if (subfieldValues1.every(val => subfieldValues2.includes(val)) || subfieldValues2.every(val => subfieldValues1.includes(val))) {
      return true;
    }

    if (subfieldValues1.length === 1 && subfieldValues2.length === 1) {
      return pairableValue(field1.tag, subfieldCode, subfieldValues1[0], subfieldValues2[0]) !== undefined;
    }

    return false;

  }
}


function mandatorySubfieldComparison(originalField1, originalField2, keySubfieldsAsString) {
  // NB! We use clones here, since these changes done below are not intented to appear on the actual records.
  const field1 = cloneAndNormalizeFieldForComparison(originalField1);
  const field2 = cloneAndNormalizeFieldForComparison(originalField2);
  if (keySubfieldsAsString === null) { // does not currently happen
    // If keySubfieldsAsString is undefined, (practically) everything is the string.
    // When everything is the string, the strings need to be (practically) identical.
    // (NB! Here order matters. We should probably make it matter everywhere.)
    // (However, keySubfieldsAsString === '' will always succeed. Used by 040 at least.)
    return fieldToString(field1) === fieldToString(field2);
  }
  const subfieldArray = keySubfieldsAsString.split('');

  //const differentSubfieldCodes = differentPublisherSubfields(originalField1, originalField2);

  return subfieldArray.every(subfieldCode => mandatorySingleSubfieldComparison(subfieldCode));

  function mandatorySingleSubfieldComparison(subfieldCode) {
    //const otherSubfieldCode = getOtherSubfieldCode(subfieldCode);
    const subfieldValues1 = field1.subfields.filter(subfield => subfield.code === subfieldCode).map(sf => sf.value);
    const subfieldValues2 = field2.subfields.filter(subfield => subfield.code === subfieldCode).map(sf => sf.value);
    // Assume that at least 1 instance must exist and that all instances must match
    if (subfieldValues1.length !== subfieldValues2.length) {
      debugDev(`mSC: Unique key: subfield ${subfieldCode} issues...`);
      return false;
    }

    return subfieldValues1.every(value => subfieldValues2.includes(value));
  }

}


function tagToRegexp(tag) {
  if (tag in counterpartRegexps) { // eg. 700 looks for tag /^[17]00$/...
    const regexp = counterpartRegexps[tag];
    //nvdebug(`regexp for ${tag} found: ${regexp}`, debugDev);
    return regexp;
  }
  //nvdebug(`WARNING: tagToRegexp(${tag}): no precompiled regexp found.`, debugDev);
  return new RegExp(`^${tag}$`, 'u');
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
      debugDev(`Required subfield ‡${sfcode} not found in '${fieldToString(field)}'!`);
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

  return subfieldArray.every(sfcode => fieldHasNSubfields(field1, sfcode) === fieldHasNSubfields(field2, sfcode));
}

function syntacticallyMergablePair(baseField, sourceField, config) {
  // Indicators must typically be equal (there are exceptions such as non-filing characters though):
  if (!mergableIndicator1(baseField, sourceField, config)) {
    nvdebug(`non-mergable (reason: indicator1): ${JSON.stringify(config)}`, debugDev);
    return false;
  }

  if (!mergableIndicator2(baseField, sourceField, config)) {
    nvdebug(`non-mergable (reason: indicator2): ${JSON.stringify(config)}`, debugDev);
    return false;
  }

  if (!controlSubfieldsPermitMerge(baseField, sourceField)) {
    nvdebug('non-mergable (reason: control subfield)', debugDev);
    return false;
  }

  // NB! field1.tag and field2.tag might differ (1XX vs 7XX). Therefore required subfields might theoretically differ as well.
  // Note: Theoretically 260 $efg vs 264 with IND2=3 has already been handled by the preprocessor.
  // Thus check both:
  if (!areRequiredSubfieldsPresent(baseField) || !areRequiredSubfieldsPresent(sourceField)) {
    nvdebug('non-mergable (reason: missing subfields)', debugDev);
    return false;
  }

  // Stuff of Hacks! Eg. require that both fields either have or have not X00$t:
  if (!arePairedSubfieldsInBalance(baseField, sourceField)) {
    nvdebug('required subfield pair check failed.', debugDev);
    return false;
  }

  return true;
}

function mergablePair(baseField, sourceField, config) {
  if (!syntacticallyMergablePair(baseField, sourceField, config)) {
    return false;
  }

  //debug('Test semantics...');
  if (!semanticallyMergablePair(baseField, sourceField)) {
    nvdebug('non-mergable (reason: semantics)', debugDev);
    return false;
  }

  nvdebug(`MERGABLE PAIR:\n  B: ${fieldToString(baseField)}\n  S: ${fieldToString(sourceField)}`, debugDev);
  return true;
}


function pairableAsteriIDs(baseField, sourceField) {
  //nvdebug(`ASTERI1 ${fieldToString(baseField)}`, debugDev); // eslint-disable-line
  //nvdebug(`ASTERI2 ${fieldToString(sourceField)}`, debugDev); // eslint-disable-line

  // Check that relevant control subfield(s) exist in both records (as controlSubfieldsPermitMerge() doesn't check it):
  const fin11a = getAsteriIDs(baseField);
  if (fin11a.length === 0) {
    return false;
  }
  const fin11b = getAsteriIDs(sourceField);
  if (fin11b.length === 0) {
    return false;
  }
  //nvdebug(`ASTERI WP3:\n${fin11a.join(", ")}\n${fin11b.join(", ")}`, debugDev); // eslint-disable-line

  // Check that found control subfields agree. Use pre-existing generic function to reduce code.
  // (NB! We could optimize and just return true here, as control subfield check is done elsewhere as well.
  // However, explicitly checking them here makes the code more robust.)
  if (!controlSubfieldsPermitMerge(baseField, sourceField)) {
    return false;
  }
  //console.log(`ASTERI PAIR ${fieldToString(sourceField)}`); // eslint-disable-line
  return true;

  // NB! This boldly assumes that the default prefix for Asteri is '(FIN11)', not '(FI-ASTERI-N)' nor a finaf urn...
  function getAsteriIDs(field) {
    return field.subfields.filter(sf => sf.code === '0')
      .map(sf => normalizeControlSubfieldValue(sf.value))
      .filter(val => val.substring(0, 7) === '(FIN11)');
  }
}


function hasRepeatableSubfieldThatShouldBeTreatedAsNonRepeatable(field) {
  if (field.tag === '260' || field.tag === '264') {
    return ['a', 'b', 'c', 'e', 'f', 'g'].some(subfieldCode => fieldHasMultipleSubfields(field, subfieldCode));
  }
  if (field.tag === '382') {
    return ['a', 'b', 'd', 'e', 'n', 'p'].some(subfieldCode => fieldHasMultipleSubfields(field, subfieldCode));
  }
  if (field.tag === '505') {
    return ['t', 'r', 'g'].some(subfieldCode => fieldHasMultipleSubfields(field, subfieldCode));
  }

  return false;
}

function pairableName(baseField, sourceField) {
  // 100$a$t: remove $t and everything after that
  const reducedField1 = fieldToNamePart(baseField);
  const reducedField2 = fieldToNamePart(sourceField);

  const string1 = fieldToString(reducedField1);
  const string2 = fieldToString(reducedField2);

  //nvdebug(`IN: pairableName():\n '${string1}' vs\n '${string2}'`, debugDev);
  if (string1 === string2) {
    return true;
  }

  // Essentially these are too hard to handle with field-merge (eg. multi-505$g)
  if (hasRepeatableSubfieldThatShouldBeTreatedAsNonRepeatable(reducedField1) || hasRepeatableSubfieldThatShouldBeTreatedAsNonRepeatable(reducedField2)) {
    return false;
  }

  // Compare the remaining subsets...
  // First check that name matches...
  if (uniqueKeyMatches(reducedField1, reducedField2)) {
    nvdebug(`    name match: '${fieldToString(reducedField1)}'`, debugDev);

    return true;
  }


  // However, name mismatch is not critical! If Asteri ID matches, it's still a match!
  // *NOT* sure whether this a good idea.
  // 2023-01-24 Disable this. Caretaker can fix these later on. Not a job for merge.
  // We can't be sure that $0 pair is corrent, nor which version (base or source) to use.
  // 2023-03-07: Enable this again!
  if (pairableAsteriIDs(baseField, sourceField)) {
    //nvdebug(`    name match based on ASTERI $0'`, debugDev);
    return true;
  }

  nvdebug(`    name mismatch: '${fieldToString(reducedField1)}' vs '${fieldToString(reducedField2)}'`, debugDev);
  return false;
}


function semanticallyMergablePair(baseField, sourceField) {
  // On rare occasions a field contains also a title part. For these name part (= normally everything) and title part
  // must be checked separately:
  if (!titlePartsMatch(baseField, sourceField)) {
    nvdebug(` ${baseField.tag} is unmergable: Title part mismatch.`, debugDev);
    return false;
  }

  // Hmm... we should check lifespan here, $d YYYY

  // Handle the field specific "unique key" (=set of fields that make the field unique
  if (!pairableName(baseField, sourceField)) {
    nvdebug('Unmergable: Name part mismatch', debugDev);
    return false;
  }
  //debug(' Semantic checks passed! We are MERGABLE!');

  return true;
}


function namePartThreshold(field) {
  // Threshold is only applicaple to some tags..
  if (!(/[10]0$/u).test(field.tag)) {
    return -1;
  }
  const t = field.subfields.findIndex(currSubfield => currSubfield.code === 't');
  const u = t; // field.subfields.findIndex(currSubfield => currSubfield.code === 'u');
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
  const relevantSubfields = field.subfields.filter((sf, i) => i < index || index === -1);
  const subsetField = {'tag': field.tag, 'ind1': field.ind1, 'ind2': field.ind2, subfields: relevantSubfields};

  /*
  if (index > -1) { // eslint-disable-line functional/no-conditional-statements
    debugDev(`Name subset: ${fieldToString(subsetField)}`);
  }
  */
  return subsetField;
}

function fieldToTitlePart(field) {
  // Take everything after 1st subfield $t...
  const index = field.subfields.findIndex(currSubfield => currSubfield.code === 't');
  const subsetField = {'tag': field.tag, 'ind1': field.ind1, 'ind2': field.ind2, subfields: field.subfields.filter((sf, i) => i >= index)};
  debugDev(`Title subset: ${fieldToString(subsetField)}`);
  return subsetField;
}

function containsTitlePart(field) {
  return fieldCanHaveTitlePart(field) && fieldHasSubfield(field, 't');

  function fieldCanHaveTitlePart(field) {
    return ['100', '110', '111', '700', '710', '711'].includes(field.tag);
  }
}

function titlePartsMatch(field1, field2) {
  if (!containsTitlePart(field1)) {
    return !containsTitlePart(field2);
  }
  if (!containsTitlePart(field2)) {
    return false;
  }

  debugDev(`TITLE PARTS NEED TO BE COMPARED`);

  // 100$a$t: remove $t and everything after that
  const subset1 = fieldToTitlePart(field1);
  const subset2 = fieldToTitlePart(field2);
  // Easter Egg, ffs. Hardcoded exception
  return mandatorySubfieldComparison(subset1, subset2, 'dfhklmnoprstxvg');
}


function getAlternativeNamesFrom9XX(record, field) {
  // Should we support 6XX and 8XX as well? Prolly not...
  if (!field.tag.match(/^(?:100|110|111|600|610|611|700|710|711)$/u)) {
    return [];
  }
  const tag = `9${field.tag.substring(1)}`;
  const cands = record.get(tag).filter(f => fieldHasSubfield(f, 'a') && fieldHasSubfield(f, 'y'));
  if (cands.length === 0) {
    return [];
  }
  const punctuationlessField = cloneAndRemovePunctuation(field);
  const [name] = punctuationlessField.subfields.filter(sf => sf.code === 'a').map(sf => sf.value);

  return cands.map(candField => getAltName(candField)).filter(val => val !== undefined);


  function getAltName(altField) {
    const [altA] = altField.subfields.filter(sf => sf.code === 'a').map(sf => sf.value);
    const [altY] = altField.subfields.filter(sf => sf.code === 'y').map(sf => sf.value);
    nvdebug(`Compare '${name}' vs '${altA}'/'${altY}'`, debugDev);
    if (name === altA) {
      return altY;
    }
    if (name === altY) {
      return altA;
    }
    nvdebug(` miss`, debugDev);
    return undefined;
  }

}


function mergablePairWithAltName(normCandField, normalizedField, altName, config) {
  // Replace source field $a name with alternative name and then compare:
  const [a] = normalizedField.subfields.filter(sf => sf.code === 'a');
  if (!a) {
    return false;
  }
  a.value = altName; // eslint-disable-line functional/immutable-data

  return mergablePair(normCandField, normalizedField, config);
}

function getCounterpartIndex(field, counterpartCands, altNames, config) {
  const normalizedField = cloneAndNormalizeFieldForComparison(field);
  const normalizedCounterpartCands = counterpartCands.map(f => cloneAndNormalizeFieldForComparison(f));
  const index = normalizedCounterpartCands.findIndex(normCandField => mergablePair(normCandField, normalizedField, config));
  if (index > -1) {
    return index;
  }

  return normalizedCounterpartCands.findIndex(normCandField => altNames.some(altName => mergablePairWithAltName(normCandField, normalizedField, altName, config)));
}


function field264Exception(baseField, sourceRecord, sourceField, config) {
  nvdebug('Field 264 exception as per MET-456');
  if (baseField.tag !== '264') {
    return false;
  }

  if (sourceField.tag !== '264' || sourceRecord.get('264').length !== 1) {
    return false;
  }

  // Don't worry about semantics:
  return syntacticallyMergablePair(sourceField, baseField, config);
}

export function getCounterpart(baseRecord, sourceRecord, field, config) {
  // First get relevant candidate fields. Note that 1XX and corresponding 7XX are considered equal.
  // Tags 260 and 264 are lumped together.
  // Hacks: 973 can merge with 773, 940 can merge with 240 (but not the other way around)
  //nvdebug(`COUNTERPART FOR '${fieldToString(field)}'?`, debugDev);
  const counterpartCands = baseRecord.get(tagToRegexp(field.tag));

  if (!counterpartCands || counterpartCands.length === 0) {
    //nvdebug(`No counterpart(s) found for ${fieldToString(field)}`, debugDev);
    return null;
  }

  nvdebug(`Compare incoming '${fieldToString(field)}' with (up to) ${counterpartCands.length} existing field(s)`, debugDev);

  const normalizedField = cloneAndNormalizeFieldForComparison(field);

  nvdebug(`Norm to: '${fieldToString(normalizedField)}'`, debugDev);


  // Try to look for alternative names from base and source record's 9XX fields:
  const alternativeNames = getAlternativeNamesFrom9XX(baseRecord, field).concat(getAlternativeNamesFrom9XX(sourceRecord, field));
  const uniqueAlternativeNames = alternativeNames.filter((name, i) => alternativeNames.indexOf(name) === i);

  //nvdebug(` S: ${fieldToString(normalizedField)}`, debugDev);
  // Then find (the index of) the first mathing candidate field and return it.
  const index = getCounterpartIndex(normalizedField, counterpartCands, uniqueAlternativeNames, config);

  if (index > -1) {
    return counterpartCands[index];
  }

  // MET-456 exception
  if (counterpartCands.length === 1 && field264Exception(counterpartCands[0], sourceRecord, field, config)) {
    return counterpartCands[0];
  }

  return null;
}
