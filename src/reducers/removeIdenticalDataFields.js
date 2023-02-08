import createDebugLogger from 'debug';
import {getSubfield8Index, getSubfield8Value, isValidSubfield8} from './reindexSubfield8';
import {fieldGetSubfield6Pair, isValidSubfield6} from './subfield6Utils';
//import {MarcRecord} from '@natlibfi/marc-record';
import {fieldHasNSubfields, fieldToString, nvdebug} from './utils';

// NB! It this file 'common' means 'normal' not 'identical'
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
//const debugData = debug.extend('data');
const sf6Regexp = /^[0-9][0-9][0-9]-[0-9][0-9]/u;

// const sf8Regexp = /^([1-9][0-9]*)(?:\.[0-9]+)?(?:\\[acprux])?$/u; // eslint-disable-line prefer-named-capture-group


export default () => (base, source) => {
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
  return field.subfields.some(sf => getSubfield8Value(sf) !== undefined);
}

function isRelevantCommonDataField(field) {
  return field.tag !== '880' && field.subfields && !isRelevantField6(field) && !isRelevantField8(field);
}


function fieldToNormalizedString(field, currIndex = 0) {
  function subfieldToNormalizedString(sf) {
    if (isValidSubfield6(sf)) {
      // Replace index with XX:
      return `‡${sf.code} ${sf.value.substring(0, 3)}-XX`;
    }
    if (isValidSubfield8(sf)) {
      const index8 = getSubfield8Index(sf);
      if (currIndex === 0 || currIndex === index8) {
        // For $8 we should only XX the index we are looking at...
        const normVal = sf.value.replace(/^[0-9]+/u, 'XX');
        return `‡${sf.code} ${normVal}`;
      }
      return ''; // Other $8 subfields are meaningless in this context
    }
    return `‡${sf.code} ${sf.value}`;
  }

  if ('subfields' in field) {
    return `${field.tag} ${field.ind1}${field.ind2}${formatAndNormalizeSubfields(field)}`;
  }
  return `${field.tag}    ${field.value}`;

  function formatAndNormalizeSubfields(field) {
    return field.subfields.map(sf => `${subfieldToNormalizedString(sf)}`).join('');
  }
}

function fieldsToNormalizedString(fields) {
  const strings = fields.map(field => fieldToNormalizedString(field));
  strings.sort(); // eslint-disable-line functional/immutable-data
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
      const index = getSubfield8Index(sf);
      if (index > 0 && !subfield8Values.includes(index)) {
        //nvdebug(`Add subfield \$8 ${index} to seen values list`, debug);
        subfield8Values.push(index);
      }
    });
  });

  return subfield8Values;
  /* eslint-enable */
}

function getFieldsWithSubfield8Index(record, index) {
  return record.fields.filter(field => relevant4GFWS8I(field, index));

  function relevant4GFWS8I(field, index) {
    if (!field.subfields) {
      return false;
    }
    return field.subfields.some(sf => index > 0 && getSubfield8Index(sf) === index);
  }
}

function removeFieldOrSubfield8(record, field, index = 0) {
  const n8 = fieldHasNSubfields(field, '8');
  if (n8 === 1) {
    record.removeField(field);
    return;
  }
  if (index === 0) {
    return;
  }
  field.subfields = field.subfields.filter(sf => sf.code !== '8' || getSubfield8Index(sf) !== index); // eslint-disable-line functional/immutable-data

}

function removeSharedDatafieldsWithSubfield8FromSource(base, source) {
  const baseIndexesToInspect = recordGetAllSubfield8Indexes(base);
  if (baseIndexesToInspect.length === 0) {
    return;
  }

  nvdebug(`base elements: ${baseIndexesToInspect.join(' -- ')}`, debug);

  const sourceIndexesToInspect = recordGetAllSubfield8Indexes(source);
  if (sourceIndexesToInspect.length === 0) {
    return;
  }

  nvdebug(`source elements: ${sourceIndexesToInspect.join(' -- ')}`, debug);

  baseIndexesToInspect.forEach(baseIndex => {
    const baseFields = getFieldsWithSubfield8Index(base, baseIndex);
    const baseFieldsAsString = fieldsToNormalizedString(baseFields, baseIndex);
    //nvdebug(`Results for BASE ${baseIndex}:`, debug);
    //nvdebug(`${baseFieldsAsString}`, debug);
    sourceIndexesToInspect.forEach(sourceIndex => {
      const sourceFields = getFieldsWithSubfield8Index(source, sourceIndex);
      const sourceFieldsAsString = fieldsToNormalizedString(sourceFields, sourceIndex);
      // If $8 source fields match with base fields, then remove them from source:
      nvdebug(`Compare BASE and SOURCE:`, debug);
      nvdebug(`${baseFieldsAsString} vs\n${sourceFieldsAsString}`, debug);
      if (sourceFieldsAsString === baseFieldsAsString) {
        nvdebug(`Deletable subfield $8 group found: ${sourceFieldsAsString}`);
        // FFS! Mainly theoretical, but what if record has multiple $8 indexes!?!
        // The other 8s might be different. If field has multiple $8s, only relevant $8 subfield
        // should be removed.
        sourceFields.forEach(field => removeFieldOrSubfield8(source, field, sourceIndex));
        return;
      }
    });
  });
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
  const baseFieldsAsString = baseFields.map(field => fieldToNormalizedString(field));

  sourceFields.forEach(field => removeCommonDataFieldIfNeeded(field));

  function removeCommonDataFieldIfNeeded(field) {
    const fieldAsString = fieldToNormalizedString(field);
    nvdebug(`Looking for '${fieldAsString}' in '${baseFieldsAsString.join('\', \'')}'`, debug);
    if (!baseFieldsAsString.includes(fieldAsString)) {
      return;
    }
    nvdebug(`Remove ${fieldAsString}`, debug);
    source.removeField(field);
  }
}

