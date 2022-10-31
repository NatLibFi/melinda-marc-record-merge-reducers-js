import {fieldHasSubfield, nvdebug, nvdebugFieldArray} from './utils';


const KONEELLISESTI_TUOTETTU_TIETUE = 1; // Best
const TARKISTETTU_ENNAKKOTIETO = 2;
const ENNAKKOTIETO = 3;
//const EI_TASOA = 4;

const encodingLevelPreferenceArray = [' ', '1', '3', '4', '5', '2', '7', 'u', 'z', '8']; // MET-145
const prepublicationLevelIndex = encodingLevelPreferenceArray.indexOf('8');

export function isKoneellisestiTuotettuTietueOrTarkistettuEnnakkotieto(prepublicationLevel) {
  return prepublicationLevel === KONEELLISESTI_TUOTETTU_TIETUE || prepublicationLevel === TARKISTETTU_ENNAKKOTIETO;
}


export function encodingLevelIsBetterThanPrepublication(encodingLevel) {
  const index = encodingLevelPreferenceArray.indexOf(encodingLevel);
  return index > -1 && index < prepublicationLevelIndex;
}


function containsSubstringInSubfieldA(field, substring) {
  return field.subfields.some(sf => sf.code === 'a' && sf.value.includes(substring));
}


// These three functions below all refer to field 500:
export function fieldRefersToKoneellisestiTuotettuTietue(field) {
  return containsSubstringInSubfieldA(field, 'Koneellisesti tuotettu tietue');
}


export function fieldRefersToTarkistettuEnnakkotieto(field) {
  return containsSubstringInSubfieldA(field, 'TARKISTETTU ENNAKKOTIETO');
}


export function fieldRefersToEnnakkotieto(field) {
  // NB! This matches also 'TARKISTETTU ENNAKKOTIETO' case!
  return containsSubstringInSubfieldA(field, 'ENNAKKOTIETO');
}


export function firstFieldHasBetterPrepubEncodingLevel(field1, field2) {
  if (fieldRefersToKoneellisestiTuotettuTietue(field2)) {
    return false;
  }
  if (fieldRefersToKoneellisestiTuotettuTietue(field1)) {
    return true;
  }
  if (fieldRefersToTarkistettuEnnakkotieto(field2)) {
    return false;
  }
  if (fieldRefersToTarkistettuEnnakkotieto(field1)) {
    return true;
  }
  if (fieldRefersToEnnakkotieto(field2)) {
    return false;
  }
  if (fieldRefersToEnnakkotieto(field1)) {
    return true;
  }
  return false;
}


export function firstFieldHasEqualOrBetterPrepubEncodingLevel(field1, field2) {
  // Could be optimized...
  if (fieldRefersToKoneellisestiTuotettuTietue(field1)) {
    return true;
  }
  if (fieldRefersToKoneellisestiTuotettuTietue(field2)) {
    return false;
  }
  if (fieldRefersToTarkistettuEnnakkotieto(field1)) {
    return true;
  }
  if (fieldRefersToTarkistettuEnnakkotieto(field2)) {
    return false;
  }
  if (fieldRefersToEnnakkotieto(field1)) {
    return true;
  }
  return !fieldRefersToEnnakkotieto(field2);
}


function hasEnnakkotietoSubfield(field) {
  return field.subfields.some(sf => ['g', '9'].includes(sf.code) && sf.value.includes('ENNAKKOTIETO'));
}


export function isPrepublicationField6XX(field) {
  if (!field.tag.match(/^6(?:[0-4][0-9]|5[0-5])$/u)) { // Not within 600 ... 655 range
    return false;
  }
  return field.subfields.some(sf => hasEnnakkotietoSubfield(sf));
}


