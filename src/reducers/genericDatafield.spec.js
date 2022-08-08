import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './genericDatafield';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';

describe('genericDatafields tests: ', () => {
  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'reducers', 'genericDatafields'],
    recurse: true,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: false,
      reader: READERS.JSON
    }
  });

  function callback({getFixture,
    config = {},
    tagPattern = false}) {
    const base = new MarcRecord(getFixture('base.json'), {subfieldValues: false});
    const source = new MarcRecord(getFixture('source.json'), {subfieldValues: false});
    const expectedRecord = getFixture('merged.json');
    const marcReducers = generateReducers(tagPattern, config);
    const mergedRecord = marcReducers(base, source);
    expect(mergedRecord.toObject()).to.eql(expectedRecord);

    function generateReducers(tagPattern, config = {}) {
      if (tagPattern) { // eslint-disable-line functional/no-conditional-statement
        config.tagPattern = tagPattern; // eslint-disable-line functional/immutable-data
      }

      /*
      if (tagPattern) {
        return createReducer({tagPattern});
      }
      return createReducer();
      */

      return createReducer(config);
    }
  }
});
