import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './field26X';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';


describe('merge data field tests: ', () => {
  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'reducers', 'field26X'],
    recurse: false,
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
    const mergedRecord = bothRecords.base;
    const modifiedSourceRecord = bothRecords.source;
    //const [mergedRecord, modifiedSourceRecord] = marcReducers(base, source);
    expect(mergedRecord.toObject()).to.eql(expectedRecord);
    expect(modifiedSourceRecord.toObject()).to.eql(expectedModifiedSourceRecord);

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
