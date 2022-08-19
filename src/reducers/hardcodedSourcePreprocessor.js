
//import fieldExclusion from '@natlibfi/marc-record-validators-melinda/dist/field-exclusion';
//import subfieldExclusion from '@natlibfi/marc-record-validators-melinda/dist/subfield-exclusion';
import isbnIssn from '@natlibfi/marc-record-validators-melinda/dist/isbn-issn';
import {fieldRenameSubfieldCodes, fieldToString, nvdebug, recordReplaceField, stringToRegex} from './utils.js';
import {sortAdjacentSubfields} from './sortSubfields';

import createDebugLogger from 'debug';
//import {MarcRecord} from '@natlibfi/marc-record';
//import {/*fieldToString,*/ nvdebug} from './utils';
//import {initFieldMergeConfig} from './fieldMergeConfig';

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
      nvdebug(`TAG Regexp: /${fieldSpecs.tagPattern}/`);
      return new RegExp(`${fieldSpecs.tagPattern}`, 'u');
    }
    if (fieldSpecs.tag) {
      nvdebug(`TAG Regexp: /^${fieldSpecs.tag}$/`);
      return new RegExp(`^${fieldSpecs.tag}$`, 'u');
    }
    nvdebug(`TAG Regexp: NULL`);
    return null;
  }
}

function subfieldFilterMatches(subfield, subfieldFilter) {
  if (subfieldFilter.code) { // Should we offer regexp as well?
    if (subfieldFilter.code !== subfield.code) {
      nvdebug(` REJECTED SUBFIELD. Reason: code`);
      return false;
    }
  }

  if (subfieldFilter.valuePattern) {
    const valueRegExp = RegExp(`${subfieldFilter.valuePattern}`, 'u');
    if (!subfield.value.match(valueRegExp)) {
      nvdebug(` REJECTED SUBFIELD. Reason: value regexp`);
      return false;
    }
  }

  if (subfieldFilter.value) { // eg. 041$a 'zxx' removal
    if (subfield.value !== subfieldFilter.value) {
      nvdebug(` REJECTED SUBFIELD. Reason: value string`);
      return false;
    }
  }

  nvdebug(` SUBFIELD ACCEPTED $${subfield.code} ${subfield.value}`);
  return true;
}

function subfieldsFilterMatches(subfields, subfieldFilter) {
  // Sanity check
  if (!subfields) {
    return false;
  }

  // If missingCode is found, filter fails. Eg. we might want to keep only those 830 fields that have $x.
  if (subfieldFilter.missingCode) {
    if (subfields.some(sf => sf.code === subfieldFilter.missingCode)) {
      return false;
    }
  }

  const matchingSubfields = subfields.filter(sf => subfieldFilterMatches(sf, subfieldFilter));

  return matchingSubfields.length > 0;
}


// Each subfield filter matches the field...
function subfieldFiltersMatch(field, subfieldFilters) {
  return subfieldFilters.every(subfieldFilter => subfieldsFilterMatches(field.subfields, subfieldFilter));
}


function filterFields(fields, subfieldFilters) {
  if (!subfieldFilters) {
    return fields;
  }

  return fields.filter(field => subfieldFiltersMatch(field, subfieldFilters));
}

function getSpecifiedFieldsAndFilterThem(record, fieldSpecs) {
  const targetFields = getSpecifiedFields(record, fieldSpecs);
  nvdebug(`Got ${targetFields.length} fields. Filter them...`);
  const filteredFields = filterFields(targetFields, fieldSpecs.subfieldFilters);
  nvdebug(`${filteredFields.length} field(s) remain after filtering...`);
  return filteredFields;
}


function getTargetRecordForOperation(base, source, recordType) {
  if (recordType === 'base') {
    nvdebug('Filter applies to BASE record');
    return base;
  }
  if (recordType === 'source') {
    nvdebug('Filter applies to SOURCE record');
    return source;
  }
  // Log warning/error here
  nvdebug('ERROR: no record for filter!');
  return null;
}

