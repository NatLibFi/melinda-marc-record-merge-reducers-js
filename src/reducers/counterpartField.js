//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldHasSubfield, fieldHasNSubfields, fieldToString} from './utils';
import {cloneAndNormalizeField} from './normalize';
import {normalizeControlSubfieldValue} from './normalizeIdentifier';
import {getMergeConstraintsForTag} from './mergeConstraints';
import {controlSubfieldsPermitMerge} from './controlSubfields';
import {indicator1Matches, indicator2Matches} from './compareIndicators';
import {mergableTag} from './mergableTag';
//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeField');

const counterpartRegexps = {
  '100': /^[17]00$/u, '110': /^[17]10$/u, '111': /^[17]11$/u, '130': /^[17]30$/u,
  '700': /^[17]00$/u, '710': /^[17]10$/u, '711': /^[17]11$/u, '730': /^[17]30$/u
};

function uniqueKeyMatches(baseField, sourceField, forcedKeyString = null) {
  // NB! Assume that field1 and field2 have same relevant subfields.
  // What to do if if base
  // const keySubfieldsAsString = forcedKeyString || getUniqueKeyFields(field1);
  const keySubfieldsAsString = forcedKeyString || getMergeConstraintsForTag(baseField.tag, 'key');
  //return mandatorySubfieldComparison(baseField, sourceField, keySubfieldsAsString);
  return optionalSubfieldComparison(baseField, sourceField, keySubfieldsAsString);
}

function mandatorySubfieldComparison(originalField1, originalField2, keySubfieldsAsString) {
  // NB! We use clones here, since these changes done below are not intented to appear on the actual records.
  const field1 = cloneAndNormalizeField(originalField1);
  const field2 = cloneAndNormalizeField(originalField2);
  if (keySubfieldsAsString === null) { // does not currently happen
    // If keySubfieldsAsString is undefined, (practically) everything is the string.
    // When everything is the string, the strings need to be (practically) identical.
    // (NB! Here order matters. We should probably make it matter everywhere.)
    // (However, keySubfieldsAsString === '' will always succeed. Used by 040 at least.)
    return fieldToString(field1) === fieldToString(field2);
  }
  const subfieldArray = keySubfieldsAsString.split('');

  return subfieldArray.every(subfieldCode => {
    const subfieldValues1 = field1.subfields.filter(subfield => subfield.code === subfieldCode).map(sf => sf.value);
    const subfieldValues2 = field2.subfields.filter(subfield => subfield.code === subfieldCode).map(sf => sf.value);
    // Assume that at least 1 instance must exist and that all instances must match
    if (subfieldValues1.length !== subfieldValues2.length) {
      debug(`mSC: Unique key: subfield ${subfieldCode} issues...`);
      return false;
    }

    return subfieldValues1.every(value => subfieldValues2.includes(value));
  });

}

function optionalSubfieldComparison(originalBaseField, originalSourceField, keySubfieldsAsString) {
  // We use clones here, since these changes done below are not intented to appear on the actual records.
  const field1 = cloneAndNormalizeField(originalBaseField);
  const field2 = cloneAndNormalizeField(originalSourceField);
  if (keySubfieldsAsString === null) { // does not currently happen
    // If keySubfieldsAsString is undefined, (practically) everything is the string.
    // When everything is the string, the strings need to be (practically) identical.
    // (NB! Here order matters. We should probably make it matter everywhere.)
    // (However, keySubfieldsAsString === '' will always succeed. Used by 040 at least.)
    return fieldToString(field1) === fieldToString(field2);
  }
  const subfieldArray = keySubfieldsAsString.split('');

  return subfieldArray.every(subfieldCode => {
    const subfieldValues1 = field1.subfields.filter(subfield => subfield.code === subfieldCode).map(sf => sf.value);
    const subfieldValues2 = field2.subfields.filter(subfield => subfield.code === subfieldCode).map(sf => sf.value);
    // If one side is empty, all is good
    if (subfieldValues1.length === 0 || subfieldValues2.length === 0) {
      return true;
    }
    // If one set is a subset of the other, all is good
    if (subfieldValues1.every(val => subfieldValues2.includes(val)) || subfieldValues2.every(val => subfieldValues1.includes(val))) {
      return true;
    }
    return false;

  });
}

function tagToRegexp(tag) {
  if (tag in counterpartRegexps) {
    // Are the hard-coded hacks actually used? Check...
    const regexp = counterpartRegexps[tag];
    //debug(`regexp for ${tag} found: ${regexp}`);
    return regexp;
  }
  // debug(`WARNING: tagToRegexp(${tag}): no precompiled regexp found.`);
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

  return subfieldArray.every(sfcode => fieldHasNSubfields(field1, sfcode) === fieldHasNSubfields(field2, sfcode));
}

