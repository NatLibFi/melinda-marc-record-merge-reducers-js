// Implements MET-33

// MET-33 (comment) by MH:
//
// Ennakkotietokenttä / prePublicationNote:
// ========================================
//
// "500 jossa ennakkotieto/tarkistettu ennakkotieto/Koneellisesti tuotettu tietue [and legay ENNAKKOTIETO/TARKISTETTU ENNAKKOTIETO]
// KEEP fromSource if baseRecordLevel/mergedRecordLevel === prePub,
// merge by keeping the most advanced prePublicationNote (or keep all first?).
// DROP fromSource if baseRecordLevel/mergedRecordLevel > prePub"
//
// Implementation:
// 1) LDR/17 is better than '8' (prepub): call deleteAllPrepublicationNotesFromField500InNonPubRecord(mergedRecord)
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


import {fieldToString, nvdebug, nvdebugFieldArray} from './utils';
import {handleField6XX} from './preprocessPrepublicationField6XX';
import {encodingLevelIsBetterThanPrepublication, getEncodingLevel,
  getPrepublicationLevel, getRelevant5XXFields, isFikkaRecord,
  prepublicationLevelIsKoneellisestiTuotettuTietueOrTarkistettuEnnakkotieto, isKingOfTheHill,
  removeWorsePrepubField594s,
  removeWorsePrepubField500s,
  firstFieldHasBetterPrepubEncodingLevel} from '@natlibfi/marc-record-validators-melinda/dist/prepublicationUtils';
import {handlePrepublicationNameEntries} from './preprocessPrepublicationEntries';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:preprocessPrepublication');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

//const NA = 4; // Non-Applicable; used by Fennica-specific encoding level only

