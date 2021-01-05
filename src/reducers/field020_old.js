import createDebugLogger from 'debug';
import {normalizeSubfields, normalizeSubfieldValue, getFieldSpecs, compareAllSubValues, compareSomeSubValues} from './utils.js';

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
  const repCodes = fieldSpecs.subfields.filter(sub => sub.repeatable === 'true').map(sub => sub.code);
  debug(`repCodes: ${JSON.stringify(repCodes, undefined, 2)}`);
  const nonRepCodes = fieldSpecs.subfields.filter(sub => sub.repeatable === 'false').map(sub => sub.code);
  debug(`nonRepCodes: ${JSON.stringify(nonRepCodes, undefined, 2)}`);

  // Normalize subfield values for comparison
  const baseSubsNormalized = normalizeSubfields(baseField);
  debug(`baseSubsNormalized: ${JSON.stringify(baseSubsNormalized, undefined, 2)}`);
  const sourceSubsNormalized = normalizeSubfields(sourceField);
  debug(`sourceSubsNormalized: ${JSON.stringify(sourceSubsNormalized, undefined, 2)}`);

  // First check whether the values of identifying subfields are equal
  // Identifying subfields define the uniqueness of the record: if they are different, the records cannot be merged
  // 020: $a (ISBN)
  const idCodes = ['a'];

  // Test 09: If values are not equal, fields do not match and records are not merged at all
  if (compareAllSubValues(idCodes, baseField, sourceField) === false) {
    debug(`Field ${baseField.tag}: One or more subfields (${idCodes}) not matching in base and source, records not merged`);
    return base;
  }
  // If values are equal, continue with the merge process
  debug(`Field ${baseField.tag}: Matching subfields (${idCodes}) found in source and base, continuing with merge`);

  const test = compareSomeSubValues(repCodes, baseField, sourceField);
  debug(`test: ${JSON.stringify(test, undefined, 2)}`);

  // Test 10: If values of identifying subfields are equal, copy other subfields from source field to base field
  // - If there are subfields to drop, do that first (020: $c)
  // - non-repeatable subfields are copied only if missing from base
  // (020: $a, $c, $6 --> but $a was already checked and $c dropped, so only $6 copied here)
  // - repeatable subfields are copied as additional instances (020: $q, $z, $8)
  // Create modified base field and replace old base record in Melinda with it (exception to general rule of data immutability)

  //const dropCodes = ["c"];
  // It doesn't matter whether dropCodes or idCodes are repeatable or not:
  // Both cases are automatically checked and if these subs are found, they are not copied
  //const copyNonRepCodes = nonRepCodes.filter(code => (dropCodes.indexOf(code) === -1) && (idCodes.indexOf(code) === -1));
  //debug(`copyNonRepCodes: ${JSON.stringify(copyNonRepCodes, undefined, 2)}`);

  //getNonRepSubsToCopy(sourceField, nonRepCodes, dropCodes, idCodes);
  //debug(`getNonRepSubsToCopy: ${JSON.stringify(getNonRepSubsToCopy(sourceField, nonRepCodes, dropCodes, idCodes), undefined, 2)}`);

  // Non-repeatables subfields to copy: filter out dropped and identifying subfields
  /*function getNonRepSubsToCopy(sourceField, nonRepCodes, dropCodes, idCodes) {
    const nonRepSubsToCopy = sourceField.subfields
    .filter(subfield => nonRepCodes
      .filter(code => (dropCodes.indexOf(code) === -1) && (idCodes.indexOf(code) === -1)).indexOf(subfield.code) !== -1);
    return nonRepSubsToCopy;
  }*/

  /*  const copyNonRepSubs = sourceField.subfields
    .filter(subfield => nonRepCodes
      .filter(code => (dropCodes.indexOf(code) === -1) && (idCodes.indexOf(code) === -1)).indexOf(subfield.code) !== -1);
  debug(`copyNonRepSubs: ${JSON.stringify(copyNonRepSubs, undefined, 2)}`);*/

  //const copyRepCodes = repCodes.filter(code => (dropCodes.indexOf(code) === -1) && (idCodes.indexOf(code) === -1));
  //debug(`copyRepCodes: ${JSON.stringify(copyRepCodes, undefined, 2)}`);
  /*const copyRepSubs = sourceField.subfields
    .filter(subfield => repCodes
      .filter(code => (dropCodes.indexOf(code) === -1) && (idCodes.indexOf(code) === -1)).indexOf(subfield.code) !== -1);
  debug(`copyRepSubs: ${JSON.stringify(copyRepSubs, undefined, 2)}`);*/

  //getRepSubsToCopy(sourceField, baseField, repCodes, dropCodes, idCodes);
  //debug(`getRepSubsToCopy: ${JSON.stringify(getRepSubsToCopy(sourceField, baseField, repCodes, dropCodes, idCodes), undefined, 2)}`);

  // Repeatable subfields to copy: filter out dropped, identifying, and duplicate subfields
  /*function getRepSubsToCopy(sourceField, baseField, repCodes, dropCodes, idCodes) {
    const repSubsToCopy = sourceField.subfields
    .filter(subfield => repCodes
      .filter(code => (dropCodes.indexOf(code) === -1) && (idCodes.indexOf(code) === -1)).indexOf(subfield.code) !== -1);
    const uniques = repSubsToCopy
    .map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}))
    .filter(subfield => repSubsToCopy.map(subfield => normalizeSubfieldValue(subfield.value))
      .filter(value => normalizeSubfields(baseField)
      .map(sub => sub.value).indexOf(value) === -1).indexOf(subfield.value) !== -1);
    return uniques;
  }*/

  // Filter out duplicate subfields from repSubs
  // Normalize values
  //const baseFieldValues = normalizeSubfields(baseField).map(sub => sub.value);
  //debug(`baseFieldValues: ${JSON.stringify(baseFieldValues, undefined, 2)}`);
  //const repSubValues = repSubsToCopy.map(subfield => normalizeSubfieldValue(subfield.value));
  //debug(`repSubValues: ${JSON.stringify(repSubValues, undefined, 2)}`);
  //const nonDuplicateValues = repSubsToCopy
  //  .map(subfield => normalizeSubfieldValue(subfield.value))
  //  .filter(value => normalizeSubfields(baseField).map(sub => sub.value).indexOf(value) === -1);
  //debug(`nonDuplicateValues: ${JSON.stringify(nonDuplicateValues, undefined, 2)}`);


  //const uniques =

  //debug(`uniqueCopyRepSubs: ${JSON.stringify(uniqueCopyRepSubs, undefined, 2)}`);

  const dropSubs = [{code: 'c', value: '10 €'}];
  debug(`dropSubs: ${JSON.stringify(dropSubs, undefined, 2)}`);
  debug(`value: ${dropSubs.map(sub => sub.value)}`);
  debug(`containsFieldWithValue: ${source.containsFieldWithValue('020', dropSubs)}`);

  //const regexp = /^10 €$/u;
  //const dropSubsRegexp = [{code: "c", value: /^10 €$/u}];
  //debug(`dropSubsRegexp: ${JSON.stringify(dropSubsRegexp, undefined, 2)}`);
  //debug(`value: ${dropSubsRegexp.map(sub => sub.value)}`);
  debug(`containsFieldWithValue testi: ${source.containsFieldWithValue('020', [{code: 'c', value: /(10 €)/u}])}`);
  const [field] = source.getFields('020', [{code: 'c', value: /^10/u}]);
  debug(`field: ${JSON.stringify(field, undefined, 2)}`);

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
};
