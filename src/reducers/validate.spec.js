/**
* Copied from:
* Helmet record transformer for the Melinda record batch import system
*/

import fs from 'fs';
import path from 'path';
import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import createValidator from './validate';

const FIXTURES_PATH = path.join(__dirname, '../test-fixtures/validate'); // korjaa polku

describe('validate', () => {
	let validator;

	before(async () => {
		validator = await createValidator();
	});

	fs.readdirSync(path.join(FIXTURES_PATH, 'in')).forEach(file => {
		it(file, async () => {
			const record = new MarcRecord(JSON.parse(fs.readFileSync(path.join(FIXTURES_PATH, 'in', file), 'utf8')));

			const result = await validator(record, true, true);
			const expectedPath = path.join(FIXTURES_PATH, 'out', file);
			const formattedResult = {...result, record: result.record.toObject()};

			expect(formattedResult).to.eql(JSON.parse(fs.readFileSync(expectedPath, 'utf8')));
		});
	});
});