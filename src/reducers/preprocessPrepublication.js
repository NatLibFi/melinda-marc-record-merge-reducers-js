// Implements MET-33

// MET-33 (comment) by MH:
//
// Ennakkotietokenttä / prePublicationNote:
// ========================================
//
// "500 jossa ENNAKKOTIETO/TARKISTETTU ENNAKKOTIETO/KONEELLISESTI TUOTETTU TIETUE
// KEEP fromSource if baseRecordLevel/mergedRecordLevel === prePub,
// merge by keeping the most advanced prePublicationNote (or keep all first?).
// DROP fromSource if baseRecordLevel/mergedRecordLevel > prePub"
//
// Implementation:
// 1) LDR/17 is better than '8' (prepub): call deleteAllPrepublicationNotesFromField500(mergedRecord)
// 2) LDR/17 is '8' (prepub) (or theoretically something worse): call deleteWorsePrepublicationLevelFields(mergedRecord, fields500)
//
// Fennican ennakkotietokenttä / natBibPrePublicationNote
// ======================================================
//
// "(594, ennakkotietohuomautus, $5 FENNI/FIKKA/VIOLA)
// (Sanity check - if sourceRecord !== natBibRecord, these could be DROPped)
// KEEP fromSource if baseRecordLevel/mergedRecordLevel > prePub && (baseRecord !== natBibRecord || baseRecordNatBibPrePublicationNote), keep all in merged or keep the mostAdvanced prePublicationNote
// DROP fromSource if baseRecordLevel/mergedRecordLevel > prePub && !baseRecordNatBibPrePublicationNote && baseRecord === natBibRecord"
//
// Implementation:
// 1) LDR/17 is '8' (prepub) (or theoretically something worse): call deleteWorsePrepublicationLevelFields(mergedRecord, fields594 with $5 FENNI/FIKKA/VIOLA)
//


import {nvdebug} from './utils';
import {encodingLevelIsBetterThanPrepublication, getEncodingLevel, getPrepublicationLevel,
  getRelevant5XXFields,
  isFikkaRecord,
  isKoneellisestiTuotettuTietueOrTarkistettuEnnakkotieto,
  secondFieldDoesNotHaveBetterFennicaEncodingLevel} from './prepublicationUtils';

//const NA = 4; // Non-Applicable; used by Fennica-specific encoding level only

export default () => (base, source) => {
  nvdebug('BASE');
  nvdebug(JSON.stringify(base));
  nvdebug('SOURCE');
  nvdebug(JSON.stringify(source));

  preprocessSourceField594(base, source);

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

function removeUnwantedSourceField594s(base, source) {
  const baseFields594 = getRelevant5XXFields(base, true); // 2nd are true means 594 $5 FIKKA/FENNI/VIOLA
  if (keepSource594()) {
    return;
  }

  const sourceFields594 = getRelevant5XXFields(source, true);
  sourceFields594.forEach(field => source.removeField(field));

  function keepSource594() {
    // Start with a sanity check:
    if (!isFikkaRecord(source)) {
      return false; // Remove, though there's shouldn't be anything to remove...
    }

    const baseEncodingLevel = getEncodingLevel(base);
    if (isFikkaRecord(base) && encodingLevelIsBetterThanPrepublication(baseEncodingLevel) && baseFields594.length === 0) {
      return false;
    }
    return true;
  }
}

function removeUninterestingSourceField594s(base, source) {
  // Remove them source 594 fields that already have same or better base 594 source field
  const baseFields594 = getRelevant5XXFields(base, true); // 2nd are true means 594 $5 FIKKA/FENNI/VIOLA
  if (baseFields594.length === 0) {
    return;
  }
  const sourceFields594 = getRelevant5XXFields(source, true);

  const deletableFields = sourceFields594.filter(sourceField => survivable(sourceField));
  deletableFields.forEach(field => source.removeField(field));

  function survivable(sourceField) {
    return baseFields594.some(baseField => secondFieldDoesNotHaveBetterFennicaEncodingLevel(baseField, sourceField));
  }
}

function preprocessSourceField594(base, source) {
  removeUnwantedSourceField594s(base, source);
  removeUninterestingSourceField594s(base, source);
}

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


