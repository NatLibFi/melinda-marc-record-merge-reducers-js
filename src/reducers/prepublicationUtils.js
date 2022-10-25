import {fieldHasSubfield} from './utils';

const KONEELLISESTI_TUOTETTU_TIETUE = 1; // Best
const TARKISTETTU_ENNAKKOTIETO = 2;
const ENNAKKOTIETO = 3;
const EI_TASOA = 4;

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

function hasEnnakkotietoSubfield(field) {
  return field.subfields.some(sf => ['g', '9'].includes(sf.code) && sf.value.includes('ENNAKKOTIETO'));
}

export function isPrepublicationField6XX(field) {
  if (!field.tag.match(/^6(?:[0-4][0-9]|5[0-5])$/u)) { // Not within 600 ... 655 range
    return false;
  }
  return field.subfields.some(sf => hasEnnakkotietoSubfield(sf));
}


function getRelevant5XXFields(record, natLibFiOnly = false) {
  if (!natLibFiOnly) {
    return record.get(/^(?:500|594)$/u).filter(field => hasInterestringSubfieldA(field));
  }
  const candFields = record.get(/^594$/u);
  return candFields.filter(field => hasInterestringSubfieldA(field) && hasInterestringSubfield5(field));

  function hasInterestringSubfieldA(field) {
    return fieldRefersToKoneellisestiTuotettuTietue(field) || fieldRefersToEnnakkotieto(field);
  }

  function hasInterestringSubfield5(field) {
    return field.subsfields.some(sf => sf.code === '5' && ['FENNI', 'FIKKA', 'VIOLA'].includes(sf.value));
  }

}

export function getPrepublicationLevel(record, natLibFiOnly) {
  // Smaller return value is better
  const fields = getRelevant5XXFields(record, natLibFiOnly);

  if (!fields) {
    return EI_TASOA;
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

  return EI_TASOA;
}

export function getFennicaPrepublicationLevel(record) {
  if (!hasFikkaLOW(record)) {
    return null;
  }
  if (!hasNatLibFi041(record)) {
    return null;
  }
  // MH wrote Fennica encoding level specs into MET-33 comments.
  return getPrepublicationLevel(record, true);
  // "Jos tietueessa ei ole Fennican tunnuksia, sillä ei ole Fennica-tasoa lainkaan"
  //nvdebug('getFennicaEncodingLevel() not implemented yet!');
  //return 0;
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

function hasNatLibFi041(record) {
  return record.fields.some(field => field.tag === '041' && (fieldHasSubfield(field, 'a', 'finb') || fieldHasSubfield(field, 'a', 'finbd')));
}


export function getEncodingLevel(record) {
  return record.leader.substring(17, 18);
}

