//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldHasSubfield, fieldIsRepeatable, fieldToString, fieldsAreIdentical, nvdebug, recordHasField} from './utils';
import {cloneAndPreprocessField} from './mergePreAndPostprocess';
import {getMergeConstraintsForTag} from './mergeConstraints';
import {isSubfieldGoodForMerge} from './mergeSubfield';
import {addableTag, mergableTag} from './mergableTag';

//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeField');

const counterpartRegexps = {
  '100': /^[17]00$/u, '110': /^[17]10$/u, '111': /^[17]11$/u, '130': /^[17]30$/u,
  '700': /^[17]00$/u, '710': /^[17]10$/u, '711': /^[17]11$/u, '730': /^[17]30$/u
};


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


function checkSolitariness(record, tag) {
  // Some of the fields are repeatable as per Marc21 specs, but we still don't want to multiple instances of tag.
  // These are listed in https://workgroups.helsinki.fi/x/K1ohCw . (However, we do not always agree with specs.)
  const solitary = getMergeConstraintsForTag(tag, 'solitary');
  if (solitary) {
    // Blocking is requested by specs for a field with 'solitary':true.
    // However, we won't block if all existing relevant fields come from source record.
    const candidateFields = record.get(tagToRegexp(tag));
    //return true;
    return candidateFields.some(field => !field.added);

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

function addField2(record, field) {
  if (!fieldCanBeAdded(record, field)) {
    return record;
  }

  field.subfields = field.subfields.filter(sf => isSubfieldGoodForMerge(field.tag, sf.code)); // eslint-disable-line functional/immutable-data

  if (field.subfields.length === 0) {
    debug(`ERROR: No subfields in field-to-add`);
    return record;
  }
  nvdebug(`Add as ${fieldToString(field)}`, debug);
  // Do we need to sort unmerged subfields?
  //return record.insertField(sortAdjacentSubfields(field));
  return record.insertField(field);
}

function skipMergeOrAddField(record, field) {
  if (!addableTag(field.tag, undefined) && !mergableTag(field.tag, undefined)) {
    return true;
  }
  // Skip duplicate field:
  if (record.fields.some(baseField => fieldsAreIdentical(field, baseField))) {
    //debug(`mergeOrAddField(): field '${fieldToString(field)}' already exists! No action required!`);
    return true;
  }

  return false;
}

export function addField(record, field) {
  const newField = cloneAndPreprocessField(field); // probably unnecessary cloning, but safer this way

  // skip duplicates and special cases:
  if (skipMergeOrAddField(record, newField)) {
    nvdebug(`addField(): don't add '${fieldToString(field)}'`, debug);
    return record;
  }

  // NB! Counterpartless field is inserted to 7XX even if field.tag says 1XX:
  nvdebug(`addField(): No mergable counterpart found for '${fieldToString(field)}'. Try to add it instead.`, debug);
  return addField2(record, newField);
}
