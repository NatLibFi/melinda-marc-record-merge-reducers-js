//import createDebugLogger from 'debug';
//import {MarcRecord} from '@natlibfi/marc-record';
//import {/*fieldToString,*/ nvdebug} from './utils';
//import {initFieldMergeConfig} from './fieldMergeConfig';

//const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
//const debugData = debug.extend('data');

import fieldExclusion from '@natlibfi/marc-record-validators-melinda/dist/field-exclusion';
import subfieldExclusion from '@natlibfi/marc-record-validators-melinda/dist/subfield-exclusion';
import isbnIssn from '@natlibfi/marc-record-validators-melinda/dist/isbn-issn';

export default () => (base, source) => {
  return [base, externalFixes(source)];

  function externalFixes(record) {
    //externalFieldsPresent(record, [/^336$/u, /^337$/u], true); // Comps don't always have 338
    //await FieldsPresent([/^336$/u, /^337$/u, /^338$/u]), // Comps don't always have 338

    const fieldExcluder = fieldExclusion([
      // /^(001|091|092|093|094|095|256|533|574|575|576|577|578|599)$/,
      //{tag: /^264$/, subfields: [{code: /^a$/, value: /^\[.*\]$/}]}, // Not sure about this either
      //{tag: /^650$/, subfields: [{code: /^a$/, value: /^overdrive$/i}]}, // Not sure what this is
      //{tag: /^041$/u, dependencies: [{leader: /^.{6}[g|i]/u}]},
      {tag: /^(?:648|650|651|655)$/u, subfields: [{code: /^2$/u, value: /^(?:ysa|musa|allars|cilla)$/u}]}
    ]);

    fieldExcluder.fix(record);

    const subfieldExcluder = subfieldExclusion([
      {tag: /^041$/u, subfields: [{code: /^[ad]$/u, value: /^zxx$/u}]},
      {tag: /^02[04]$/u, subfields: [{code: /^c$/u, value: /^.*(?:€|£|\$|FIM).*$/u}]} // price info
    ]);

    subfieldExcluder.fix(record);

    const addHyphensToISBN = isbnIssn({hyphenateISBN: true});

    addHyphensToISBN.fix(record);

    /*
    await EmptyFields(),
    await IsbnIssn({hyphenateISBN: true}),
    await SubfieldExclusion([
      {tag: /^041$/u, subfields: [{code: /^[ad]$/u, value: /^zxx$/u}]},
      {tag: /^02[04]$/u, subfields: [{code: /^c$/u, value: /^.*(?:€|£|\$|FIM).*$/u}]} // price info
    ]),
    //await FieldStructure([{tag: /^007$/u, dependencies: [{leader: /^.{6}[^at]/u}]}]),
    await Punctuation(),
    await EndingPunctuation()
    */

    //const max6 = getMaxSubfield6(baseRecord);
    //const max8 = getMaxSubfield8(baseRecord);
    //nvdebug(`MAX8 FROM BASE: ${max8}`);
    //reindexSubfield6s(sourceRecord, max6);
    //reindexSubfield8s(sourceRecord, max8);


    // Base has 1XX fields. Retag source's 1XX fields
    const source1XX = record.get(/^1..$/u);
    source1XX.forEach(field => retagField(field));

    function retagField(field) {
      const newTag = `7${field.tag.substring(1)}`;
      //nvdebug(`Retag ${field.tag} => ${newTag}`);
      field.tag = newTag; // eslint-disable-line functional/immutable-data
    }

    return record;
  }
};