export function getRelevant5XXFields(record, f500 = false, f594 = false) {
  const cands = actualGetFields();
  nvdebugFieldArray(cands, 'gR5XXa: ');
  const filtered = cands.filter(field => hasRelevantPrepubData(field));
  nvdebugFieldArray(filtered, 'gR5XXb: ');
  return filtered;

  //return actualGetFields().filter(field => hasRelevantPrepubData(field));

  function hasRelevantPrepubData(field) {
    // Check prepub ($a):
    if (!fieldRefersToKoneellisestiTuotettuTietue(field) && !fieldRefersToEnnakkotieto(field)) {
      return false;
    }
    // Check relevance (594$5):
    if (field.tag !== '594') {
      return true;
    }
    return field.subfields.some(sf => sf.code === '5' && ['FENNI', 'FIKKA', 'VIOLA'].includes(sf.value));
  }

  function actualGetFields() {
    if (f500 && f594) {
      return record.get(/^(?:500|594)$/u);
    }
    if (f500) {
      return record.get(/^500$/u);
    }
    if (f594) {
      return record.get(/^594$/u);
    }
    return [];
  }

}


// Very similar to getPrepublicationLevel() in melinda-record-match-validator's getPrepublicationLevel()...
// We should use that and not have a copy here...
export function getPrepublicationLevel(record, f500 = false, f594 = false) {
  // Smaller return value is better
  const fields = getRelevant5XXFields(record, f500, f594);

  if (!fields) {
    return null;
  }
  if (fields.some(f => fieldRefersToKoneellisestiTuotettuTietue(f))) {
    return KONEELLISESTI_TUOTETTU_TIETUE;
  }

  if (fields.some(f => fieldRefersToTarkistettuEnnakkotieto(f))) {
    return TARKISTETTU_ENNAKKOTIETO;
  }

  if (fields.some(f => fieldRefersToEnnakkotieto(f))) {
    return ENNAKKOTIETO;
  }

  return null;
}


export function baseHasEqualOrHigherEncodingLevel(baseEncodingLevel, sourceEncodingLevel) {
  const baseIndex = encodingLevelPreferenceArray.indexOf(baseEncodingLevel);
  const sourceIndex = encodingLevelPreferenceArray.indexOf(sourceEncodingLevel);

  if (baseIndex === -1) {
    // Base wins if both are bad:
    return sourceIndex === -1;
  }
  return baseIndex <= sourceIndex;
}


function hasFikkaLOW(record) {
  return record.fields.some(field => field.tag === 'LOW' && fieldHasSubfield(field, 'a', 'FIKKA'));
}


function hasNatLibFi042(record) {
  return record.fields.some(field => field.tag === '042' && (fieldHasSubfield(field, 'a', 'finb') || fieldHasSubfield(field, 'a', 'finbd')));
}


export function isFikkaRecord(record) {
  return hasFikkaLOW(record) && hasNatLibFi042(record);
}


export function getEncodingLevel(record) {
  return record.leader.substring(17, 18);
}


export function deleteAllPrepublicationNotesFromField500(record) {
  const encodingLevel = getEncodingLevel(record);
  // Skip prepublication (or theoretically even worse) records:
  if (!encodingLevelIsBetterThanPrepublication(encodingLevel)) {
    return;
  }

  const f500 = record.get(/^500$/u);
  if (f500.length === 0) {
    return;
  }

  nvdebug(`Delete all ${f500.length} instance(s) of field 500`);
  f500.forEach(field => {
    if (fieldRefersToKoneellisestiTuotettuTietue(field) || fieldRefersToEnnakkotieto(field)) {
      record.removeField(field);
      return;
    }
  });
}


export function removeWorsePrepubField500s(record) {
  // Remove lower-level entries:
  const fields594 = getRelevant5XXFields(record, true, false); // 500=false, 594=true
  nvdebugFieldArray(fields594, '  Candidates for non-best 500 b4 filtering: ');
  const nonBest = fields594.filter(field => fields594.some(field2 => firstFieldHasBetterPrepubEncodingLevel(field2, field)));
  nvdebugFieldArray(nonBest, '  Remove non-best 500: ');
  nonBest.forEach(field => record.removeField(field));
}


export function removeWorsePrepubField594s(record) {
  // Remove lower-level entries:
  const fields594 = getRelevant5XXFields(record, false, true); // 500=false, 594=true
  nvdebugFieldArray(fields594, '  Candidates for non-best 594 b4 filtering: ');
  const nonBest = fields594.filter(field => fields594.some(field2 => firstFieldHasBetterPrepubEncodingLevel(field2, field)));
  nvdebugFieldArray(nonBest, '  Remove non-best 594: ');
  nonBest.forEach(field => record.removeField(field));
}


