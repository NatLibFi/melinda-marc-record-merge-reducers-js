import assert from 'node:assert';
import {describe} from 'node:test';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from '../../src/reducers/normalizeSubfield9Linkage.js';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';
import {nvdebug} from '../../src/reducers/utils.js';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:normalizeSubfield9Linkage:test');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

describe('normalizeSubfield9Linkage tests: ', () => {
  generateTests({
    callback,
    path: [import.meta.dirname, '..', '..', 'test-fixtures', 'reducers', 'subfield9Linkage'],
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
    nvdebug('FFS WP 660', debugDev);
    const expectedRecord = getFixture('merged.json');
    const expectedModifiedSourceRecord = getFixture('modifiedSource.json');
    const marcReducers = generateReducers(tagPattern, config);
    nvdebug('FFS WP 663', debugDev);
    const both = marcReducers(base, source);
    const mergedRecord = both.base;
    const modifiedSourceRecord = both.source;
    nvdebug('FFS WP 664', debugDev);
    assert.deepEqual(mergedRecord.toObject(), expectedRecord);
    nvdebug('FFS WP 666', debugDev);
    assert.deepEqual(modifiedSourceRecord.toObject(), expectedModifiedSourceRecord);

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
