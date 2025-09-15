import {/*encodingLevelIsBetterThanPrepublication,*/ getEncodingLevel, isEnnakkotietoField, isEnnakkotietoSubfield} from '@natlibfi/marc-record-validators-melinda/dist/prepublicationUtils.js';

import {fieldToString, nvdebug, nvdebugFieldArray} from './utils.js';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:preprocessPrepublicationField6XX');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

/* // MET-33 (comments):
ENNAKKOTIETOMERKINNÄLLISET ASIASANAT (600-655) $gENNAKOTIETO / $9 ENNAKKOTIETO

    If baseRecordLevel > prePub && baseRecord has some fields 600-655 -> drop NV: siis tiputetaan kaikki sourcen 6XX-kentät, joissa on $g ENNAKKOTIETO tai $9 ENNAKKOTIETO?
    OK
    If baseRecordLevel === prePub -> keepFromSource, merge with existing fields, drop prePubSubfield if existing doesn't have it, for merge search just based on term (sf $a), search in all subjectHeadings fields
    OK
    If baseRecordLevel === prePub && baseRecord === databaseRecord && sourceRecord === incomingRecord && incomingCataloger === IMP_ENNAKK || IMP_VPKPK || ??? -> KEEP fromSource & DROP fromBase
    NOT IMPLEMENTED

    // MET-34 (SN Comment):
    "Sanoisin, että jos tietueessa on jo sisällönkuvailu niin ei tuoda mitään kontrolloimattomia [653-kenttiä]."

*/

export function handleField6XX(base, source) {
  // This might form it's own file reprocessPrepublication6XX.js...
  const baseEncodingLevel = getEncodingLevel(base);
  if (baseEncodingLevel === '8') {
    handle6XXWhenBaseIsPrepublication(base, source);
    return;
  }

  removeDoublish653FromSource(base, source);
  // Default_ remove stuff
  handleSource6XXWhenBaseIsNotPrepublication(base, source);
  return;


  function handle6XXWhenBaseIsPrepublication(base, source) {
    // NOT IMPLEMENTED YET =>
    // Exception:
    // If baseRecordLevel === prePub && baseRecord === databaseRecord && sourceRecord === incomingRecord &&
    // incomingCataloger === IMP_ENNAKK || IMP_VPKPK || ??? -> KEEP fromSource & DROP fromBase
    // >= NOT IMPLEMENTED YET

    // Default: If baseRecordLevel === prePub -> keepFromSource, merge with existing fields, drop prePubSubfield if existing doesn't have it, for merge search just based on term (sf $a), search in all subjectHeadings fields
    const sourceFields6XX = getFields6XX(source).filter(field => isEnnakkotietoField(field));
    if (sourceFields6XX.length === 0) { // There's nothing to do, no $g/$9 to remove
      return;
    }
    const baseFields6XX = getFields6XX(base).filter(field => !isEnnakkotietoField(field));
    const counterpartValues = baseFields6XX.map(field => extractComparabledata(field));
    sourceFields6XX.forEach(sourceField => removeEnnakkotietoFieldIfPossible(sourceField, counterpartValues));
  }

  function removeDoublish653FromSource(base, source) { // MET-34
    const sourceEncodingLevel = getEncodingLevel(source);
    if (!['2', '8'].includes(sourceEncodingLevel)) {
      return;
    }
    const baseEncodingLevel = getEncodingLevel(base, source);
    if (['2', '8'].includes(baseEncodingLevel)) {
      return;
    }

    const baseFields6XX = getFields6XX(base).filter(field => !isEnnakkotietoField(field) && field.tag !== '653');
    if (baseFields6XX.length === 0) {
      return;
    }
    // <- base has proper subject fields, -> remove uncontrolled subject 653 fields:
    const removableFields = source.get(/^653$/u);
    removableFields.forEach(field => source.removeField(field));
  }

  function extractComparabledata(field) {
    return JSON.stringify(field.subfields.filter(sf => sf.code === 'a'));
  }

  function removeEnnakkotietoFieldIfPossible(field, counterpartValues) {
    const value = extractComparabledata(field);
    nvdebug(`Matching ${value}`, debugDev);
    if (!counterpartValues.includes(value)) {
      return;
    }
    nvdebug(`Try to remove prepub subfields from ${fieldToString(field)}`, debugDev);
    field.subfields = field.subfields.filter(sf => !isEnnakkotietoSubfield(sf));
    nvdebug(`Result: ${fieldToString(field)}`, debugDev);
  }

  function handleSource6XXWhenBaseIsNotPrepublication(base, source) {
    const baseFields6XX = getFields6XX(base).filter(field => !isEnnakkotietoField(field));
    if (baseFields6XX.length === 0) {
      return;
    }
    // Can remove 6XX prepub fields from source:
    const removableFields = getFields6XX(source).filter(field => isEnnakkotietoField(field));
    nvdebugFieldArray(removableFields, 'remove source 6XX ennakkotieto field', debugDev);
    removableFields.forEach(field => source.removeField(field));
    return;
  }

  function getFields6XX(record) {
    return record.get(/^6(?:[0-4][0-9]|5[0-5])$/u);
  }

}


