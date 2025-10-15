import assert from 'node:assert';
import {describe} from 'node:test';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './transferManufacturerDataFrom260To264.js';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';

// import {nvdebug} from './utils';

describe('subfield 6 reindexing tests: ', () => {
  generateTests({
    callback,
    path: [import.meta.dirname, '..', '..', 'test-fixtures', 'reducers', 'manufacturer260'],
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
    const expectedRecord = getFixture('modifiedSource.json');
    const marcReducers = generateReducers(tagPattern, config);
    const modBaseAndSource = marcReducers(base, source);
    const modifiedSource = modBaseAndSource.source; // modBaseAndSource[modBaseAndSource.length - 1];
    assert.deepEqual(modifiedSource.toObject(), expectedRecord);

    function generateReducers(tagPattern, config = {}) {
      if (tagPattern) {
        config.tagPattern = tagPattern;
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
