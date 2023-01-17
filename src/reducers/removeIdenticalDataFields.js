import createDebugLogger from 'debug';
import {getSubfield8IndexAsString} from './reindexSubfield8';
import {fieldGetSubfield6Pair, isValidSubfield6} from './subfield6Utils';
//import {MarcRecord} from '@natlibfi/marc-record';
import {/*fieldToString,*/ fieldToString, nvdebug} from './utils';

// NB! It this file 'common' means 'normal' not 'identical'
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
//const debugData = debug.extend('data');
const sf6Regexp = /^[0-9][0-9][0-9]-[0-9][0-9]/u;

// const sf8Regexp = /^([1-9][0-9]*)(?:\.[0-9]+)?(?:\\[acprux])?$/u; // eslint-disable-line prefer-named-capture-group


export default () => (base, source) => {
  // NV: Not actually sure why this is done...
  //const baseRecord = new MarcRecord(base, {subfieldValues: false});
  //const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  //const baseMax = getMaxSubfield6(baseRecord);

  removeSharedDataFieldsFromSource(base, source);

  return {base, source};
};

function removeSharedDataFieldsFromSource(base, source) {
  removeSharedDatafieldsWithSubfield6FromSource(base, source);
  removeSharedDatafieldsWithSubfield8FromSource(base, source);
  removeCommonSharedDataFieldsFromSource(base, source);
}

function isRelevantField6(field) {
  if (!field.subfields || field.tag === '880') {
    return false;
  }
  const sf6s = field.subfields.filter(sf => sf.code === '6' && sf.value.match(sf6Regexp));
  return sf6s.length === 1;
}

function isRelevantField8(field) {
  if (!field.subfields) {
    return false;
  }
  return field.subfields.some(sf => getSubfield8IndexAsString(sf) !== undefined);
}

function isRelevantCommonDataField(field) {
  return field.tag !== '880' && field.subfields && !isRelevantField6(field) && !isRelevantField8(field);
}


function fieldToNormalizedString(field) {
  function subfieldToNormalizedString(sf) {
    if (isValidSubfield6(sf)) {
      // Replace index with XX:
      return `‡${sf.code} ${sf.value.substring(0, 3)}-XX`;
    }
    return `‡${sf.code} ${sf.value}`;
  }

  if ('subfields' in field) {
    return `${field.tag} ${field.ind1}${field.ind2}${formatAndNormalizeSubfields(field)}`;
  }
  return `${field.tag}    ${field.value}`;

  function formatAndNormalizeSubfields(field) {
    return field.subfields.map(sf => ` ${subfieldToNormalizedString(sf)}`).join('');
  }
}

function fieldsToNormalizedString(fields) {
  const strings = fields.map(field => fieldToNormalizedString(field));
  return strings.join('\t__SEPARATOR__\t');
}

function recordGetAllSubfield8Indexes(record) {
  /* eslint-disable */
  let subfield8Values = [];
  record.fields.forEach(field => {
    if (!field.subfields) {
      return;
    }
    field.subfields.forEach(sf => {
      const index = getSubfield8IndexAsString(sf);
      if (index !== undefined && !subfield8Values.includes(index)) {
        nvdebug(`Add subfield \$8 ${index} to seen values list`);
        subfield8Values.push(index);
      }
    });
  });

  return subfield8Values;
  /* eslint-enable */
}

function removeSharedDatafieldsWithSubfield8FromSource(base, source) {
  const baseIndexesToInspect = recordGetAllSubfield8Indexes(base);
  if (baseIndexesToInspect.length === 0) {
    return;
  }
  const sourceIndexesToInspect = recordGetAllSubfield8Indexes(source);
  if (sourceIndexesToInspect.length === 0) {
    return;
  }

  // Steps:
  // 1. for each baseIndex, gather fields + sort fields + convert to string (with anonymisation)
  // 2. for each sourceIndex, gather fields + sort fields + convert to string (with anonymisation)
  //    + match with base + remove if needed

  //const baseFields8 = base.fields.filter(field => isRelevantField8(field)); // Does not get 880 fields

}

function removeSharedDatafieldsWithSubfield6FromSource(base, source) {
  const baseFields6 = base.fields.filter(field => isRelevantField6(field)); // Does not get 880 fields
  const baseFieldsAsString = baseFields6.map(field => pairAndStringify6(field, base));

  const sourceFields6 = source.fields.filter(field => isRelevantField6(field)); // Does not get 880 fields

  sourceFields6.forEach(field => removeSourceField6IfNeeded(field, source, baseFieldsAsString));

  function removeSourceField6IfNeeded(sourceField, sourceRecord, baseFieldsAsString) {
    const sourcePairField = fieldGetSubfield6Pair(sourceField, sourceRecord);
    const sourceString = sourcePairField ? fieldsToNormalizedString([sourceField, sourcePairField]) : fieldToNormalizedString(sourceField);
    nvdebug(`SOURCE: ${sourceString} -- REALITY: ${fieldToString(sourceField)}`);
    const tmp = sourcePairField ? fieldToString(sourcePairField) : 'HUTI';
    nvdebug(`PAIR: ${tmp}`);
    nvdebug(`BASE:   ${baseFieldsAsString.join(' -- ')}`);
    if (!baseFieldsAsString.includes(sourceString)) {
      return;
    }
    sourceRecord.removeField(sourceField);
    if (sourcePairField === undefined) {
      return;
    }
    sourceRecord.removeField(sourcePairField);
  }

  function pairAndStringify6(field, record) {
    const pair6 = fieldGetSubfield6Pair(field, record);
    if (!pair6) {
      return fieldToNormalizedString(field);
    }
    return fieldsToNormalizedString([field, pair6]);
  }


}

function removeCommonSharedDataFieldsFromSource(base, source) {
  const baseFields = base.fields.filter(field => isRelevantCommonDataField(field));
  const sourceFields = source.fields.filter(field => isRelevantCommonDataField(field));
  const baseFieldsAsString = baseFields.map(field => fieldToString(field));

  sourceFields.forEach(field => removeCommonDataFieldIfNeeded(field));

  function removeCommonDataFieldIfNeeded(field) {
    const fieldAsString = fieldToNormalizedString(field);
    if (!baseFieldsAsString.includes(fieldAsString)) {
      return;
    }
    nvdebug(`Remove ${fieldAsString}`, debug);
    source.removeField(field);
  }
}

