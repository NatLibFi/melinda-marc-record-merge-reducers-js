import assert from 'node:assert';
import {MarcRecord} from '@natlibfi/marc-record';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';
import createReducer from './field007.js';
//import createDebugLogger from 'debug';

generateTests({
  callback,
  path: [import.meta.dirname, '..', '..', 'test-fixtures', 'reducers', 'field007'],
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
  assert.deepEqual(bothRecords.base.toObject(), expectedRecord);
}
