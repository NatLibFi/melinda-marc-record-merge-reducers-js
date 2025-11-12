

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

function getSpecifiedFields(record, fieldSpecs, recordLabel = '') {
  const regexp = regexpifyFieldSpecs(fieldSpecs, recordLabel);
  if (regexp) {
    const fieldsByTag = record.get(regexp);
    return fieldsByTag.filter(f => skipByIndicator(f));
  }
  return [];

  function regexpifyFieldSpecs(fieldSpecs, recordLabel = '') {
    if (fieldSpecs.tagPattern) {
      //nvdebug(`Tag pattern to regexp: /${fieldSpecs.tagPattern}/`, debugDev);
      return new RegExp(`${fieldSpecs.tagPattern}`, 'u');
    }
    if (fieldSpecs.tag) {
      //nvdebug(`Tag to egexp: /^${fieldSpecs.tag}$/`, debugDev);
      return new RegExp(`^${fieldSpecs.tag}$`, 'u');
    }
    nvdebug(`${recordLabel} TAG Regexp: NULL`, debugDev);
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


function subfieldFilterMatchesCode(subfieldCode, filterCode = undefined, filterCodePattern = undefined, recordLabel = '') {
  // Check subfield code as a string:
  if (filterCode) {
    if (filterCode !== subfieldCode) {
      nvdebug(` ${recordLabel} REJECTED SUBFIELD. Reason: code`, debugDev);
      return false;
    }
  }

  if (filterCodePattern) {
    const regExp = RegExp(`${filterCodePattern}`, 'u');
    if (!subfieldCode.match(regExp)) {
      nvdebug(` ${recordLabel} REJECTED SUBFIELD. Reason: code regexp`, debugDev);
      return false;
    }
  }

  return true;
}

function subfieldFilterMatchesValue(subfieldValue, targetValue, targetValuePattern, recordLabel = '') {
  if (targetValuePattern) {
    const valueRegExp = RegExp(`${targetValuePattern}`, 'u');
    if (!subfieldValue.match(valueRegExp)) {
      nvdebug(` ${recordLabel} REJECTED SUBFIELD. Reason: value regexp`, debugDev);
      return false;
    }
  }

  if (targetValue) { // eg. 041$a 'zxx' removal
    if (subfieldValue !== targetValue) {
      nvdebug(` ${recordLabel} REJECTED SUBFIELD. Reason: value string`, debugDev);
      return false;
    }
  }
  return true;
}

function subfieldFilterMatches(subfield, subfieldFilter, recordLabel = '') {
  nvdebug(` ${recordLabel} SF ${JSON.stringify(subfieldFilter)}`, debugDev);

  if (!subfieldFilterMatchesCode(subfield.code, subfieldFilter.code, subfieldFilter.codePattern, recordLabel)) {
    return false;
  }

  if (!subfieldFilterMatchesValue(subfield.value, subfieldFilter.value, subfieldFilter.valuePattern, recordLabel)) {
    return false;
  }

  nvdebug(` ${recordLabel} SUBFIELD ACCEPTED $${subfield.code} ${subfield.value}`, debugDev);
  return true;
}

function subfieldFilterUnwantedMatches(subfield, subfieldFilter, recordLabel = '') {
  if (!subfieldFilter.missingCode) {
    return false;
  }
  if (!subfieldFilterMatchesCode(subfield.code, subfieldFilter.missingCode, subfieldFilter.missingCodePattern, recordLabel)) {
    return false;
  }
  if (!subfieldFilterMatchesValue(subfield.value, subfieldFilter.value, subfieldFilter.valuePattern, recordLabel)) {
    return false;
  }
  return true;
}

function subfieldsFilterMatches(subfields, subfieldFilter, recordLabel = '') { // Field-level filter check
  // Sanity check:
  if (!subfields) {
    return false;
  }

  if (!getMatches(subfields, subfieldFilter, recordLabel)) {
    return false;
  }

  return !getNegativeMatches(subfields, subfieldFilter, recordLabel);

  function getMatches(subfields, subfieldFilter, recordLabel = '') {
    const matchingSubfields = subfields.filter(sf => subfieldFilterMatches(sf, subfieldFilter, recordLabel));
    return matchingSubfields.length > 0;
  }

  function getNegativeMatches(subfields, subfieldFilter, recordLabel = '') {
    const matchingSubfields = subfields.filter(sf => subfieldFilterUnwantedMatches(sf, subfieldFilter, recordLabel));
    return matchingSubfields.length > 0;
  }
}


// Each subfield filter matches the field...
function subfieldFiltersMatch(field, subfieldFilters, recordLabel = '') {

  return subfieldFilters.every(subfieldFilter => subfieldsFilterMatches(field.subfields, subfieldFilter, recordLabel));
}


function filterFieldsUsingSubfieldFilters(fields, subfieldFilters, recordLabel = '') {
  if (!subfieldFilters) {
    return fields;
  }
  return fields.filter(field => subfieldFiltersMatch(field, subfieldFilters, recordLabel));
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

function hasValidEncodingLevel(record, fieldSpecs, recordLabel = '') {
  if (!fieldSpecs.encodingLevel) {
    return true;
  }
  const recordEncodingLevel = getEncodingLevel(record);
  //nvdebug(`${recordLabel} ENC: ${recordEncodingLevel} in [${fieldSpecs.encodingLevel.join('')}]?`);
  return fieldSpecs.encodingLevel.includes(recordEncodingLevel);
}

function getSpecifiedFieldsAndFilterThem(record, fieldSpecs, recordLabel = '') {
  if (!hasValidEncodingLevel(record, fieldSpecs)) {
    return [];
  }

  const targetFields = getSpecifiedFields(record, fieldSpecs);
  //nvdebug(`${recordLabel} Got ${targetFields.length} fields. Filter them...`, debugDev);
  if (targetFields.length === 0) {
    return targetFields;
  }

  const filteredFields1 = filterFieldsUsingSubfieldFilters(targetFields, fieldSpecs.subfieldFilters, recordLabel);
  //nvdebug(`${filteredFields1.length} field(s) remain after subfield filters...`, debugDev);
  const filteredFields2 = filterFieldsUsingFieldToString(filteredFields1, fieldSpecs.value, recordLabel);
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
  debugDev(`recordType: ${recordType}`)
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

function operationRemoveField(record, fieldSpecification, recordLabel = 'x') {
  const deletableFields = getSpecifiedFieldsAndFilterThem(record, fieldSpecification, recordLabel);
  if (deletableFields.length === 0) {
    return;
  }
  //nvdebug(`operationRemoveField got ${deletableFields.length} deletable field(s)`, debugDev);
  deletableFields.forEach(field => {
    nvdebug(` ${recordLabel} DELETE FIELD: ${fieldToString(field)}`, debugDev);
    record.removeField(field);
  });
}

function operationRenameSubfield(record, fieldSpecification, renamableSubfieldFilter, recordLabel = 'x') {
  const relevantFields = getSpecifiedFieldsAndFilterThem(record, fieldSpecification, recordLabel);
  nvdebug(`${recordLabel} operationRenameSubfield() got ${relevantFields.length} field(s)`, debugDev);
  relevantFields.forEach(field => {
    renameSubfields(field, renamableSubfieldFilter, recordLabel);
  });

  function renameSubfields(field, renamableSubfieldFilter, recordLabel = 'x') {
    nvdebug(`${recordLabel}. Try to rename subfields from ${fieldToString(field)} using ${JSON.stringify(renamableSubfieldFilter)}`, debugDev);
    field.subfields.forEach(sf => {
      nvdebug(`${recordLabel}. Handle subfield ${JSON.stringify(sf)}`, debugDev);
      if (subfieldFilterMatches(sf, renamableSubfieldFilter, recordLabel)) {
        nvdebug(`${recordLabel}. --- MATCH in${JSON.stringify(sf)}`, debugDev);
        sf.code = renamableSubfieldFilter.newCode;
        return;
       }
      nvdebug(`${recordLabel}. --- NO MATCH in${JSON.stringify(sf)}`, debugDev);
    });
  }
}

function operationRemoveSubfield(record, fieldSpecification, deletableSubfieldFilter, recordLabel = 'x') {
  const relevantFields = getSpecifiedFieldsAndFilterThem(record, fieldSpecification, recordLabel);
  if (relevantFields.length === 0) {
    return;
  }
  nvdebug(`${recordLabel}. operationRemoveSubfield() got ${relevantFields.length} field(s)`, debugDev);
  relevantFields.forEach(field => {
    nvdebug(`${recordLabel}. Try to remove subfields from ${fieldToString(field)} using ${JSON.stringify(deletableSubfieldFilter)}`, debugDev);
    const remainingSubfields = field.subfields.filter(sf => !subfieldFilterMatches(sf, deletableSubfieldFilter, recordLabel));
    if (remainingSubfields.length < field.subfields.length) {
      nvdebug(` ${recordLabel}. Got ${remainingSubfields.length}/${field.subfields.length} keepable subfield(s)`, debugDev);
      // Delete the whole field as last subfield gets deleted:
      if (remainingSubfields.length === 0) {
        nvdebug(`${recordLabel}. Delete subfieldless field`, debugDev);
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
    nvdebug(`filterOps: ${JSON.stringify(operation)}`, debugDev);
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
  nvdebug(`filterOps: ${operation.comment ? operation.comment : 'NIMETÖN'}`);
  if (targetRecords.length === 0) {
    nvdebug('Failed to get the target record', debugDev);
    return;
  }
  nvdebug(`filterOps for ${targetRecords.length} records`, debugDev);

  targetRecords.forEach((targetRecord, index) => processOperationForTargetRecord(targetRecord, operation, `Rec-${index}`));

  function processOperationForTargetRecord(targetRecord, operation, recordLabel = 'x') {
    if (operation.encodingLevel && !operation.encodingLevel.includes(getEncodingLevel(targetRecord))) {
      //nvdebug(' Skip. Reason: encoding level', debugDev);
      return;
    }
    
    nvdebug(`Handling ${recordLabel}`, debugDev);

    const targetFields = getSpecifiedFieldsAndFilterThem(targetRecord, operation.fieldSpecification, recordLabel);

    if (!targetFields) {
      //nvdebug(' No target fields found', debugDev);
      return;
    }

    if (operation.requireBaseField) {
      const baseFields = getSpecifiedFieldsAndFilterThem(base, operation.requireBaseField, recordLabel);
      if (baseFields.length === 0) {
        //nvdebug(' Required base field not found!', debugDev);
        return;
      }
      //nvdebug(` Base field ${fieldToString(baseFields[0])}`, debugDev);
    }

    if (operation.requireSourceField) {
      const sourceFields = getSpecifiedFieldsAndFilterThem(source, operation.requireSourceField, recordLabel);
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
    performActualOperation(targetRecord, operation, otherRecord, recordLabel);
  }

  function performActualOperation(targetRecord, operation, otherRecord, recordLabel = 'x') {
    nvdebug(` PERFORM OP: ${operation.comment ? operation.comment : `NIMETÖN`} for ${recordLabel}`, debugDev);
    if (!operation.operation) {
      nvdebug('No operation defined', debugDev);
      return;
    }

    //nvdebug(`current operation: ${operation.operation}, ${operation.comment ? operation.comment : 'no comment'}`, debugDev);
    if (operation.operation === 'removeField') {
      operationRemoveField(targetRecord, operation.fieldSpecification, recordLabel);
      return;
    }
    if (operation.operation === 'removeSubfield') {
      operationRemoveSubfield(targetRecord, operation.fieldSpecification, operation.deletableSubfieldFilter, recordLabel);
      return;
    }
    if (operation.operation === 'renameSubfield') {
      operationRenameSubfield(targetRecord, operation.fieldSpecification, operation.renamableSubfieldFilter, recordLabel);
      return;
    }
    if (operation.operation === 'swapFields') {
      operationSwapFields(targetRecord, otherRecord, operation.fieldSpecification, recordLabel);
      return;
    }
    nvdebug(`Illegal/unknown operation: '${operation.operation}' skipped for record ${recordLabel}`, debugDev);
  }
}


export function filterOperations(base, source, config, internal = false) {
  config.forEach(operation => filterOperation(base, source, operation, internal));
}


export function preprocessBeforeAdd(base, source, preprocessorDirectives, internal) {
  debug(`**** PPBA ****`);
  // nvdebug(`PPBA ${JSON.stringify(preprocessorDirectives)}`, debugDev);
  if (!preprocessorDirectives || !(preprocessorDirectives instanceof Array)) {
    return;
  }

  filterOperations(base, source, preprocessorDirectives, internal);
}
