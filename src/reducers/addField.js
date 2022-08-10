//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldHasSubfield, fieldIsRepeatable, fieldToString, fieldsAreIdentical, nvdebug, recordHasField} from './utils';
import {cloneAndPreprocessField} from './mergePreAndPostprocess';
import {isSubfieldGoodForMerge} from './mergeSubfield';
import {addableTag} from './mergableTag';


//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:addField');

const defaultDoNotCopyIfFieldPresentRegexp = /^(?:041|260|264|300|310|321|335|336|337|338)/u;

function getConfigDoNotCopyIfFieldPresentRegexp(config) {
  if (config.doNotCopyIfFieldPresentRegexp) {
    return new RegExp(`^${config.doNotCopyIfFieldPresentRegexp}`, 'u');
  }
  return undefined;
}

function recordHasOriginalFieldWithTag(record, tag) {
  const candidateFields = record.get(new RegExp(`^${tag}$`, 'u'));
  // Only original fields matter here Added fields are not counted.
  return candidateFields.some(field => !field.added);
}

function repeatableTagIsNonAddable(record, tag, config) {
  // Some of the fields are repeatable as per Marc21 specs, but we still don't want to multiple instances of tag.
  // The original listing is from https://workgroups.helsinki.fi/x/K1ohCw .
  // However, we might have deviated from the specs.
  // NB! DO WE WAN'T TO OVERRIDE THESE VIA CONFIG? Can't think of a case, so not implementing support for that.
  if (tag.match(getNonAddableRegexp(config))) {
    return recordHasOriginalFieldWithTag(record, tag);
  }

  // No reason to block:
  return false;

  function getNonAddableRegexp(config) {
    const configRegexp = getConfigDoNotCopyIfFieldPresentRegexp(config);
    return configRegexp ? configRegexp : defaultDoNotCopyIfFieldPresentRegexp;
  }
}

function repetitionBlocksAdding(record, tag, config) {
  // It's not a repetition:
  if (!recordHasField(record, tag)) {
    return false;
  }
  // It's a repetition:
  if (!fieldIsRepeatable(tag)) {
    return true; // blocked
  }
  // Semantics/logic prevents adding (can this be overridden via config?):
  return repeatableTagIsNonAddable(record, tag, config);
}

function skipAddField(record, field, config = {}) {
  if (repetitionBlocksAdding(record, field.tag, config)) {
    nvdebug(`Unrepeatable field already exists. Failed to add '${fieldToString(field)}'.`, debug);
    return true;
  }

  // NB! NB! Required by specs. But should these be configured?
  if (field.tag === '240' && recordHasField(record, '130')) {
    return true;
  }
  if (field.tag === '830' && !fieldHasSubfield(field, 'x')) {
    return true;
  }
  // We could block 260/264 pairs here.

  // Should we have something like config.forceAdd
  // Skip duplicate field:
  if (record.fields.some(baseField => fieldsAreIdentical(field, baseField))) {
    //debug(`addField(): field '${fieldToString(field)}' already exists! No action required!`);
    return true;
  }

  if (!addableTag(field.tag, config)) {
    return true;
  }

  return false;
}

function addField2(record, field) {
  // NB! Some subfields are never added. Strip them.
  field.subfields = field.subfields.filter(sf => isSubfieldGoodForMerge(field.tag, sf.code)); // eslint-disable-line functional/immutable-data

  // NB! Subfieldless fields (and control fields (00X)) are not handled here.
  if (field.subfields.length === 0) {
    debug(`ERROR: No subfields in field-to-add`);
    return record;
  }
  nvdebug(`Add as ${fieldToString(field)}`, debug);
  // Do we need to sort unmerged subfields?
  //return record.insertField(sortAdjacentSubfields(field));
  return record.insertField(field);
}

export function addField(record, field, config = {}) {
  const newField = cloneAndPreprocessField(field); // probably unnecessary cloning, but safer this way

  // skip duplicates and special cases:
  if (skipAddField(record, newField, config)) {
    nvdebug(`addField(): don't add '${fieldToString(field)}'`, debug);
    return false;
  }

  // NB! Counterpartless field is inserted to 7XX even if field.tag says 1XX:
  nvdebug(`addField(): Try to add '${fieldToString(field)}'.`, debug);
  return addField2(record, newField);
}
