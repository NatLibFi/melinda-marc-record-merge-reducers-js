import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './normalizeSubfield9Linkage';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';
import {nvdebug} from './utils';

describe('normalizeSubfield9Linkage tests: ', () => {
  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'reducers', 'subfield9Linkage'],
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
    nvdebug('FFS WP 660');
    const expectedRecord = getFixture('merged.json');
    const expectedModifiedSourceRecord = getFixture('modifiedSource.json');
    const marcReducers = generateReducers(tagPattern, config);
    nvdebug('FFS WP 663');
    const both = marcReducers({base, source});
    const mergedRecord = both.base;
    const modifiedSourceRecord = both.source;
    nvdebug('FFS WP 664');
    expect(mergedRecord.toObject()).to.eql(expectedRecord);
    nvdebug('FFS WP 666');
    expect(modifiedSourceRecord.toObject()).to.eql(expectedModifiedSourceRecord);

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
