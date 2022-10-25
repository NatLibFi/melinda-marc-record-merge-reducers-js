import {fieldHasSubfield} from './utils';

const KONEELLISESTI_TUOTETTU_TIETUE = 1; // Best
const TARKISTETTU_ENNAKKOTIETO = 2;
const ENNAKKOTIETO_TAI_EOS = 3;

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

export function getPrepublicationLevel(record, natLibFiOnly = false) {
  // Smaller retrurn value is better
  const fields = getRelevantFields();

  if (!fields) {
    return ENNAKKOTIETO_TAI_EOS;
  }
  if (fields.some(f => fieldRefersToKoneellisestiTuotettuTietue(f))) {
    return KONEELLISESTI_TUOTETTU_TIETUE;
  }

  if (fields.some(f => fieldRefersToTarkistettuEnnakkotieto(f))) {
    return TARKISTETTU_ENNAKKOTIETO;
  }

  /*
      if (fields.some(f => ieldRefersToEnnakkotieto(f))) {
          return ENNAKKOTIETO_TAI_EOS;
      }
      */
  return ENNAKKOTIETO_TAI_EOS;

  function getRelevantFields() {
    if (!natLibFiOnly) {
      return record.get(/^(?:500|594)$/u);
    }
    const candFields = record.get(/^594$/u);
    return candFields.filter(field => fieldHasSubfield(field, '5', 'FENNI') ||
          fieldHasSubfield(field, '5', 'VIOLA') || fieldHasSubfield(field, '5', 'FIKKA'));

  }
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

/*
function hasFikkaLOW(record) {
  return record.fields.some(field => field.tag === 'LOW' && fieldHasSubfield(field, 'a', 'FIKKA'));
}
*/
/*
function hasNatLibFi041(record) {
  return record.fields.some(field => field.tag === '041' && (fieldHasSubfield(field, 'a', 'finb') || fieldHasSubfield(field, 'a', 'finbd')));
}
*/
/*
function getFennicaEncodingLevel(record) {
  if (!hasFikkaLOW(record)) {
    return NA;
  }
  if (!hasNatLibFi041(record)) {
    return NA;
  }
  // MH wrote Fennica encoding level specs into MET-33 comments.

  // "Jos tietueessa ei ole Fennican tunnuksia, sillä ei ole Fennica-tasoa lainkaan"
  nvdebug('getFennicaEncodingLevel() not implemented yet!');
  return 0;
}
*/


export function getEncodingLevel(record) {
  return record.leader.substring(17, 18);
}