function operationRemoveField(record, fieldSpecification) {
  const deletableFields = getSpecifiedFieldsAndFilterThem(record, fieldSpecification);
  nvdebug(`operationRemoveField got ${deletableFields.length} deletable field(s)`);
  deletableFields.forEach(field => record.removeField(field));
}

function operationRenameSubfield(record, fieldSpecification, renamableSubfieldFilter) {
  const relevantFields = getSpecifiedFieldsAndFilterThem(record, fieldSpecification);
  nvdebug(`operationRemoveSubfield() got ${relevantFields.length} field(s)`);
  relevantFields.forEach(field => {
    /* const newField = */ renameSubfields(field, renamableSubfieldFilter);

    /*
    if (0 && newField && newField.subfields.length) { // eslint-disable-line functional/no-conditional-statement
      recordReplaceField(record, field, newField);
    }
    */
  });

  function renameSubfields(field, deletableSubfieldFilter) {
    nvdebug(`Try to rename subfields from ${fieldToString(field)} using ${JSON.stringify(deletableSubfieldFilter)}`);
    field.subfields.forEach(sf => {
      if (subfieldFilterMatches(sf, renamableSubfieldFilter)) { // eslint-disable-line functional/no-conditional-statement
        sf.code = renamableSubfieldFilter.newCode; // eslint-disable-line functional/immutable-data
      }
    });
  }
}

function operationRemoveSubfield(record, fieldSpecification, deletableSubfieldFilter) {
  const relevantFields = getSpecifiedFieldsAndFilterThem(record, fieldSpecification);
  nvdebug(`operationRemoveSubfield() got ${relevantFields.length} field(s)`);
  relevantFields.forEach(field => {
    const newField = removeSubfields(field, deletableSubfieldFilter);
    if (newField.subfields.length === 0) { // eslint-disable-line functional/no-conditional-statement
      nvdebug('Delete subfieldless field');
      record.removeField(field);
    }
    if (newField.subfields.length) { // eslint-disable-line functional/no-conditional-statement
      recordReplaceField(record, field, newField);
    }
  });

  function removeSubfields(field, deletableSubfieldFilter) {
    nvdebug(`Try to remove subfields from ${fieldToString(field)} using ${JSON.stringify(deletableSubfieldFilter)}`);
    const deletableSubfields = field.subfields.filter(sf => subfieldFilterMatches(sf, deletableSubfieldFilter));
    nvdebug(` Got ${deletableSubfields.length}/${field.subfields.length} deletable subfield(s)`);
    field.subfields = field.subfields.filter(sf => deletableSubfields.every(dsf => dsf !== sf)); // eslint-disable-line functional/immutable-data
    nvdebug(` ${field.subfields.length} subfield(s) remain in the field`);

    return field;
  }
}

function operationRetag(record, fieldSpecification, newTag) {
  const relevantFields = getSpecifiedFieldsAndFilterThem(record, fieldSpecification);
  relevantFields.forEach(field => {
    field.tag = newTag; // eslint-disable-line functional/immutable-data
  });
}

function filterOperation(base, source, operation) {
  const targetRecord = getTargetRecordForOperation(base, source, operation.recordType);

  if (!targetRecord) {
    nvdebug('Failed to get the target record');
    return;
  }

  const targetFields = getSpecifiedFieldsAndFilterThem(targetRecord, operation.fieldSpecification);

  if (!targetFields) {
    nvdebug(' No target fields found');
    return;
  }

  if (operation.requireBaseField) {
    const baseFields = getSpecifiedFieldsAndFilterThem(base, operation.requireBaseField);
    if (baseFields.length === 0) {
      nvdebug(' Required base field not found!');
      return;
    }
  }

  actualOperation(operation);

  function actualOperation(operation) {
    if (!operation.operation) {
      nvdebug('No operation defined');
      return;
    }

    nvdebug(`current operation: ${operation.operation}`);
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
    nvdebug(`Illegal operation: '${operation}.operation`);
  }
}


