import {resetCorrespondingField880} from './resetField880Subfield6AfterFieldTransfer.js';

import {fieldToString, nvdebug} from './utils.js';

//import {sortAdjacentSubfields} from './sortSubfields';

import createDebugLogger from 'debug';
//import {MarcRecord} from '@natlibfi/marc-record';
//import {/*fieldToString,*/ nvdebug} from './utils';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
//const debugData = debug.extend('data');

// fieldSpecs
// - tagPattern (eg. '^(123|456)$' or
// - tag (eg '123')
// - containsSubfields (array)
//   - code
//   - valuePattern or value

function getSpecifiedFields(record, fieldSpecs) {
  const regexp = regexpifyFieldSpecs(fieldSpecs);
  if (regexp) {
    return record.get(regexp);
  }
  return [];

  function regexpifyFieldSpecs(fieldSpecs) {
    if (fieldSpecs.tagPattern) {
      //nvdebug(`Tag pattern to regexp: /${fieldSpecs.tagPattern}/`);
      return new RegExp(`${fieldSpecs.tagPattern}`, 'u');
    }
    if (fieldSpecs.tag) {
      //nvdebug(`Tag to egexp: /^${fieldSpecs.tag}$/`);
      return new RegExp(`^${fieldSpecs.tag}$`, 'u');
    }
    nvdebug(`TAG Regexp: NULL`);
    return null;
  }
}


function subfieldFilterMatchesCode(subfieldCode, filterCode = undefined, filterCodePattern = undefined) {
  // Check subfield code as a string:
  if (filterCode) {
    if (filterCode !== subfieldCode) {
      nvdebug(` REJECTED SUBFIELD. Reason: code`);
      return false;
    }
  }

  if (filterCodePattern) {
    const regExp = RegExp(`${filterCodePattern}`, 'u');
    if (!subfieldCode.match(regExp)) {
      nvdebug(` REJECTED SUBFIELD. Reason: code regexp`);
      return false;
    }
  }

  return true;
}

function subfieldFilterMatchesValue(subfieldValue, targetValue, targetValuePattern) {
  if (targetValuePattern) {
    const valueRegExp = RegExp(`${targetValuePattern}`, 'u');
    if (!subfieldValue.match(valueRegExp)) {
      nvdebug(` REJECTED SUBFIELD. Reason: value regexp`);
      return false;
    }
  }

  if (targetValue) { // eg. 041$a 'zxx' removal
    if (subfieldValue !== targetValue) {
      nvdebug(` REJECTED SUBFIELD. Reason: value string`);
      return false;
    }
  }
  return true;
}

function subfieldFilterMatches(subfield, subfieldFilter) {
  nvdebug(`SF ${JSON.stringify(subfieldFilter)}`);

  if (!subfieldFilterMatchesCode(subfield.code, subfieldFilter.code, subfieldFilter.codePattern)) {
    return false;
  }

  if (!subfieldFilterMatchesValue(subfield.value, subfieldFilter.value, subfieldFilter.valuePattern)) {
    return false;
  }

  nvdebug(` SUBFIELD ACCEPTED $${subfield.code} ${subfield.value}`);
  return true;
}

function subfieldFilterUnwantedMatches(subfield, subfieldFilter) {
  if (!subfieldFilter.missingCode) {
    return false;
  }
  if (!subfieldFilterMatchesCode(subfield.code, subfieldFilter.missingCode, subfieldFilter.missingCodePattern)) {
    return false;
  }
  if (!subfieldFilterMatchesValue(subfield.value, subfieldFilter.value, subfieldFilter.valuePattern)) {
    return false;
  }
  return true;
}

function subfieldsFilterMatches(subfields, subfieldFilter) { // Field-level filter check
  // Sanity check:
  if (!subfields) {
    return false;
  }

  if (!getMatches(subfields, subfieldFilter)) {
    return false;
  }

  return !getNegativeMatches(subfields, subfieldFilter);

  function getMatches(subfields, subfieldFilter) {
    const matchingSubfields = subfields.filter(sf => subfieldFilterMatches(sf, subfieldFilter));
    return matchingSubfields.length > 0;
  }

  function getNegativeMatches(subfields, subfieldFilter) {
    const matchingSubfields = subfields.filter(sf => subfieldFilterUnwantedMatches(sf, subfieldFilter));
    return matchingSubfields.length > 0;
  }
}