function mergablePair(baseField, sourceField, fieldSpecificCallback = null) {
  // Indicators must typically be equal (there are exceptions such as non-filing characters though):
  if (!indicator1Matches(baseField, sourceField, undefined) || !indicator2Matches(baseField, sourceField, undefined)) {
    return false;
  }
  if (!controlSubfieldsPermitMerge(baseField, sourceField)) {
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
  //debug('Test semantics...');
  if (!semanticallyMergablePair(baseField, sourceField)) {
    return false;
  }
  return fieldSpecificCallback === null || fieldSpecificCallback(baseField, sourceField);
}


function pairableAsteriIDs(baseField, sourceField) {
  //nvdebug(`ASTERI1 ${fieldToString(baseField)}`); // eslint-disable-line
  //nvdebug(`ASTERI2 ${fieldToString(sourceField)}`); // eslint-disable-line

  // Check that relevant control subfield(s) exist in both records (as controlSubfieldsPermitMerge() doesn't check it):
  const fin11a = getAsteriIDs(baseField);
  if (fin11a.length === 0) {
    return false;
  }
  const fin11b = getAsteriIDs(sourceField);
  if (fin11b.length === 0) {
    return false;
  }
  //nvdebug(`ASTERI WP3:\n${fin11a.join(", ")}\n${fin11b.join(", ")}`); // eslint-disable-line

  // Check that found control subfields agree. Use pre-existing generic function to reduce code.
  // (NB! We could optimize and just return true here, as control subfield check is done elsewhere as well.
  // However, explicitly checking them here makes the code more robust.)
  if (!controlSubfieldsPermitMerge(baseField, sourceField)) {
    return false;
  }
  //console.log(`ASTERI PAIR ${fieldToString(sourceField)}`); // eslint-disable-line
  return true;

  // NB! This assumes that the default prefix for Asteri is FIN11, not FI-ASTERI-N nor a finaf urn.
  function getAsteriIDs(field) {
    return field.subfields.filter(sf => sf.code === '0')
      .map(sf => normalizeControlSubfieldValue(sf.value))
      .filter(val => val.substring(0, 7) === '(FIN11)');
  }
}


function pairableName(baseField, sourceField) {
  // 100$a$t: remove $t and everything after that
  const reducedField1 = fieldToNamePart(baseField);
  const reducedField2 = fieldToNamePart(sourceField);

  // Compare the remaining subsets...
  // First check that name matches...
  if (uniqueKeyMatches(reducedField1, reducedField2)) {
    //debug(`    name match: '${fieldToString(reducedField1)}'`);
    return true;
  }


  // However, mismatch is not critical! If Asteri ID matches, it's still a match!
  if (pairableAsteriIDs(baseField, sourceField)) {
    //debug(`    name match based on ASTERI $0'`);
    return true;
  }


  //debug(`    name mismatch: '${fieldToString(reducedField1)}' vs '${fieldToString(reducedField2)}'`);
  return false;
}


function semanticallyMergablePair(baseField, sourceField) {
  // On rare occasions a field contains also a title part, name part and title part must
  // be checked separately:
  if (!titlePartsMatch(baseField, sourceField)) {
    debug(` ${baseField.tag} is unmergable: Title part mismatch.`);
    return false;
  }

  // Hmm... we should check lifespan here, $d YYYY

  // Handle the field specific "unique key" (=set of fields that make the field unique
  if (!pairableName(baseField, sourceField)) {
    debug('Unmergable: Name part mismatch');
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
  const subsetField = {'tag': field.tag, 'ind1': field.ind1, 'ind2': field.ind2, subfields: field.subfields.filter((sf, i) => i < index || index === -1)};

  /*
  if (index > -1) { // eslint-disable-line functional/no-conditional-statement
    debug(`Name subset: ${fieldToString(subsetField)}`);
  }
  */
  return subsetField;
}

function fieldToTitlePart(field) {
  // Take everything after 1st subfield $t...
  const index = field.subfields.findIndex(currSubfield => currSubfield.code === 't');
  const subsetField = {'tag': field.tag, 'ind1': field.ind1, 'ind2': field.ind2, subfields: field.subfields.filter((sf, i) => i >= index)};
  debug(`Title subset: ${fieldToString(subsetField)}`);
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

  debug(`TITLE PARTS NEED TO BE COMPARED`);

  // 100$a$t: remove $t and everything after that
  const subset1 = fieldToTitlePart(field1);
  const subset2 = fieldToTitlePart(field2);
  return mandatorySubfieldComparison(subset1, subset2, 'dfhklmnoprstxvg');
}


export function getCounterpart(record, field, config = []) {
  if (!mergableTag(field.tag, config.skipMergeTags)) {
    // debug(`${field.tag}/mergable is ${tmp} `);
    return null;
  }
  // Get tag-wise relevant 1XX and 7XX fields:
  const counterpartCands = record.get(tagToRegexp(field.tag));
  // debug(counterpartCands);

  if (!counterpartCands || counterpartCands.length === 0) {
    return null;
  }

  debug(`Compare incoming '${fieldToString(field)}' with (up to) ${counterpartCands.length} existing field(s)`);
  const index = counterpartCands.findIndex((currCand) => {
    if (mergablePair(currCand, field)) {
      debug(`  OK pair found: '${fieldToString(currCand)}'. Returning it!`);
      return true;
    }
    debug(`  FAILED TO PAIR: '${fieldToString(currCand)}'. Skipping it!`);
    return false;
  });
  if (index > -1) {
    return counterpartCands[index];
  }
  return null;
}