export default (config = []) => (base, source) => {
  filterOperations(base, source, config);

  return [base, externalFixes(source, config)];

  function filterOperations(base, source, config) {
    config.forEach(operation => filterOperation(base, source, operation));
  }

  function externalFixes(record, config) {


    //externalFieldsPresent(record, [/^336$/u, /^337$/u], true); // Comps don't always have 338
    //await FieldsPresent([/^336$/u, /^337$/u, /^338$/u]), // Comps don't always have 338

    /*
    const fieldExcluder = fieldExclusion([
      // /^(001|091|092|093|094|095|256|533|574|575|576|577|578|599)$/,
      //{tag: /^264$/, subfields: [{code: /^a$/, value: /^\[.*\]$/}]}, // Not sure about this either
      //{tag: /^650$/, subfields: [{code: /^a$/, value: /^overdrive$/i}]}, // Not sure what this is
      //{tag: /^041$/u, dependencies: [{leader: /^.{6}[g|i]/u}]},
      {tag: /^(?:648|650|651|655)$/u, subfields: [{code: /^2$/u, value: /^(?:ysa|musa|allars|cilla)$/u}]}
    ]);

    fieldExcluder.fix(record);
    */

    /*
    const subfieldExcluder = subfieldExclusion([
      {tag: /^041$/u, subfields: [{code: /^[ad]$/u, value: /^zxx$/u}]},
      {tag: /^02[04]$/u, subfields: [{code: /^c$/u, value: /^.*(?:€|£|\$|FIM).*$/u}]} // price info
    ]);

    subfieldExcluder.fix(record);
    */

    // Not sure whether this should be done, or should we normalize ISBNs during comparison.
    const addHyphensToISBN = isbnIssn({hyphenateISBN: true});
    addHyphensToISBN.fix(record);

    /*
    await EmptyFields(),
    await IsbnIssn({hyphenateISBN: true}),
    await SubfieldExclusion([
      {tag: /^041$/u, subfields: [{code: /^[ad]$/u, value: /^zxx$/u}]},
      {tag: /^02[04]$/u, subfields: [{code: /^c$/u, value: /^.*(?:€|£|\$|FIM).*$/u}]} // price info
    ]),
    //await FieldStructure([{tag: /^007$/u, dependencies: [{leader: /^.{6}[^at]/u}]}]),
    await Punctuation(),
    await EndingPunctuation()
    */

    //const max6 = getMaxSubfield6(baseRecord);
    //const max8 = getMaxSubfield8(baseRecord);
    //nvdebug(`MAX8 FROM BASE: ${max8}`);
    //reindexSubfield6s(sourceRecord, max6);
    //reindexSubfield8s(sourceRecord, max8);


    /*
    // Base has 1XX fields. Retag source's 1XX fields
    retagSources1XXFields(record);

    function retagSources1XXFields(record) {
      const source1XX = record.get(/^1..$/u);
      source1XX.forEach(field => {
        const newTag = `7${field.tag.substring(1)}`;
        //nvdebug(`Retag ${field.tag} => ${newTag}`);
        field.tag = newTag; // eslint-disable-line functional/immutable-data
      });
    }
    */

    record.fields.forEach(field => swapIncomingSubfieldCodes(field, config));

    return record;
  }
};


const defaultSwapSubfieldCodes = [{'tagPattern': '^040$', 'from': 'a', 'to': 'd'}];


function swapIncomingSubfieldCodes(field, config) {
  const swapSubfieldCodes = config.swapSubfieldCodes ? config.swapSubfieldCodes : defaultSwapSubfieldCodes;
  nvdebug(`SWAPS: ${JSON.stringify(swapSubfieldCodes)}`, debug);
  swapSubfieldCodes.forEach((rule) => applyRule(field, rule));

  function applyRule(field, rule) {
    if (!field.tag.match(stringToRegex(rule.tagPattern))) {
      return; // don't apply
    }
    fieldRenameSubfieldCodes(field, rule.from, rule.to);
    // Since subfields were sorted, they may be in the wrong order now:
    sortAdjacentSubfields(field);
    return;
  }

}
