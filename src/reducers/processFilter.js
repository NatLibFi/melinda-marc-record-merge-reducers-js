

import {fieldToString, nvdebug} from './utils.js';
import {getEncodingLevel} from '@natlibfi/marc-record-validators-melinda';

import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:processFilter');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

// fieldSpecs
// - tagPattern (eg. '^(123|456)$' or
// - tag (eg '123')
// - containsSubfields (array)
//   - code
//   - valuePattern or value

function getSpecifiedFields(record, fieldSpecs) {
  const regexp = regexpifyFieldSpecs(fieldSpecs);
  if (regexp) {
    const fieldsByTag = record.get(regexp);
    return fieldsByTag.filter(f => skipByIndicator(f));
  }
  return [];

  function regexpifyFieldSpecs(fieldSpecs) {
    if (fieldSpecs.tagPattern) {
      //nvdebug(`Tag pattern to regexp: /${fieldSpecs.tagPattern}/`, debugDev);
      return new RegExp(`${fieldSpecs.tagPattern}`, 'u');
    }
    if (fieldSpecs.tag) {
      //nvdebug(`Tag to egexp: /^${fieldSpecs.tag}$/`, debugDev);
      return new RegExp(`^${fieldSpecs.tag}$`, 'u');
    }
    nvdebug(`TAG Regexp: NULL`, debugDev);
    return null;
  }

  function skipByIndicator(field) {
    if ('ind1' in fieldSpecs && fieldSpecs.ind1 !== field.ind1) {
      return false;
    }
    if ('ind2' in fieldSpecs && fieldSpecs.ind2 !== field.ind2) {
      return false;
    }
    return true;
  }
}


function subfieldFilterMatchesCode(subfieldCode, filterCode = undefined, filterCodePattern = undefined) {
  // Check subfield code as a string:
  if (filterCode) {
    if (filterCode !== subfieldCode) {
      //nvdebug(` REJECTED SUBFIELD. Reason: code`, debugDev);
      return false;
    }
  }

  if (filterCodePattern) {
    const regExp = RegExp(`${filterCodePattern}`, 'u');
    if (!subfieldCode.match(regExp)) {
      //nvdebug(` REJECTED SUBFIELD. Reason: code regexp`, debugDev);
      return false;
    }
  }

  return true;
}

function subfieldFilterMatchesValue(subfieldValue, targetValue, targetValuePattern) {
  if (targetValuePattern) {
    const valueRegExp = RegExp(`${targetValuePattern}`, 'u');
    if (!subfieldValue.match(valueRegExp)) {
      //nvdebug(` REJECTED SUBFIELD. Reason: value regexp`, debugDev);
      return false;
    }
  }

  if (targetValue) { // eg. 041$a 'zxx' removal
    if (subfieldValue !== targetValue) {
      //nvdebug(` REJECTED SUBFIELD. Reason: value string`, debugDev);
      return false;
    }
  }
  return true;
}

function subfieldFilterMatches(subfield, subfieldFilter) {
  //nvdebug(`SF ${JSON.stringify(subfieldFilter)}`, debugDev);

  if (!subfieldFilterMatchesCode(subfield.code, subfieldFilter.code, subfieldFilter.codePattern)) {
    return false;
  }

  if (!subfieldFilterMatchesValue(subfield.value, subfieldFilter.value, subfieldFilter.valuePattern)) {
    return false;
  }

  //nvdebug(` SUBFIELD ACCEPTED $${subfield.code} ${subfield.value}`, debugDev);
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
  nvdebug(`Looking for value '${value}'`, debugDev);
  return fields.filter(field => {
    nvdebug(`              got '${fieldToString(field)}'`, debugDev);
    return fieldToString(field) === value;
  });
}

function hasValidEncodingLevel(record, fieldSpecs) {
  if (!fieldSpecs.encodingLevel) {
    return true;
  }
  const recordEncodingLevel = getEncodingLevel(record);
  //nvdebug(`ENC: ${recordEncodingLevel} in [${fieldSpecs.encodingLevel.join('')}]?`);
  return fieldSpecs.encodingLevel.includes(recordEncodingLevel);
}

function getSpecifiedFieldsAndFilterThem(record, fieldSpecs) {
  if (!hasValidEncodingLevel(record, fieldSpecs)) {
    return [];
  }

  const targetFields = getSpecifiedFields(record, fieldSpecs);
  //nvdebug(`Got ${targetFields.length} fields. Filter them...`, debugDev);
  if (targetFields.length === 0) {
    return targetFields;
  }

  const filteredFields1 = filterFieldsUsingSubfieldFilters(targetFields, fieldSpecs.subfieldFilters);
  //nvdebug(`${filteredFields1.length} field(s) remain after subfield filters...`, debugDev);
  const filteredFields2 = filterFieldsUsingFieldToString(filteredFields1, fieldSpecs.value);
  //nvdebug(`${filteredFields2.length} field(s) remain after whole value filtering...`, debugDev);
  return filteredFields2;
}

