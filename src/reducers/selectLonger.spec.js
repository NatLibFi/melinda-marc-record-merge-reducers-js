import chai from 'chai';
import fs from 'fs';
import path from 'path';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './selectLonger';
import fixturesFactory, {READERS} from '@natlibfi/fixura';

MarcRecord.setValidationOptions({subfieldValues: false});

describe('reducers/selectLonger', () => {
  const {expect} = chai;
  const fixturesPath = path.join(__dirname, '..', '..', 'test-fixtures', 'reducers', 'selectLonger');

  fs.readdirSync(fixturesPath).forEach(subDir => {
    const {getFixture} = fixturesFactory({root: [fixturesPath, subDir], reader: READERS.JSON, failWhenNotFound: false});
    it(subDir, () => {
      const base = new MarcRecord(getFixture('base.json'));
      const source = new MarcRecord(getFixture('source.json'));
      const tagPattern = new RegExp(getFixture({components: ['pattern.txt'], reader: READERS.TEXT}), 'u');
      const expectedRecord = getFixture('merged.json');
      const mergedRecord = createReducer({tagPattern})(base, source);
      expect(mergedRecord.toObject()).to.eql(expectedRecord);
    });
  });
});
