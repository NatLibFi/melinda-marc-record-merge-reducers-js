import assert from 'node:assert';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './leader.js';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';

generateTests({
  callback,
  path: [import.meta.dirname, '..', '..', 'test-fixtures', 'reducers', 'leader'],
  recurse: false,
  useMetadataFile: true,
  fixura: {
    failWhenNotFound: false,
    reader: READERS.JSON
  }
});

function callback({getFixture, expectedError = false}) {
  const base = new MarcRecord(getFixture('base.json'), {subfieldValues: false});
  const source = new MarcRecord(getFixture('source.json'), {subfieldValues: false});
  const expectedRecord = getFixture('merged.json');
  try {
    const bothRecords = createReducer()(base, source);
    assert.deepEqual(bothRecords.source.toObject(), expectedRecord);
  } catch (error) {
    assert.equal(error instanceof Error, true);
    if (expectedError) {
      //expect(() => createReducer.to.throw(Error, 'LDR')); // Not sure about this
      assert.equal(error.message, expectedError);
      return;
    }
  }
}
