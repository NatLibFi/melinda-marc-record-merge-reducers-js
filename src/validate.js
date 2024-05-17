/* eslint-disable new-cap */
import validateFactory from '@natlibfi/marc-record-validate';
//import validateFactoryPunctuation from '@natlibfi/marc-record-validators-melinda/src/punctuation/';
import {
  FieldExclusion,
  //FieldStructure,
  //FieldsPresent,
  Punctuation,
  EmptyFields,
  EndingPunctuation,
  IsbnIssn,
  NormalizeUTF8Diacritics, // ex-./reducers/normalizeEncoding
  SubfieldExclusion
} from '@natlibfi/marc-record-validators-melinda';
//import {recordPreprocess} from './reducers/normalize';

//import NormalizeEncoding from './reducers/normalizeEncoding';
import NormalizeControlNumber from '@natlibfi/marc-record-validators-melinda/dist/normalize-identifiers';

// import normalizeSubfield9Linkage from './reducers/normalizeSubfield9Linkage';

import createDebugLogger from 'debug';

//import {recordPreprocess} from './reducers/normalize';
//import {fieldFixPunctuation} from './reducers/punctuation';

// ### Kopioitu täältä: https://github.com/NatLibFi/melinda-record-import-transformer-helmet
// ### Muokkaa vielä oikeat validaattorit mergeä varten
export default async () => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:validate');
  debug(`### Run validate`);
  const validate = validateFactory([
    await NormalizeUTF8Diacritics(), // procompose å & ä & ö. Decompose the rest.
    await NormalizeControlNumber(), // (FI-MELINDA)/FCC/(FIN01) normalizations
    //await normalizeSubfield9Linkage(), // merge linkage done by subfield $9 ^^ chains
    //await FieldsPresent([/^100$/u]), // not required by merge
    //await FieldsPresent([/^(100|110|111|130|700|710|711|730)$/]), // Helmet-specific rule? Skip...
    //await FieldsPresent([/^336$/u, /^337$/u]), // Comps don't always have 338, so don't require it. Add 245?
    await FieldExclusion([
      // /^(001|091|092|093|094|095|256|533|574|575|576|577|578|599)$/,

      {tag: /^041$/u, dependencies: [{leader: /^.{6}[g|i]/u}]},
      {tag: /^(?:648|650|651|655)$/u, subfields: [{code: /^2$/u, value: /^(?:ysa|musa|allars|cilla)$/u}]}
    ]),
    await EmptyFields(),
    await IsbnIssn({hyphenateISBN: true}),
    await SubfieldExclusion([
      {tag: /^041$/u, subfields: [{code: /^[ad]$/u, value: /^zxx$/u}]},
      {tag: /^02[04]$/u, subfields: [{code: /^c$/u, value: /^.*(?:€|£|\$|FIM).*$/u}]} // price info
    ]),
    //await FieldStructure([{tag: /^007$/u, dependencies: [{leader: /^.{6}[^at]/u}]}]),
    await Punctuation(),
    await EndingPunctuation()
  ]);
  //  const validatePunctuation = await validateFactoryPunctuation();

  return async (record, fix, validateFixes) => {
    const opts = fix ? {fix, validateFixes} : {fix}; // NV: The logic of this evades me.
    const result = await validate(record, opts);
    return {
      record: result.record,
      failed: result.valid === false,
      messages: result.report
    };
  };
};
