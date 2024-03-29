import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './addField';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:addField:test');
const debugData = debug.extend('data');


describe('add data field tests: ', () => {
  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'reducers', 'addDataFields'],
    recurse: true,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: false,
      reader: READERS.JSON
    }
  });

  function callback({getFixture,
    config = undefined,
    tagPattern = false}) {
    const base = new MarcRecord(getFixture('base.json'), {subfieldValues: false});
    const source = new MarcRecord(getFixture('source.json'), {subfieldValues: false});
    const expectedRecord = getFixture('merged.json');
    const expectedModifiedSourceRecord = getFixture('modifiedSource.json');
    const marcReducers = generateReducers(tagPattern, config);
    const bothRecords = marcReducers(base, source);
    const mergedRecord = bothRecords.base;
    const modifiedSourceRecord = bothRecords.source;

    debugData(mergedRecord);
    //debugData(modifiedSourceRecord);

    expect(mergedRecord.toObject()).to.eql(expectedRecord);
    expect(modifiedSourceRecord.toObject()).to.eql(expectedModifiedSourceRecord);

    function generateReducers(tagPattern, config) {
      if (config && tagPattern) { // eslint-disable-line functional/no-conditional-statements
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
