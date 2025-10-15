import assert from 'node:assert';
import {describe} from 'node:test';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './postprocessor.js';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';
import fs from 'fs';
import path from 'path';

const defaultConfig = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));


describe('source preprocessor tests: ', () => {
  generateTests({
    callback,
    path: [import.meta.dirname, '..', '..', 'test-fixtures', 'reducers', 'postprocess'],
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
    assert.deepEqual(mergedRecord.toObject(), expectedRecord);
    assert.deepEqual(modifiedSourceRecord.toObject(), expectedModifiedSourceRecord);

    function generateReducers(config) {
      return createReducer(config);
    }
  }
});
