import createDebugLogger from 'debug';
import {normalizeSync} from 'normalize-diacritics';
import fs from 'fs';
import path from 'path';
import {MarcRecord} from '@natlibfi/marc-record';

export default ({tagPattern}) => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(tagPattern);
  const sourceFields = source.get(tagPattern);
  /*debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  debug(`base.leader: ${base.leader}`);
  debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);
  debug(`source.leader: ${source.leader}`);*/

  const [baseField] = baseFields;
  debug(`baseField: ${JSON.stringify(baseField, undefined, 2)}`);
  const [sourceField] = sourceFields;
  debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);

  // Normalize subfield values
  const baseSubsNormalized = baseField.subfields
    .map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}));
  const sourceSubsNormalized = sourceField.subfields
    .map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}));

  // Get field details from melindaCustomMergeFields.json
  const melindaFields = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'melindaCustomMergeFields.json'), 'utf8'));
  const [fieldDetails] = melindaFields.fields.filter(field => field.tag === baseField.tag);
  debug(`fieldDetails: ${JSON.stringify(fieldDetails, undefined, 2)}`);
  // Data to compare between base and source fields
  const dataToCompare = {
    tag: baseField.tag,
    repSubs: fieldDetails.subfields.filter(sub => sub.repeatable === "true").map(sub => sub.code),
    nonRepSubs: fieldDetails.subfields.filter(sub => sub.repeatable === "false").map(sub => sub.code)
  };
  debug(`dataToCompare: ${JSON.stringify(dataToCompare, undefined, 2)}`);

  //checkSubfields(dataToCompare);

  // First check whether the values of significant subfields are equal
  // If not, fields do not match and records are not merged at all
  // 020: $a (ISBN)

  const significantCodes = ["a"];
  compareSignificantSubs(significantCodes);

  function compareSignificantSubs(codes) {
    const compareBaseValues = baseSubsNormalized
      .filter(subfield => codes.indexOf(subfield.code) !== -1)
      .map(sub => sub.value);
    const compareSourceValues = sourceSubsNormalized
      .filter(subfield => codes.indexOf(subfield.code) !== -1)
      .map(sub => sub.value);
    debug(`compareBaseValues: ${JSON.stringify(compareBaseValues, undefined, 2)}`);
    debug(`compareSourceValues: ${JSON.stringify(compareSourceValues, undefined, 2)}`);

    // Test 09: If values of significant subfields are different, do not merge
    if (arrayEquals(compareBaseValues, compareSourceValues) === false) {
      debug(`Field ${baseField.tag} does not match in base and source, records not merged`);
      return base;
    }

    // https://masteringjs.io/tutorials/fundamentals/compare-arrays
    function arrayEquals(a, b) {
      return Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((val, index) => val === b[index]);
    }
  }
  /* verrataan osakenttää ‡a > jos eri, tietueita ei yhdistetä vaan tuodaan se uutena
  väliviivoja ei huomioida vertailussa
  Niin, että kun se $a matchaa, niin pidetään pohja(Melinda) -tietueen kenttä,
  ja lisätään siihen lähdetietueesta ne osakentät mitä siinä ei oo
  Niitä pitää ehkä myös järjestää jotenkin fiksusti
  sit jos se $a ei matchaa, niin tuodaan koko kenttä
  */

  // Test 10: If values of significant subfields are equal, copy other subfields from source field to base field
  // - subfields to drop (c)
  // - non-repeatable subfields (6) only if missing from base
  // - repeatable subfields (q, z, 8) as additional copies
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

  /*function checkSubfields(obj) {
    /*const testTag = obj.tag;
    const testRepSubs = obj.repSubs;
    const testNonRepSubs = obj.nonRepSubs;
    debug(`testTag: ${testTag}`);
    debug(`testRepSubs: ${JSON.stringify(testRepSubs, undefined, 2)}`);
    debug(`testNonRepSubs: ${JSON.stringify(testNonRepSubs, undefined, 2)}`);*/
    /*base.containsFieldWithValue(obj.tag, [{code: 'a'}]);
    return;
  }



  if (baseSubValue === sourceSubValue) {
      const dropSubs = ["c"];
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


  function isIdenticalSubfield(baseSub) {
      const normBaseSub = normalizeSubfield(baseSub);
      return sourceField.subfields.some(sourceSub => {
        const normSourceSub = normalizeSubfield(sourceSub);
        return normSourceSub === normBaseSub;
      });
  }

  function replaceBasefieldWithModifiedBasefield(base) {
      const index = base.fields.findIndex(field => field === baseField);
      base.fields.splice(index, 1, modifiedBasefield); // eslint-disable-line functional/immutable-data
      debug(`Adding new subfields to ${baseField.tag}`);
      return base;
  }*/
  function normalizeSubfieldValue(value) {
    // Regexp options: g: global search, u: unicode
    const punctuation = /[.,\-/#!$%^&*;:{}=_`~()[\]]/gu;
    return normalizeSync(value).toLowerCase().replace(punctuation, '', 'u').replace(/\s+/gu, ' ').trim();
  }
  return base; // testing
}
