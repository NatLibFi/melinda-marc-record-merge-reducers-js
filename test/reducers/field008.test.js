import assert from 'node:assert';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from '../../src/reducers/field008.js';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';

generateTests({
  callback,
  path: [import.meta.dirname, '..', '..', 'test-fixtures', 'reducers', 'field008'],
  recurse: false,
  useMetadataFile: true,
  fixura: {
    failWhenNotFound: false,
    reader: READERS.JSON
  }
});

function callback({getFixture}) {
  const base = new MarcRecord(getFixture('base.json'), {subfieldValues: false});
  const source = new MarcRecord(getFixture('source.json'), {subfieldValues: false});
  const expectedRecord = getFixture('merged.json');
  const bothRecords = createReducer()(base, source);
  const mergedRecord = bothRecords.base;
  assert.deepEqual(mergedRecord.toObject(), expectedRecord);
}
