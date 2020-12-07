import createDebugLogger from 'debug';
import {normalizeSubfields, normalizeSubfieldValue, getFieldSpecs, compareSubValues} from './utils.js';

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^020$/);
  const sourceFields = source.get(/^020$/);
  //debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  //debug(`base.leader: ${base.leader}`);
  //debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);
  //debug(`source.leader: ${source.leader}`);

  // Since the arrays contain only one field at a time, they can be destructured into objects
  const [baseField] = baseFields;
  debug(`baseField: ${JSON.stringify(baseField, undefined, 2)}`);
  const [sourceField] = sourceFields;
  debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);

  // Get field specs from melindaCustomMergeFields.json
  const fieldSpecs = getFieldSpecs(baseField.tag);
  debug(`fieldSpecs: ${JSON.stringify(fieldSpecs, undefined, 2)}`);
  // Get arrays of repeatable and non-repeatable subfield codes from field specs
  const repCodes = fieldSpecs.subfields.filter(sub => sub.repeatable === "true").map(sub => sub.code);
  debug(`repCodes: ${JSON.stringify(repCodes, undefined, 2)}`);
  const nonRepCodes = fieldSpecs.subfields.filter(sub => sub.repeatable === "false").map(sub => sub.code);
  debug(`nonRepCodes: ${JSON.stringify(nonRepCodes, undefined, 2)}`);

  // Normalize subfield values for comparison
  const baseSubsNormalized = normalizeSubfields(baseField);
  debug(`baseSubsNormalized: ${JSON.stringify(baseSubsNormalized, undefined, 2)}`);
  const sourceSubsNormalized = normalizeSubfields(sourceField);
  debug(`sourceSubsNormalized: ${JSON.stringify(sourceSubsNormalized, undefined, 2)}`);

  // First check whether the values of significant subfields are equal
  // 020: $a (ISBN)
  const significantCodes = ["a"];

  // Test 09: If values are not equal, fields do not match and records are not merged at all
  if (compareSubValues(significantCodes, baseField, sourceField) === false) {
    debug(`Field ${baseField.tag}: One or more subfields (${significantCodes}) not matching in base and source, records not merged`);
    return base;
  }
  // If values are equal, continue with the merge process
  debug(`Field ${baseField.tag}: Matching subfields (${significantCodes}) found in source and base, continuing with merge`);

  // Test 10: If values of significant subfields are equal, copy other subfields from source field to base field
  // - If there are subfields to drop, do that first (020: $c)
  // - non-repeatable subfields are copied only if missing from base
  // (020: $a, $c, $6 --> but $a was already checked and $c dropped, so only $6 copied here)
  // - repeatable subfields are copied as additional instances (020: $q, $z, $8)
  // Create modified base field and replace old base record in Melinda with it (exception to general rule of data immutability)

  const dropCodes = ["c"];
  // It doesn't matter whether dropCodes or significantCodes are repeatable or not:
  // Both cases are automatically checked and if these subs are found, they are not copied
  const nonRepCodesToCopy = nonRepCodes.filter(code => (dropCodes.indexOf(code) === -1) && (significantCodes.indexOf(code) === -1));
  debug(`nonRepCodesToCopy: ${JSON.stringify(nonRepCodesToCopy, undefined, 2)}`);
  const nonRepSubsToCopy = sourceField.subfields.filter(subfield => nonRepCodesToCopy.indexOf(subfield.code) !== -1);
  debug(`nonRepSubsToCopy: ${JSON.stringify(nonRepSubsToCopy, undefined, 2)}`);
  const repCodesToCopy = repCodes.filter(code => (dropCodes.indexOf(code) === -1) && (significantCodes.indexOf(code) === -1));
  debug(`repCodesToCopy: ${JSON.stringify(repCodesToCopy, undefined, 2)}`);
  const repSubsToCopy = sourceField.subfields.filter(subfield => repCodesToCopy.indexOf(subfield.code) !== -1);
  debug(`repSubsToCopy: ${JSON.stringify(repSubsToCopy, undefined, 2)}`);

  // Filter out duplicate subfields from repSubs
  // Normalize values
  const baseFieldValues = normalizeSubfields(baseField).map(sub => sub.value);
  debug(`baseFieldValues: ${JSON.stringify(baseFieldValues, undefined, 2)}`);
  const repSubValues = repSubsToCopy.map(subfield => normalizeSubfieldValue(subfield.value));
  debug(`repSubValues: ${JSON.stringify(repSubValues, undefined, 2)}`);
  const nonDuplicateValues = repSubValues.filter(value => baseFieldValues.indexOf(value) === -1);
  debug(`nonDuplicateValues: ${JSON.stringify(nonDuplicateValues, undefined, 2)}`);

  const repSubsNonDuplicates = repSubsToCopy
    .map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}))
    .filter(subfield => nonDuplicates.indexOf(subfield.value) !== -1);
  debug(`repSubsNonDuplicates: ${JSON.stringify(repSubsNonDuplicates, undefined, 2)}`);
  // ###Miten tämän saa takaisin normalisoimattomaan muotoon jotta sen voi lisätä baseen?

//  const dropSubs = [{code: "c", value: /[\s\S]*/}];
  const dropSubs = [{code: "c", value: "10 €"}];
  debug(`dropSubs: ${JSON.stringify(dropSubs, undefined, 2)}`);
  debug(`testing: ${source.containsFieldWithValue('020', dropSubs)}`);
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

  return base; // testing
}
