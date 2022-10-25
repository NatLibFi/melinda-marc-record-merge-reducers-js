// Implements MET-33

import {nvdebug} from './utils';
import {encodingLevelIsBetterThanPrepublication,
  fieldRefersToEnnakkotieto, fieldRefersToTarkistettuEnnakkotieto,
  fieldRefersToKoneellisestiTuotettuTietue, getEncodingLevel, getPrepublicationLevel, getRelevant5XXFields,
  isKoneellisestiTuotettuTietueOrTarkistettuEnnakkotieto} from './prepublicationUtils';

//const NA = 4; // Non-Applicable; used by Fennica-specific encoding level only

export default () => (base, source) => {
  deleteWorsePrepublicationFields500(base);
  deleteWorsePrepublicationFields594(base);
  deleteWorsePrepublicationFields500(source);
  deleteWorsePrepublicationFields594(source);
  // NB! We should actually do this during postprocessing after merge and add seps...
  // NB! 500 and 594 are treated separately, which is a bit iffy...
  //     Should 594 trigger deletion of 500?

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


function deleteWorsePrepublicationLevelFields(record, fields) {
  // Keeps only the most advanced prepublication level field(s)
  const koneellisestiTuotetutTietueet = fields.filter(f => fieldRefersToKoneellisestiTuotettuTietue(f));
  const tarkistetutEnnakkotiedot = fields.filter(f => fieldRefersToTarkistettuEnnakkotieto(f));
  const ennakkotiedot = fields.filter(f => fieldRefersToEnnakkotieto(f) && !fieldRefersToTarkistettuEnnakkotieto(f));

  nvdebug(` N=${koneellisestiTuotetutTietueet.length} Koneellisesti tuotettu tietue`);
  nvdebug(` N=${tarkistetutEnnakkotiedot.length} TARKISTETTU ENNAKKOTIETO`);
  nvdebug(` N=${ennakkotiedot.length} ENNAKKOTIETO (ei-tarkistettu)`);

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

  /*
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
  */
}


