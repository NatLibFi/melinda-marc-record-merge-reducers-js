// Implements MET-33

import {nvdebug} from './utils';
import {encodingLevelIsBetterThanPrepublication,
  fieldRefersToEnnakkotieto, fieldRefersToTarkistettuEnnakkotieto,
  fieldRefersToKoneellisestiTuotettuTietue, getEncodingLevel, getPrepublicationLevel,
  isKoneellisestiTuotettuTietueOrTarkistettuEnnakkotieto} from './prepublicationUtils';

//const NA = 4; // Non-Applicable; used by Fennica-specific encoding level only

export default () => (base, source) => {
  //deleteWorse500(base);
  deleteWorse500(source);
  handleField263(base, source); // Do this before tampering with LDR/17...
  handleSource6XX(base, source);
  //setBaseEncodingLevel(base, source); // Change's LDR/17 so source 263 should be handled before this
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
  if (baseEncodingLevel === '8') { // LDR/17='8'
    const prepublicationLevel = getPrepublicationLevel(base, false);
    nvdebug(`Prepublication level is ${prepublicationLevel}`);
    if (isKoneellisestiTuotettuTietueOrTarkistettuEnnakkotieto(prepublicationLevel)) {
      removeField263(source);
      return;
    }
  }
  nvdebug(`handleField263() base field 263 removal not handled yet`);

  // If baseRecordLevel < prePub/tarkistettu ennakkotieto && baseRecord === databaseRecord && sourceRecord === incomingRecord && incomingCataloger === IMP_ENNAKK || IMP_VPKPK || ???  -> KEEP fromSource & DROP fromBase
}

function handleSource6XX(base, source) {
  const baseEncodingLevel = getEncodingLevel(base);
  const baseFields6XX = getFields6XX(base);
  // If base record is good enough, remove 263 from source:
  if (encodingLevelIsBetterThanPrepublication(baseEncodingLevel)) {
    if (baseFields6XX.length) {
      removeFields6XX(source);
      return;
    }
    return;
  }

  function getFields6XX(record) {
    return record.get(/^6(?:[0-4][0-9]|5[0-5])$/u);
  }

  function removeFields6XX(record) {
    const deletableFields = record.get(/^6(?:[0-4][0-9]|5[0-5])$/u);
    nvdebug(`removeFields6XX() got ${deletableFields.length} deletable field(s)`);
    deletableFields.forEach(field => record.removeField(field));
  }
}


// Very similar to getPrepublicationLevel() in melinda-record-match-validator's getPrepublicationLevel()...
// We should use that and not have a copy here...


function deleteWorse500(record) {
  const f500 = record.get(/^500$/u);

  const koneellisestiTuotetutTietueet = f500.filter(f => fieldRefersToKoneellisestiTuotettuTietue(f));
  const tarkistetutEnnakkotiedot = f500.filter(f => fieldRefersToTarkistettuEnnakkotieto(f));
  const ennakkotiedot = f500.filter(f => fieldRefersToEnnakkotieto(f) && !fieldRefersToTarkistettuEnnakkotieto(f));

  if (koneellisestiTuotetutTietueet.length > 0) {
    tarkistetutEnnakkotiedot.forEach(field => record.removeField(field));
    ennakkotiedot.forEach(field => record.removeField(field));
    return;
  }

  if (tarkistetutEnnakkotiedot.length > 0) {
    ennakkotiedot.forEach(field => record.removeField(field));
    return;
  }
}


