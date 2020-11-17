import chai from 'chai';
import fs from 'fs';
import path from 'path';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './field000';
import fixturesFactory, {READERS} from '@natlibfi/fixura';
import createDebugLogger from 'debug';

MarcRecord.setValidationOptions({subfieldValues: false});

describe('reducers/field000', () => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const {expect} = chai;
  const fixturesPath = path.join(__dirname, '..', '..', 'test-fixtures', 'reducers', 'field000');

  fs.readdirSync(fixturesPath).forEach(subDir => {
    const {getFixture} = fixturesFactory({root: [fixturesPath, subDir], reader: READERS.JSON, failWhenNotFound: false});
    it(subDir, () => {
      const base = new MarcRecord(getFixture('base.json'));
      const source = new MarcRecord(getFixture('source.json'));
      const tagPattern = new RegExp(getFixture({components: ['tagPattern.txt'], reader: READERS.TEXT}), 'u');
      debug(`tagPattern: ${tagPattern}`);
      const expectedRecord = getFixture('merged.json');
      const expectedError = getFixture({components: ['expected-error.txt'], reader: READERS.TEXT});
      // Bypass expected error in testing
      if (expectedError) {
        expect(() => createReducer.to.throw(Error, 'Leader'));
        return;
      }
      const mergedRecord = createReducer({tagPattern})(base, source);
      expect(mergedRecord.toObject()).to.eql(expectedRecord);
    });
  });
});
