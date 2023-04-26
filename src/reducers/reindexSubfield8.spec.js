import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './reindexSubfield8';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';
//import {nvdebug} from './utils';

describe('subfield 8 reindexing tests: ', () => {
  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'reducers', 'reindexSubfield8'],
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
    //nvdebug('SF8 WP8', debug);
    const expectedRecord = getFixture('modifiedSource.json');
    //nvdebug('SF8 WP9', debug);
    const marcReducers = generateReducers(tagPattern, config);
    //nvdebug('SF8 WP10', debug);
    const modBaseAndSource = marcReducers(base, source);
    //nvdebug('SF8 WP11', debug);
    const modifiedSource = modBaseAndSource.source; //modBaseAndSource[modBaseAndSource.length - 1];
    expect(modifiedSource.toObject()).to.eql(expectedRecord);

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