// Each subfield filter matches the field...
function subfieldFiltersMatch(field, subfieldFilters) {

  return subfieldFilters.every(subfieldFilter => subfieldsFilterMatches(field.subfields, subfieldFilter));
}


function filterFieldsUsingSubfieldFilters(fields, subfieldFilters) {
  if (!subfieldFilters) {
    return fields;
  }
  return fields.filter(field => subfieldFiltersMatch(field, subfieldFilters));
}

function filterFieldsUsingFieldToString(fields, value) {
  if (value === undefined) {
    return fields;
  }
  nvdebug(`Looking for value '${value}'`);
  return fields.filter(field => {
    nvdebug(`              got '${fieldToString(field)}'`);
    return fieldToString(field) === value;
  });
}

function getSpecifiedFieldsAndFilterThem(record, fieldSpecs) {
  const targetFields = getSpecifiedFields(record, fieldSpecs);
  if (targetFields.length === 0) {
    return targetFields;
  }
  nvdebug(`Got ${targetFields.length} fields. Filter them...`);
  const filteredFields1 = filterFieldsUsingSubfieldFilters(targetFields, fieldSpecs.subfieldFilters);
  nvdebug(`${filteredFields1.length} field(s) remain after subfield filters...`);
  const filteredFields2 = filterFieldsUsingFieldToString(filteredFields1, fieldSpecs.value);
  nvdebug(`${filteredFields2.length} field(s) remain after whole value filtering...`);
  return filteredFields2;
}

/*
function logRecordType(recordType) {
  if (['base', 'both', 'source'].includes(recordType)) {
    nvdebug(`Filter applies to record type ${recordType.toUpperCase()}`);
    return;
  }
  // Log warning/error here
  nvdebug(`ERROR: record type ${recordType} is not defined!`);
}
*/

function getTargetRecordsForOperation(base, source, operation) {
  const {recordType} = operation;
  // logRecordType(recordType);

  // This is hard-coded exception/hack.
  // Can't use 'both' as swap rules might feed each other.
  if (operation.operation === 'swapFields') {
    return [base];
  }

  if (recordType === 'base') {
    return [base];
  }

  if (recordType === 'both') {
    return [base, source];
  }

  if (recordType === 'source') {
    return [source];
  }

  return [];
}

function operationRemoveField(record, fieldSpecification) {
  const deletableFields = getSpecifiedFieldsAndFilterThem(record, fieldSpecification);
  if (deletableFields.length === 0) {
    return;
  }
  nvdebug(`operationRemoveField got ${deletableFields.length} deletable field(s)`);
  deletableFields.forEach(field => record.removeField(field));
}

function operationRenameSubfield(record, fieldSpecification, renamableSubfieldFilter) {
  const relevantFields = getSpecifiedFieldsAndFilterThem(record, fieldSpecification);
  nvdebug(`operationRenameSubfield() got ${relevantFields.length} field(s)`);
  relevantFields.forEach(field => {
    renameSubfields(field, renamableSubfieldFilter);
  });

  function renameSubfields(field, renamableSubfieldFilter) {
    nvdebug(`Try to rename subfields from ${fieldToString(field)} using ${JSON.stringify(renamableSubfieldFilter)}`);
    field.subfields.forEach(sf => {
      if (subfieldFilterMatches(sf, renamableSubfieldFilter)) { // eslint-disable-line functional/no-conditional-statement
        sf.code = renamableSubfieldFilter.newCode; // eslint-disable-line functional/immutable-data
      }
    });
  }
}

function operationRemoveSubfield(record, fieldSpecification, deletableSubfieldFilter) {
  const relevantFields = getSpecifiedFieldsAndFilterThem(record, fieldSpecification);
  if (relevantFields.length === 0) {
    return;
  }
  nvdebug(`operationRemoveSubfield() got ${relevantFields.length} field(s)`);
  relevantFields.forEach(field => {
    nvdebug(`Try to remove subfields from ${fieldToString(field)} using ${JSON.stringify(deletableSubfieldFilter)}`);
    const remainingSubfields = field.subfields.filter(sf => !subfieldFilterMatches(sf, deletableSubfieldFilter));
    if (remainingSubfields.length < field.subfields.length) {
      nvdebug(` Got ${remainingSubfields.length}/${field.subfields.length} keepable subfield(s)`);
      // Delete the whole field as last subfield gets deleted:
      if (remainingSubfields.length === 0) { // eslint-disable-line functional/no-conditional-statement
        nvdebug('Delete subfieldless field');
        record.removeField(field);
        return;
      }

      field.subfields = remainingSubfields; // eslint-disable-line functional/immutable-data
      return;
    }
  });
}

