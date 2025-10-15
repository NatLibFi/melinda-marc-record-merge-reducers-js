import merger from '@natlibfi/marc-record-merge';
import {inspect} from 'util';
import {MelindaReducers} from './index';
import createDebugLogger from 'debug';
import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';

generateTests({
  callback,
  path: [__dirname, '..', 'test-fixtures', 'reducers', 'index'],
  recurse: false,
  useMetadataFile: true,
  fixura: {
    failWhenNotFound: false,
    reader: READERS.JSON
  }
});

function callback({getFixture}) {
  const base = new MarcRecord(getFixture('base.json'), {subfieldValues: false});
  const source = new MarcRecord(getFixture('source.json'), {subfieldValues: false});
  const expectedRecord = getFixture('merged.json');

  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:index:test');
  const debugData = debug.extend('data');

  // Run first copy-reducers with Melinda-configs and then the specific MelindaReducers

  //const reducers = [...MelindaCopyReducerConfigs.map(conf => Reducers.copy(conf)), ...MelindaReducers];
  const reducers = MelindaReducers;

  debugData(`Reducers: ${inspect(reducers, {colors: true, maxArrayLength: 10, depth: 8})})}`);

  const result = merger({base, source, reducers});

  //const resultRecord = merger({base: base.toObject(), source: source.toObject(), reducers, baseValidators: {subfieldValues: false}, sourceValidators: {subfieldValues: false}});

  debug(`Merge result is: ${result.constructor.name}`);
  debugData(`${JSON.stringify(result)}`);
  //expect(result.base.toObject()).to.eql(expectedRecord);
  expect(result.toObject()).to.eql(expectedRecord);

}
