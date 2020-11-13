import chai from 'chai';
import fs from 'fs';
import path from 'path';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './field006';
import fixturesFactory, {READERS} from '@natlibfi/fixura';
import createDebugLogger from 'debug';

MarcRecord.setValidationOptions({subfieldValues: false});

describe('reducers/field006', () => {
  const debug = createDebugLogger('@natlibfi/marc-record-merge');
  const {expect} = chai;
  const fixturesPath = path.join(__dirname, '..', '..', 'test-fixtures', 'reducers', 'field006');

  fs.readdirSync(fixturesPath).forEach(subDir => {
    const {getFixture} = fixturesFactory({root: [fixturesPath, subDir], reader: READERS.JSON, failWhenNotFound: false});
    it(subDir, () => {
      const base = new MarcRecord(getFixture('base.json'));
      const source = new MarcRecord(getFixture('source.json'));
      //const tagPattern = new RegExp(getFixture({components: ['tagPattern.txt'], reader: READERS.TEXT}), 'u');
      //const compareTagsOnly = getCompareTagsOnly();
      //const excludeSubfields = getExcludeSubfields();
      const expectedRecord = getFixture('merged.json');
      //const mergedRecord = createReducer({tagPattern, compareTagsOnly, excludeSubfields})(base, source);
      const mergedRecord = createReducer(/^006$/)(base, source);
      expect(mergedRecord.toObject()).to.eql(expectedRecord);

      // Non-repeatable MARC fields are copied from source only if they are missing from base
      /*function getCompareTagsOnly() {
        const functionName = getFixture({components: ['compareTagsOnly.txt'], reader: READERS.TEXT});
        return functionName === 'true' ? 'true' : undefined;
      }
      // Check whether excludeSubfields.json exists and if it does, return its contents. If not, do nothing.
      function getExcludeSubfields() {
        const subfieldsToExclude = getFixture({components: ['excludeSubfields.json'], reader: READERS.JSON});
        return subfieldsToExclude ? subfieldsToExclude : undefined;
      }*/
    });
  });
});