/*
function logRecordType(recordType) {
  if (['base', 'both', 'source'].includes(recordType)) {
    nvdebug(`Filter applies to record type ${recordType.toUpperCase()}`, debugDev);
    return;
  }
  // Log warning/error here
  nvdebug(`ERROR: record type ${recordType} is not defined!`, debugDev);
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
  //nvdebug(`operationRemoveField got ${deletableFields.length} deletable field(s)`, debugDev);
  deletableFields.forEach(field => {
    nvdebug(`  DELETE FIELD: ${fieldToString(field)}`, debugDev);
    record.removeField(field);
  });
}

function operationRenameSubfield(record, fieldSpecification, renamableSubfieldFilter) {
  const relevantFields = getSpecifiedFieldsAndFilterThem(record, fieldSpecification);
  nvdebug(`operationRenameSubfield() got ${relevantFields.length} field(s)`, debugDev);
  relevantFields.forEach(field => {
    renameSubfields(field, renamableSubfieldFilter);
  });

  function renameSubfields(field, renamableSubfieldFilter) {
    nvdebug(`Try to rename subfields from ${fieldToString(field)} using ${JSON.stringify(renamableSubfieldFilter)}`, debugDev);
    field.subfields.forEach(sf => {
      if (subfieldFilterMatches(sf, renamableSubfieldFilter)) {
        sf.code = renamableSubfieldFilter.newCode;
      }
    });
  }
}

function operationRemoveSubfield(record, fieldSpecification, deletableSubfieldFilter) {
  const relevantFields = getSpecifiedFieldsAndFilterThem(record, fieldSpecification);
  if (relevantFields.length === 0) {
    return;
  }
  nvdebug(`operationRemoveSubfield() got ${relevantFields.length} field(s)`, debugDev);
  relevantFields.forEach(field => {
    nvdebug(`Try to remove subfields from ${fieldToString(field)} using ${JSON.stringify(deletableSubfieldFilter)}`, debugDev);
    const remainingSubfields = field.subfields.filter(sf => !subfieldFilterMatches(sf, deletableSubfieldFilter));
    if (remainingSubfields.length < field.subfields.length) {
      nvdebug(` Got ${remainingSubfields.length}/${field.subfields.length} keepable subfield(s)`, debugDev);
      // Delete the whole field as last subfield gets deleted:
      if (remainingSubfields.length === 0) {
        nvdebug('Delete subfieldless field', debugDev);
        record.removeField(field);
        return;
      }

      field.subfields = remainingSubfields;
      return;
    }
  });
}

function operationSwapFields(record, otherRecord, fieldSpecification) {
  const relevantFields1 = getSpecifiedFieldsAndFilterThem(record, fieldSpecification);
  const relevantFields2 = getSpecifiedFieldsAndFilterThem(otherRecord, fieldSpecification);

  relevantFields1.forEach(field => record.removeField(field));
  relevantFields2.forEach(field => otherRecord.removeField(field));

  relevantFields1.forEach(field => otherRecord.insertField(field));
  relevantFields2.forEach(field => record.insertField(field));

  nvdebug(`Moved ${relevantFields1.length} field(s) from base to source`, debugDev);
  nvdebug(`Moved ${relevantFields2.length} field(s) from source to base`, debugDev);
}

export function filterOperation(base, source, operation, internal = false) {
  if (operation.skip) {
    nvdebug(`filterOps: ${operation.comment ? operation.comment : 'NIMETÖN'} SKIPPED: operation.skip: ${operation.skip}`, debugDev);
    return;
  }

  // If we are running internal merge and our operation is internal: false, skip operation
  if (internal !== undefined && internal && operation.internal === false) {
    nvdebug(`filterOps: ${operation.comment ? operation.comment : 'NIMETÖN'} SKIPPED: internal: ${internal}, operation.internal: ${operation.internal}`, debugDev);
    return;
  }

  const targetRecords = getTargetRecordsForOperation(base, source, operation);
  //nvdebug(`filterOps: ${operation.comment ? operation.comment : 'NIMETÖN'}`);
  if (targetRecords.length === 0) {
    nvdebug('Failed to get the target record', debugDev);
    return;
  }

  targetRecords.forEach(targetRecord => processOperationForTargetRecord(targetRecord, operation));

  function processOperationForTargetRecord(targetRecord, operation) {
    if (operation.encodingLevel && !operation.encodingLevel.includes(getEncodingLevel(targetRecord))) {
      //nvdebug(' Skip. Reason: encoding level', debugDev);
      return;
    }

    const targetFields = getSpecifiedFieldsAndFilterThem(targetRecord, operation.fieldSpecification);

    if (!targetFields) {
      //nvdebug(' No target fields found', debugDev);
      return;
    }

    if (operation.requireBaseField) {
      const baseFields = getSpecifiedFieldsAndFilterThem(base, operation.requireBaseField);
      if (baseFields.length === 0) {
        //nvdebug(' Required base field not found!', debugDev);
        return;
      }
      //nvdebug(` Base field ${fieldToString(baseFields[0])}`, debugDev);
    }

    if (operation.requireSourceField) {
      const sourceFields = getSpecifiedFieldsAndFilterThem(source, operation.requireSourceField);
      if (sourceFields.length === 0) {
        //nvdebug(' Required source field not found!', debugDev);
        return;
      }
      //nvdebug(` Base field ${fieldToString(baseFields[0])}`, debugDev);
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
    //nvdebug(' PERFORM OP');
    if (!operation.operation) {
      nvdebug('No operation defined', debugDev);
      return;
    }

    //nvdebug(`current operation: ${operation.operation}, ${operation.comment ? operation.comment : 'no comment'}`, debugDev);
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
    if (operation.operation === 'swapFields') {
      operationSwapFields(targetRecord, otherRecord, operation.fieldSpecification);
      return;
    }
    nvdebug(`Illegal/unknown operation: '${operation.operation}' skipped`, debugDev);
  }
}


export function filterOperations(base, source, config, internal = false) {
  config.forEach(operation => filterOperation(base, source, operation, internal));
}


export function preprocessBeforeAdd(base, source, preprocessorDirectives, internal) {
  // nvdebug(`PPBA ${JSON.stringify(preprocessorDirectives)}`, debugDev);
  if (!preprocessorDirectives || !(preprocessorDirectives instanceof Array)) {
    return;
  }

  filterOperations(base, source, preprocessorDirectives, internal);
}