function operationRetag(record, fieldSpecification, newTag) {
  const relevantFields = getSpecifiedFieldsAndFilterThem(record, fieldSpecification);
  relevantFields.forEach(field => {
    const oldTag = field.tag;
    resetCorrespondingField880(field, record, newTag);
    field.tag = newTag; // eslint-disable-line functional/immutable-data
    nvdebug(`Retagged field ${oldTag} => ${fieldToString(field)}`); //, debug);

  });
}

function operationSwapFields(record, otherRecord, fieldSpecification) {
  const relevantFields1 = getSpecifiedFieldsAndFilterThem(record, fieldSpecification);
  const relevantFields2 = getSpecifiedFieldsAndFilterThem(otherRecord, fieldSpecification);

  relevantFields1.forEach(field => record.removeField(field));
  relevantFields2.forEach(field => otherRecord.removeField(field));

  relevantFields1.forEach(field => otherRecord.insertField(field));
  relevantFields2.forEach(field => record.insertField(field));

  nvdebug(`Moved ${relevantFields1.length} field(s) from base to source`, debug);
  nvdebug(`Moved ${relevantFields2.length} field(s) from source to base`, debug);
}

export function filterOperation(base, source, operation) {
  if (operation.skip) {
    // Log?
    return;
  }
  const targetRecords = getTargetRecordsForOperation(base, source, operation);

  if (targetRecords.length === 0) {
    nvdebug('Failed to get the target record');
    return;
  }

  targetRecords.forEach(targetRecord => processOperationForTargetRecord(targetRecord, operation));

  function processOperationForTargetRecord(targetRecord, operation) {
    const targetFields = getSpecifiedFieldsAndFilterThem(targetRecord, operation.fieldSpecification);

    if (!targetFields) {
      nvdebug(' No target fields found');
      return;
    }

    if (operation.requireBaseField) {
      const baseFields = getSpecifiedFieldsAndFilterThem(base, operation.requireBaseField);
      if (baseFields.length === 0) {
        //nvdebug(' Required base field not found!');
        return;
      }
      nvdebug(` Base field ${fieldToString(baseFields[0])}`);
    }

    /*
    if (operation.requireOtherField) {
      // Does base === targetRecord work or do I need to clone this?
      const otherFields = getSpecifiedFieldsAndFilterThem(base === targetRecord ? source : base, operation.requireOtherField);
    }
    */

    const otherRecord = operation.operation === 'swapFields' ? source : undefined;
    performActualOperation(targetRecord, operation, otherRecord);
  }

  function performActualOperation(targetRecord, operation, otherRecord) {
    if (!operation.operation) {
      nvdebug('No operation defined');
      return;
    }

    //nvdebug(`current operation: ${operation.operation}, ${operation.comment ? operation.comment : 'no comment'}`);
    if (operation.operation === 'removeField') {
      operationRemoveField(targetRecord, operation.fieldSpecification);
      return;
    }
    if (operation.operation === 'removeSubfield') {
      operationRemoveSubfield(targetRecord, operation.fieldSpecification, operation.deletableSubfieldFilter);
      return;
    }
    if (operation.operation === 'renameSubfield') {
      operationRenameSubfield(targetRecord, operation.fieldSpecification, operation.renamableSubfieldFilter);
      return;
    }
    if (operation.operation === 'retag') {
      operationRetag(targetRecord, operation.fieldSpecification, operation.newTag);
      return;
    }
    if (operation.operation === 'swapFields') {
      operationSwapFields(targetRecord, otherRecord, operation.fieldSpecification);
      return;
    }
    nvdebug(`Illegal/unknown operation: '${operation.operation}' skipped`);
  }
}


export function filterOperations(base, source, config) {
  config.forEach(operation => filterOperation(base, source, operation));
}


export function preprocessBeforeAdd(base, source, preprocessorDirectives) {
  // nvdebug(`PPBA ${JSON.stringify(preprocessorDirectives)}`);
  if (!preprocessorDirectives || !(preprocessorDirectives instanceof Array)) {
    return;
  }

  filterOperations(base, source, preprocessorDirectives);
}
