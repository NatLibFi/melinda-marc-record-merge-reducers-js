import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './leader';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';

generateTests({
  callback,
  path: [__dirname, '..', '..', 'test-fixtures', 'reducers', 'leader'],
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
    const bothRecords = createReducer()({base, source});
    expect(bothRecords.source.toObject()).to.eql(expectedRecord);
  } catch (error) {
    if (expectedError) {
      expect(() => createReducer.to.throw(Error, 'LDR'));
      expect(error.message).to.eql(expectedError);
      return;
    }
  }
}
