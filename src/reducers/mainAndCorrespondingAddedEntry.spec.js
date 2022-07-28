import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './mainAndCorrespondingAddedEntry';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';

describe('genericDatafields tests: ', () => {
  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'reducers', 'mainEntries'],
    recurse: true,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: false,
      reader: READERS.JSON
    }
  });

  function callback({getFixture, tagPattern = false}) {
    const base = new MarcRecord(getFixture('base.json'), {subfieldValues: false});
    const source = new MarcRecord(getFixture('source.json'), {subfieldValues: false});
    const expectedRecord = getFixture('merged.json');
    const marcReducers = generateReducers(tagPattern);
    const mergedRecord = marcReducers(base, source);
    expect(mergedRecord.toObject()).to.eql(expectedRecord);

    function generateReducers(tagPattern) {
      if (tagPattern) {
        return createReducer({tagPattern});
      }

      return createReducer();
    }
  }
});
