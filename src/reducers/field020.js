import createDebugLogger from 'debug';
//import {normalizeSync} from 'normalize-diacritics';
//import fs from 'fs';
//import path from 'path';
import {normalizeSubfields, getFieldSpecs} from './melindaCustomMergeFunctions.js';

export default ({tagPattern, dropSubfields = []}) => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(tagPattern);
  // Check source for subfields to drop before starting the merge process
  // 020: $c is dropped
  const sourceFields = checkDropSubfields(source.get(tagPattern));
  //debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  //debug(`base.leader: ${base.leader}`);
  //debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);
  //debug(`source.leader: ${source.leader}`);

  // Since the arrays contain only one field at a time, they can be destructured into objects
  const [baseField] = baseFields;
  //debug(`baseField: ${JSON.stringify(baseField, undefined, 2)}`);
  const [sourceField] = sourceFields;
  //debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);

  // Get field specs from melindaCustomMergeFields.json
  const fieldSpecs = getFieldSpecs(baseField.tag);
  debug(`fieldSpecs: ${JSON.stringify(fieldSpecs, undefined, 2)}`);
  // Get arrays of repeatable and non-repeatable subfields from field specs
  const repSubs = fieldSpecs.subfields.filter(sub => sub.repeatable === "true").map(sub => sub.code);
  debug(`repSubs: ${JSON.stringify(repSubs, undefined, 2)}`);
  const nonRepSubs = fieldSpecs.subfields.filter(sub => sub.repeatable === "false").map(sub => sub.code);
  debug(`nonRepSubs: ${JSON.stringify(nonRepSubs, undefined, 2)}`);

  // Normalize subfield values for comparison
  const baseSubsNormalized = normalizeSubfields(baseField);
  debug(`baseSubsNormalized: ${JSON.stringify(baseSubsNormalized, undefined, 2)}`);
  const sourceSubsNormalized = normalizeSubfields(sourceField);
  debug(`sourceSubsNormalized: ${JSON.stringify(sourceSubsNormalized, undefined, 2)}`);

  // First check whether the values of significant subfields are equal
  // Test 09: If not, fields do not match and records are not merged at all
  // 020: $a (ISBN)

  const significantCodes = ["a"];
  compareSubValues(significantCodes);

  // Test 10: If values of significant subfields are equal, copy other subfields from source field to base field
  // - nonRepSubs only if missing from base
  // - repSubs as additional copies
  // Create modified base field and replace old base with it


  // funktio joka ottaa vastaan sen mitä etsitään, olio johon tulee tag ja arrayt
  // ja annetaan se containsfieldwithvaluelle
  // jos tulee true, kopioidaan jos puuttuu ja kopioidaan joka tapauksessa
  // record.containsFieldWithValue('245', [{code: 'a', value: 'foo'}]);
  // voi ottaa useaan kertaan repsubs, voi ottaa max 1 kpl nonrepsubs
  // jos sallitaan useampi kpl, laitetaan 0 niin voi tulla niin monta kenttää kuin löytyy
  // pudottaa samat subfieldit pois
  // 3 funktiota:
  // 1. droppaa subfieldejä: record.containsfieldwithvalue, array subeja jotka dropataan ja mistä kentästä (regexp value kaikki mahd stringit)
  // 2. testaa onko nonrep, jos ei niin lisätään
  // 3. samalle funktiolle myös repsubs, laitetaan boolean "isrepeatable", voi laittaa multipleita
  // lopuksi poistetaan tuplasisältöiset
  // otetaan vastaan tag mitä kenttää käsitellään, niin voi käyttää useammassa kentässä


  /*if (baseSubValue === sourceSubValue) {
      const nonRepSubs = ["6"];
      const repSubs = ["q", "z", "8"];

      const nonRepSubCodesSource = sourceField.subfields
          .filter(subfield => nonRepSubs.indexOf(subfield.code) !== -1)
          .map(subfield => subfield.code);
      debug(`nonRepSubCodesSource: ${JSON.stringify(nonRepSubCodesSource, undefined, 2)}`);
      const nonRepSubCodesBase = baseField.subfields
          .filter(subfield => nonRepSubs.indexOf(subfield.code) !== -1)
          .map(subfield => subfield.code);
      debug(`nonRepSubCodesBase: ${JSON.stringify(nonRepSubCodesBase, undefined, 2)}`);

      // Copy those non-repeatable subfields from source that are not already present in base
      const nonRepSubCodesToCopy = nonRepSubCodesSource.filter(code => nonRepSubCodesBase.indexOf(code) === -1);
      debug(`nonRepSubCodesToCopy: ${JSON.stringify(nonRepSubCodesToCopy, undefined, 2)}`);

      // Check whether there are identical repeatable subfields
      // Copy non-identical repeatable subfields from source to base
      const repSubsBase = baseField.subfields.filter(subfield => repSubs.indexOf(subfield.code) !== -1)
      debug(`repSubsBase: ${JSON.stringify(repSubsBase, undefined, 2)}`);
      const repSubsSource = sourceField.subfields.filter(subfield => repSubs.indexOf(subfield.code) !== -1)
      debug(`repSubsSource: ${JSON.stringify(repSubsSource, undefined, 2)}`);

      //const repSubsToCopy = repSubsSource.filter(isIdenticalSubfield(subfield => repSubsBase.subfield));
      //debug(`repSubsToCopy: ${JSON.stringify(repSubsToCopy, undefined, 2)}`);


      const addSubfieldsToBaseField = baseField.subfields.push(sourceField => sourceField.subfields.code.indexOf(repSubsSource) !== -1);
      //const modifieldBaseField = baseField;
      debug(`baseField: ${JSON.stringify(baseField, undefined, 2)}`);

      return base;
  }

  function replaceBasefieldWithModifiedBasefield(base) {
      const index = base.fields.findIndex(field => field === baseField);
      base.fields.splice(index, 1, modifiedBasefield); // eslint-disable-line functional/immutable-data
      debug(`Adding new subfields to ${baseField.tag}`);
      return base;
  }*/

  function checkDropSubfields(fields) {
    if (dropSubfields.length > 0) {
      debug(`Subfield(s) ${dropSubfields} dropped from source field`);
      return fields.map((field) => ({...field, subfields: field.subfields.filter((subfield) => dropSubfields.indexOf(subfield.code) === -1)}));
    }
    debug(`No subfields to drop from source field`);
    return fields;
  }

  function compareSubValues(codes) {
    const baseValues = baseSubsNormalized
      .filter(subfield => codes.indexOf(subfield.code) !== -1)
      .map(sub => sub.value);
    const sourceValues = sourceSubsNormalized
      .filter(subfield => codes.indexOf(subfield.code) !== -1)
      .map(sub => sub.value);
    debug(`baseValues: ${JSON.stringify(baseValues, undefined, 2)}`);
    debug(`sourceValues: ${JSON.stringify(sourceValues, undefined, 2)}`);

    if (sourceValues.every((val, index) => val === baseValues[index]) === false) {
      debug(`Field ${baseField.tag}: Subfield(s) ${codes} not matching in base and source, records not merged`);
      return base;
    }
    debug(`Field ${baseField.tag}: Matching subfield(s) ${codes} found in source and base, continuing with merge`);
    return base;
  }

  return base; // testing
}
