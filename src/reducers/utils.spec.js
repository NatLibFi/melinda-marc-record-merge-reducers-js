import chai from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import fixturesFactory, {READERS} from '@natlibfi/fixura';
import * as utils from './utils';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:utils:test');

MarcRecord.setValidationOptions({subfieldValues: false});
const {expect} = chai;

// https://github.com/NatLibFi/fixura-js/tree/master/src
// vaihda oikea funktio
describe('utils/getTags', () => {
  it('Should return valid value', () => {
    const {getFixture} = fixturesFactory(__dirname, '..', '..', 'test-fixtures', 'utils', 'getTags');
    // getFixture({components: ['foo', 'bar.txt'], reader: READERS.JSON})
    const test = getFixture({components: ['testi.json'], reader: READERS.JSON});
    debug(test); // eslint-disable-line
    expect(utils.getTags(test.fields, [])).to.eql(['jotain']);
  });
});
