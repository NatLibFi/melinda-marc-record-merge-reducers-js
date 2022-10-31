import {fieldHasSubfield, nvdebug} from './utils';


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

export function secondFieldDoesNotHaveBetterPrepubEncodingLevel(field1, field2) {
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


export function getRelevant5XXFields(record, natLibFiOnly = false) {
  if (!natLibFiOnly) {
    // NB! Does not check $5, $9 etc...
    return record.get(/^(?:500|594)$/u).filter(field => hasInterestringSubfieldA(field));
  }
  const candFields = record.get(/^594$/u);
  return candFields.filter(field => hasInterestringSubfieldA(field) && hasInterestringSubfield5(field));

  function hasInterestringSubfieldA(field) {
    return fieldRefersToKoneellisestiTuotettuTietue(field) || fieldRefersToEnnakkotieto(field);
  }

  function hasInterestringSubfield5(field) {
    return field.subfields.some(sf => sf.code === '5' && ['FENNI', 'FIKKA', 'VIOLA'].includes(sf.value));
  }

}

// Very similar to getPrepublicationLevel() in melinda-record-match-validator's getPrepublicationLevel()...
// We should use that and not have a copy here...
export function getPrepublicationLevel(record, natLibFiOnly) {
  // Smaller return value is better
  const fields = getRelevant5XXFields(record, natLibFiOnly);

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


function deleteWorsePrepublicationLevelFields(record, fields) {
  // Keeps only the most advanced prepublication level field(s)
  const koneellisestiTuotetutTietueet = fields.filter(f => fieldRefersToKoneellisestiTuotettuTietue(f));
  const tarkistetutEnnakkotiedot = fields.filter(f => fieldRefersToTarkistettuEnnakkotieto(f));
  const ennakkotiedot = fields.filter(f => fieldRefersToEnnakkotieto(f) && !fieldRefersToTarkistettuEnnakkotieto(f));

  if (koneellisestiTuotetutTietueet.length > 0) {
    nvdebug(` N=${koneellisestiTuotetutTietueet.length} Koneellisesti tuotettu tietue`);
    nvdebug(` N=${tarkistetutEnnakkotiedot.length} TARKISTETTU ENNAKKOTIETO => REMOVE`);
    nvdebug(` N=${ennakkotiedot.length} ENNAKKOTIETO (ei-tarkistettu) => REMOVE`);
    tarkistetutEnnakkotiedot.forEach(field => record.removeField(field));
    ennakkotiedot.forEach(field => record.removeField(field));
    return;
  }

  if (tarkistetutEnnakkotiedot.length > 0) {
    nvdebug(` N=${tarkistetutEnnakkotiedot.length} TARKISTETTU ENNAKKOTIETO`);
    nvdebug(` N=${ennakkotiedot.length} ENNAKKOTIETO (ei-tarkistettu) => REMOVE`);
    ennakkotiedot.forEach(field => record.removeField(field));
    return;
  }
}

// This should probably used only via base's postprocessing...
export function deleteWorsePrepublicationFields500(record) {
  // NB! Not checking $5 nor $9 etc...
  const f500 = record.get(/^500$/u);
  nvdebug(`deleteWorsePrepublicationFields500() will inspect ${f500.length} field(s)`);
  deleteWorsePrepublicationLevelFields(record, f500);
}

export function deleteWorsePrepublicationFields594(record) {
  const relevantFields = getRelevant5XXFields(record, true); // returns only tag=594
  nvdebug(`deleteWorsePrepublicationFields594() will inspect ${relevantFields.length} field(s)`);
  deleteWorsePrepublicationLevelFields(record, relevantFields);
}


