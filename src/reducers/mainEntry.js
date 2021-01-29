import createDebugLogger from 'debug';


import {
  //getTagString,
  getRepCodes,
  getNonRepCodes,
  compareAllSubfields,
  getRepSubs,
  getNonRepSubs,
  modifyBaseField,
  sortSubfields
} from './utils.js';

// Test 01: Source and base have 100, source also has 245

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  // All fields used for main entry, all non-repeatable
  const fieldTag = /^(100|110|111|130|240|245)$/u; // Tag in regexp format (for use in MarcRecord functions)
  const baseFields = base.get(fieldTag); // Get array of base fields
  debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  const sourceFields = source.get(fieldTag); // Get array of source fields
  debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  const baseTags = baseFields.map(field => field.tag);
  debug(`baseTags: ${JSON.stringify(baseTags, undefined, 2)}`);
  const sourceTags = sourceFields.map(field => field.tag);
  debug(`sourceTags: ${JSON.stringify(sourceTags, undefined, 2)}`);

  // ###Saatava tarkemmat speksit miten pääkirjauskenttiä käsitellään
  // 110: a b n d c e
  // 246 ja 700/730/775/776-kentissä i-osakenttä tulee ennen atz-kenttiä
  // Varmaan noi numerot ok, mutta 775- ja 776-kentässä näyttäisi olevan i a t d jne.
  // 710-kentän järjestys on muuten a b n d e
  // Kantsii katsoa myös 111- ja 711-kentät
  // Toimijakirjauskentät:
  // 100,110,111,600,610,611,700,710,711 mahdollisesti myös 800,810,811 ja 900,910,911 - riippuen vähän kontekstista
  // Noi $n:t on muuten noissa toimijakirjauskentässä sit riesa, koska ne voi olla osa sitä toimijannimiosaa tai sitten nimekeosaa
  // eli noissa pitää, jos rupeaa järjestelemään, niin joko ottaa riski siitä, että kentän merkitykset hajoo tai sit kirjoittaa monimutkaisempaa koodia, joka pilkkoo kentän eka noihin osiin ja järjestelee sitten osakenttiä niiden sisäisesti
  // $i tulee tosiaan (erityisesti tossa 7XX-sarjassa) kentän alkupuolelle

  // Possible combinations of fields:
  // 100/110/111 + 240 + 245
  // 130 + 245
  // 100/110/111/130 + 245
  // 245

  // Check that only valid field combinations are present in the source record
  // (It is assumed that the existing Melinda record is correct)
  if (sourceFields.length > 1) {
    const isValid = checkMainEntryFields(sourceTags);
    if (isValid === false) {
      // If source main entry is invalid, return existing Melinda field
      return base;
    }
    // If source main entry is valid, continue with merge
    return;
  }

  function checkMainEntryFields(sourceTags) {
    const allowedCombinations = [
      ["100", "240", "245"],
      ["110", "240", "245"],
      ["111", "240", "245"],
      ["100", "245"],
      ["110", "245"],
      ["111", "245"],
      ["130", "245"],
      ["245"]
    ];
    const sorted = JSON.stringify(sourceTags.sort()); // in case the fields/tags are not in correct order
    const allowedStringified = allowedCombinations.map(item => JSON.stringify(item));
    if(allowedStringified.indexOf(sorted) === -1) {
      debug(`Combination of fields invalid for main entry`);
      return false;
    }
    debug(`Combination of fields valid for main entry`);
    return true;
  }

  // Get arrays of repeatable and non-repeatable subfield codes from melindaCustomMergeFields.json
/*  const repCodes = getRepCodes(tagString);
  const nonRepCodes = getNonRepCodes(tagString);

  // If there are multiple instances of the field in source and/or base
  if (sourceFields.length > 1 || baseFields.length > 1) {
    // Iterate through all fields in base and source arrays
    const outerLoop = sourceFields.map(sourceField => {
      const innerLoop = baseFields.map(baseField => repeatableField(base, tagString, baseField, sourceField, repCodes, nonRepCodes));
      // Destructure array returned by innerLoop into object to pass to outerLoop
      const [tempObj] = innerLoop;
      return tempObj;
    });
    // The outer loop returns an array with as many duplicate objects as there are fields
    // Filter out duplicates and return only one result object in MarcRecord format
    const stringified = outerLoop.map(obj => JSON.stringify(obj));
    const filtered = JSON.parse(stringified.filter((item, index) => stringified.indexOf(item) >= index));
    return new MarcRecord(filtered);
  }

  // Default case: there is just one instance of the field in both source and base
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // Run the function to get the base record to return
  return repeatableField(base, tagString, baseField, sourceField, repCodes, nonRepCodes);


  function repeatableField(base, tagString, baseField, sourceField, repCodes, nonRepCodes) {
    debug(`Working on field ${tagString}`);
    // First check whether the values of identifying subfields are equal
    // 020: $a (ISBN)
    const idCodes = ['a'];

    // Case 1: If all identifying subfield values are not equal the entire source field is copied to base as a new field
    if (compareAllSubfields(baseField, sourceField, idCodes) === false) {
      //debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);
      base.insertField(sourceField);
      debug(`Base after copying: ${JSON.stringify(base, undefined, 2)}`);
      debug(`Field ${tagString}: One or more subfields (${idCodes}) not matching, source field copied as new field to Melinda`);
      return base; // Base record returned in case 1
    }

    // Case 2: If identifying subfield values are equal, continue with the merge process
    debug(`Field ${tagString}: Matching subfields (${idCodes}) found in source and Melinda, continuing with merge`);

    // If there are subfields to drop, define them first
    // 020: $c
    const dropCodes = ['c'];

    // Copy other subfields from source field to base field
    // For non-repeatable subfields, the value existing in base (Melinda) is preferred
    // Non-repeatable subfields are copied from source only if missing completely in base
    // 020: $a, $c, $6 (but $a was already checked and $c dropped, so only $6 is copied here)
    const nonRepSubsToCopy = getNonRepSubs(sourceField, nonRepCodes, dropCodes, idCodes);
    //debug(`nonRepSubsToCopy: ${JSON.stringify(nonRepSubsToCopy, undefined, 2)}`);

    // Repeatable subfields are copied if the value is different
    // 020: $q, $z, $8
    const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes, dropCodes, idCodes);
    //debug(`repSubsToCopy: ${JSON.stringify(repSubsToCopy, undefined, 2)}`);

    // Create modified base field and replace old base record in Melinda with it (exception to general rule of data immutability)
    // Subfields in the modified base field are arranged by default in alphabetical order (a-z, 0-9)
    // To use a different sorting order, set it as the second parameter in sortSubfields
    // Example: copy subfield sort order from source field
    // const orderFromSource = sourceField.subfields.map(subfield => subfield.code);

    const modifiedBaseField = JSON.parse(JSON.stringify(baseField));
    const sortedSubfields = sortSubfields([...baseField.subfields, ...nonRepSubsToCopy, ...repSubsToCopy]);
    /* eslint-disable functional/immutable-data */
    /*modifiedBaseField.subfields = sortedSubfields;
    modifyBaseField(base, baseField, modifiedBaseField);
    debug(`Base after modification: ${JSON.stringify(base, undefined, 2)}`);
    return base; // Base record returned in case 2
  }*/
  return base;
};
