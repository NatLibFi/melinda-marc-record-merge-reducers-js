import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './preprocessor';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';
import fs from 'fs';
import path from 'path';

const defaultConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));


describe('source preprocessor tests: ', () => {
  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'reducers', 'preprocessSource'],
    recurse: false,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: false,
      reader: READERS.JSON
    }
  });

  function callback({getFixture,
    config = defaultConfig}) {
    const base = new MarcRecord(getFixture('base.json'), {subfieldValues: false});
    const source = new MarcRecord(getFixture('source.json'), {subfieldValues: false});
    const expectedRecord = getFixture('merged.json');
    const expectedModifiedSourceRecord = getFixture('modifiedSource.json');
    const marcReducers = generateReducers(config);
    const bothRecords = marcReducers(base, source);
    const mergedRecord = bothRecords.base;
    const modifiedSourceRecord = bothRecords.source;
    expect(mergedRecord.toObject()).to.eql(expectedRecord);
    expect(modifiedSourceRecord.toObject()).to.eql(expectedModifiedSourceRecord);

    function generateReducers(config) {
      return createReducer(config);
    }
  }
});
