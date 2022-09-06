import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './field006';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';

generateTests({
  callback,
  path: [__dirname, '..', '..', 'test-fixtures', 'reducers', 'field006'],
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
  expect(mergedRecord.toObject()).to.eql(expectedRecord);
}
