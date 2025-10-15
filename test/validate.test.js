import assert from 'node:assert';
import {MarcRecord} from '@natlibfi/marc-record';
import createValidator from '../src/validate.js';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';

generateTests({
  callback,
  path: [import.meta.dirname, '..', 'test-fixtures', 'validate'],
  recurse: false,
  useMetadataFile: true,
  fixura: {
    failWhenNotFound: false,
    reader: READERS.JSON
  }
});

async function callback({getFixture}) {
  const validator = await createValidator();

  const record = new MarcRecord(getFixture('record.json'), {subfieldValues: false});
  const expectedResult = getFixture('expectedResult.json');
  const result = await validator(record, true, true);
  const formattedResult = {...result, record: result.record.toObject()};

  assert.deepEqual(formattedResult, expectedResult);
}
