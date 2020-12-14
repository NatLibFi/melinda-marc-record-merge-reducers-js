/**
* Copied from:
* Helmet record transformer for the Melinda record batch import system
*/

/* eslint-disable new-cap */
import createDebugLogger from 'debug';
import validateFactory from '@natlibfi/marc-record-validate';
import {
	FieldStructure,
	SubfieldExclusion
} from '@natlibfi/marc-record-validators-melinda';

export default async () => {
	const debug = createDebugLogger('@natlibfi/melinda-record-import-transformer-helmet');
  const validate = validateFactory([
    // Subfield c is dropped
    await SubfieldExclusion([{tag: /^020$/, subfields: [{code: /c/}]}]),
    // Subfields a, c, and 6 are non-repeatable
		await FieldStructure([{
      tag: /^020$/,
      subfields: [
        {a: {maxOccurrence: 1}},
        {c: {maxOccurrence: 1}},
        {6: {maxOccurrence: 1}}
      ]}
    ])
  ]);
	return async (record, fix, validateFixes) => {
		const opts = fix ? {fix, validateFixes} : {fix};
		const result = await validate(record, opts);
		debug(`result: ${JSON.stringify(result, undefined, 2)}`);
		return {
			record: result.record,
			failed: result.valid === false,
			messages: result.report
		};
	};
};
