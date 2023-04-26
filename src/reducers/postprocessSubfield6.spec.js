import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './postprocessSubfield6';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';

// import {nvdebug} from './utils';

describe('subfield 6 reindexing tests: ', () => {
  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'reducers', 'postprocessSubfield6'],
    recurse: false,
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
    const expectedRecord = getFixture('modifiedBase.json');
    const marcReducers = generateReducers(tagPattern, config);
    const modBaseAndSource = marcReducers(base, source);
    const modifiedBase = modBaseAndSource.base; // modBaseAndSource[modBaseAndSource.length - 1];
    expect(modifiedBase.toObject()).to.eql(expectedRecord);

    function generateReducers(tagPattern, config = {}) {
      if (tagPattern) { // eslint-disable-line functional/no-conditional-statements
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
