import assert from 'node:assert';
import {describe, it} from 'node:test';
import {MarcRecord} from '@natlibfi/marc-record';
import fixturesFactory, {READERS} from '@natlibfi/fixura';
import * as utils from '../../src/reducers/utils.js';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:utils:test');
//const debugData = debug.extend('data');
//const debugDev = debug.extend('dev');

MarcRecord.setValidationOptions({subfieldValues: false});

// https://github.com/NatLibFi/fixura-js/tree/master/src
// vaihda oikea funktio
describe('utils/getTags', () => {
  it('Should return valid value', () => {
    const {getFixture} = fixturesFactory(import.meta.dirname, '..', '..', 'test-fixtures', 'utils', 'getTags');
    // getFixture({components: ['foo', 'bar.txt'], reader: READERS.JSON})
    const test = getFixture({components: ['testi.json'], reader: READERS.JSON});
    debug(test);
    assert.deepEqual(utils.getTags(test.fields, []), ['jotain']);
  });
});