export default () => (base, source) => {
  //nvdebug('BASE', debugDev);
  //nvdebug(JSON.stringify(base), debugDev);
  //nvdebug('SOURCE', debugDev);
  //nvdebug(JSON.stringify(source), debugDev);


  handlePrepublicationNameEntries(base, source);

  preprocessSourceFields594And500(base, source);

  handleField263(base, source); // Do this before tampering with LDR/17...
  handleField6XX(base, source);
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


function removeUnwantedSourceField500s(base, source) {
  // Removes prepub 500 fields, if base is not a prepub

  // See MET-33 for details.
  // No action required:
  const sourceFields500 = getRemovable500SourceFields();
  nvdebugFieldArray(sourceFields500, '  Remove unneeded source 500: ', debugDev);
  sourceFields500.forEach(field => source.removeField(field));

  function getRemovable500SourceFields() {
    const sourceFields500 = getRelevant5XXFields(source, true, false);
    const baseEncodingLevel = getEncodingLevel(base);

    // Remove all prepublication level notes if base is not a prepublication:
    if (sourceFields500.length === 0 || encodingLevelIsBetterThanPrepublication(baseEncodingLevel)) {
      return sourceFields500;
    }

    // Remove those prepublication level notes that are not better than the ones base record already has:
    const baseFields500 = getRelevant5XXFields(base, true, false);
    if (baseFields500.length === 0) {
      // Should we remove all or nothing? Currently we remove nothing, if base-500 has no prepublication level info.
      return []; // or return sourceFields500?
    }

    return sourceFields500.filter(sourceField => baseFields500.some(baseField => !firstFieldHasBetterPrepubEncodingLevel(sourceField, baseField)));

  }

}


function removeUnwantedSourceField594s(base, source) {
  // See MET-33 for details
  if (keepSource594()) { // Require FIKKA LOW etc
    return;
  }

  const sourceFields594 = getRelevant5XXFields(source, false, true);
  nvdebugFieldArray(sourceFields594, '  Remove unwanted source 594: ', debugDev);
  sourceFields594.forEach(field => source.removeField(field));

  function keepSource594() {
    // Start with a sanity check:
    if (!isFikkaRecord(source)) { // LOW $a FIKKA AND 042$a finb/finbd
      // (NV: I wouldn't count on all the FIKKA stuff actually having a proper 042$a...)
      return false; // Remove, though there's shouldn't be anything to remove...
    }

    const baseEncodingLevel = getEncodingLevel(base);
    const baseFields594 = getRelevant5XXFields(base, false, true);
    if (isFikkaRecord(base) && encodingLevelIsBetterThanPrepublication(baseEncodingLevel) && baseFields594.length === 0) {
      return false;
    }
    return true;
  }
}


function removeUninterestingSourceField594s(base, source) {
  // Remove them source 594 fields that already have same or better base 594 source field
  // "Koneellisesti tuotettu tietue" > "tarkistettu ennakkotieto" > "ennakkotieto".
  const baseFields594 = getRelevant5XXFields(base, false, true); // 2nd are true means 594 $5 FIKKA/FENNI/VIOLA
  if (baseFields594.length === 0) {
    return;
  }
  const sourceFields594 = getRelevant5XXFields(source, false, true);

  const deletableFields = sourceFields594.filter(sourceField => !isKingOfTheHill(sourceField, baseFields594));
  nvdebugFieldArray(deletableFields, '  Remove uninteresting source 594: ', debugDev);
  deletableFields.forEach(field => source.removeField(field));
}


function copySource594ToSource500(record) {
  const encodingLevel = getEncodingLevel(record);
  if (encodingLevel !== '8') {
    return;
  }
  const fields594 = getRelevant5XXFields(record, false, true);
  if (fields594.length === 0) {
    return;
  }
  const fields500 = getRelevant5XXFields(record, true, false);

  // Add if field 594 is better than anything in fields 500.
  // NB! This adds all the better values, not just the best.
  const addables = fields594.filter(field594 => isKingOfTheHill(field594, fields500));
  if (addables.length === 0) {
    return;
  }
  nvdebugFieldArray(fields594, 'CAND4ADD: ', debugDev);
  nvdebugFieldArray(addables, 'ADDABLE: ', debugDev);
  // NB: FIX LATER: there should be just one addable (even if 594 had many)
  addables.forEach(field => {
    const subfieldA = field.subfields.find(sf => sf.code === 'a');

    if (!subfieldA) { // unneeded sanity check
      return;
    }

    const newSubfieldAValue = subfieldA.value.slice(-1) === '.' ? subfieldA.value : `${subfieldA.value}.`;
    const newField = {'tag': '500', 'ind1': ' ', 'ind2': ' ', 'subfields': [{'code': 'a', 'value': newSubfieldAValue}]};
    record.insertField(newField);
    nvdebug(`Added ${fieldToString(newField)}`, debugDev);
  });

}


function preprocessSourceFields594And500(base, source) {
  removeWorsePrepubField594s(source); // Keeps only the best prepub field(s) 594. (Keep/remove them in/from base?)
  removeUnwantedSourceField594s(base, source); // Source needs to keep only better prepub levels
  removeUninterestingSourceField594s(base, source); // Should we do this to 500 as well?

  // Prepub encoding level can't be worse that Fennica prepub level, can it?
  // Apply to source, but how about base?
  copySource594ToSource500(source);
  removeWorsePrepubField500s(source); // Eg. if has "Koneellisesti tuotettu tietue", remove "ennakkotieto" etc

  removeUnwantedSourceField500s(base, source); // Base > prepub, drop sources prepub fields

}

function removeField263(record) {
  const deletableFields = record.get(/^263$/u);
  nvdebug(`removeField263() got ${deletableFields.length} deletable field(s)`, debugDev);
  deletableFields.forEach(field => record.removeField(field));
  removeEiVielaIlmestynyt500(record);
}

function removeEiVielaIlmestynyt500(record) {

  const deletableFields = record.get(/^500$/u).filter(field => isEVI(field));
  nvdebugFieldArray(deletableFields, 'remove500(): ', debugDev);
  deletableFields.forEach(field => record.removeField(field));

  function isEVI(field) {
    if (field.subfields.some(sf => sf.code === '5')) {
      return false;
    }
    return field.subfields.some(sf => sf.code === 'a' && sf.value.includes('EI VIELÄ ILMESTYNYT'));
  }
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
    const prepublicationLevel = getPrepublicationLevel(base, true, true); // NB! Any prepub info is used here!
    nvdebug(`handleField263: Prepublication level is ${prepublicationLevel}`, debugDev);
    if (prepublicationLevelIsKoneellisestiTuotettuTietueOrTarkistettuEnnakkotieto(prepublicationLevel)) {
      removeField263(source);
      return;
    }
  }
  nvdebug(`handleField263() base field 263 removal not handled yet`, debugDev);

  // If baseRecordLevel < prePub/tarkistettu ennakkotieto && baseRecord === databaseRecord && sourceRecord === incomingRecord && incomingCataloger === IMP_ENNAKK || IMP_VPKPK || ???  -> KEEP fromSource & DROP fromBase
}

