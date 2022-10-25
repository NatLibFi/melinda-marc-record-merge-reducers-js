// Implements MET-33

import {fieldHasSubfield, nvdebug} from './utils';

const KONEELLISESTI_TUOTETTU_TIETUE = 1;
const TARKISTETTU_ENNAKKOTIETO = 2;
const ENNAKKOTIETO_TAI_EOS = 3;
//const NA = 4; // Non-Applicable; used by Fennica-specific encoding level only

export default () => (base, source) => {
  handleField263(base, source); // Do this before tampering with LDR/17...
  setBaseEncodingLevel(base, source); // Change's LDR/17 so source 263 should be handled before this
  /*
  const baseEncodingLevel = getEncodingLevel(base);
  const baseFennicaEncodingLevel = getFennicaEncodingLevel(base);

  const sourceEncodingLevel = getEncodingLevel(source);
  const sourceFennicaEncodingLevel = getFennicaEncodingLevel(source);
*/

  const result = {base, source};
  return result;
};

function removeField263(record) {
  const deletableFields = record.get(/^263$/u);

  /*
    if (deletableFields.length === 0) {
        return;
    }
    */
  nvdebug(`removeField263() got ${deletableFields.length} deletable field(s)`);
  deletableFields.forEach(field => record.removeField(field));
}

function handleField263(base, source) {
  const baseEncodingLevel = getEncodingLevel(base);
  // If base record is good enough, remove 263 from source:
  if (encodingLevelIsBetterThanPrepublication(baseEncodingLevel)) {
    removeField263(source);
    return;
  }
  // NB! Here smaller is better. Skips only ENNAKKO_TIETO_OR_EOS.
  if (baseEncodingLevel === '8' && getPrepublicationLevel(base, false) <= TARKISTETTU_ENNAKKOTIETO) {
    removeField263(source);
    return;
  }
  nvdebug(`handleField263() base field 263 removal not handled yet`);

  // If baseRecordLevel < prePub/tarkistettu ennakkotieto && baseRecord === databaseRecord && sourceRecord === incomingRecord && incomingCataloger === IMP_ENNAKK || IMP_VPKPK || ???  -> KEEP fromSource & DROP fromBase
}


function setBaseEncodingLevel(base, source) {
  const baseEncodingLevel = getEncodingLevel(base);
  const sourceEncodingLevel = getEncodingLevel(source);

  if (baseHasHigherEncodingLevel(baseEncodingLevel, sourceEncodingLevel)) {
    return; // No action required
  }
  // Source's LDR/17 is copied to base's LDR/17:
  base.leader = base.leader.substring(0, 17) + sourceEncodingLevel + base.leader.substring(18); // eslint-disable-line functional/immutable-data
}

// Very similar to getPrepublicationLevel() in melinda-record-match-validator's getPrepublicationLevel()...
// We should use that and not have a copy here...

function containsSubstringInSubfieldA(field, substring) {
  return field.subfields.some(sf => sf.code === 'a' && sf.value.includes(substring));
}

function getPrepublicationLevel(record, natLibFiOnly = false) {
  const fields = getRelevantFields();

  if (!fields) {
    return ENNAKKOTIETO_TAI_EOS;
  }
  if (fields.some(f => containsSubstringInSubfieldA(f, 'Koneellisesti tuotettu tietue'))) {
    return KONEELLISESTI_TUOTETTU_TIETUE;
  }

  if (fields.some(f => containsSubstringInSubfieldA(f, 'TARKISTETTU ENNAKKOTIETO'))) {
    return TARKISTETTU_ENNAKKOTIETO;
  }

  /*
    if (fields.some(f => containsSubstringInSubfieldA(f, 'ENNAKKOTIETO'))) {
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

function getEncodingLevel(record) {
  return record.leader.substring(17, 18);
}


const encodingLevelPreferenceArray = [' ', '1', '3', '4', '5', '2', '7', 'u', 'z', '8']; // MET-145
const prepublicationLevelIndex = encodingLevelPreferenceArray.indexOf('8');

function encodingLevelIsBetterThanPrepublication(encodingLevel) {
  const index = encodingLevelPreferenceArray.indexOf(encodingLevel);
  return index > -1 && index < prepublicationLevelIndex;
}

function baseHasHigherEncodingLevel(baseEncodingLevel, sourceEncodingLevel) {
  const baseIndex = encodingLevelPreferenceArray.indexOf(baseEncodingLevel);
  const sourceIndex = encodingLevelPreferenceArray.indexOf(sourceEncodingLevel);

  if (baseIndex === -1) {
    // Base wins if both are bad:
    return sourceIndex === -1;
  }
  return baseIndex <= sourceIndex;
}
