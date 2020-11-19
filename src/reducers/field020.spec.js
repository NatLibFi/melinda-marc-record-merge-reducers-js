import chai from 'chai';
import fs from 'fs';
import path from 'path';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './field020';
import fixturesFactory, {READERS} from '@natlibfi/fixura';
import createDebugLogger from 'debug';

MarcRecord.setValidationOptions({subfieldValues: false});

describe('reducers/field020', () => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const {expect} = chai;
  const fixturesPath = path.join(__dirname, '..', '..', 'test-fixtures', 'reducers', 'field020');

  fs.readdirSync(fixturesPath).forEach(subDir => {
    const {getFixture} = fixturesFactory({root: [fixturesPath, subDir], reader: READERS.JSON, failWhenNotFound: false});
    it(subDir, () => {
      const base = new MarcRecord(getFixture('base.json'));
      const source = new MarcRecord(getFixture('source.json'));
      const tagPattern = new RegExp(getFixture({components: ['tagPattern.txt'], reader: READERS.TEXT}), 'u');
      debug(`tagPattern: ${tagPattern}`);
      const expectedRecord = getFixture('merged.json');
      const mergedRecord = createReducer({tagPattern})(base, source);
      expect(mergedRecord.toObject()).to.eql(expectedRecord);
    });
  });
});
