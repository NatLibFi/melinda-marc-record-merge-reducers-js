import assert from 'node:assert';
import {describe} from 'node:test';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from '../../src/reducers/preprocessPrepublication.js';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';


describe('merge preprocess prepublication tests: ', () => {
  generateTests({
    callback,
    path: [import.meta.dirname, '..', '..', 'test-fixtures', 'reducers', 'preprocessPrepublication'],
    recurse: true,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: false,
      reader: READERS.JSON
    }
  });

  function callback({getFixture,
    tagPattern = false,
    config = undefined}) {
    const base = new MarcRecord(getFixture('base.json'), {subfieldValues: false});
    const source = new MarcRecord(getFixture('source.json'), {subfieldValues: false});
    const expectedRecord = getFixture('merged.json');
    const expectedModifiedSourceRecord = getFixture('modifiedSource.json');

    const marcReducers = generateReducers(tagPattern, config);
    const bothRecords = marcReducers(base, source);

    assert.deepEqual(bothRecords.base.toObject(), expectedRecord);
    assert.deepEqual(bothRecords.source.toObject(), expectedModifiedSourceRecord);

    function generateReducers(tagPattern, config) {


      /*
      if (tagPattern) {
        return createReducer({tagPattern});
      }
      return createReducer();
      */

      return createReducer(tagPattern, config);
    }
  }
});
