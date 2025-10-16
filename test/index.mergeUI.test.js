import assert from 'node:assert';
import merger from '@natlibfi/marc-record-merge';
import {inspect} from 'util';
import {MergeReducersForMergeUI} from '../src/index.js';
import createDebugLogger from 'debug';
import {MarcRecord} from '@natlibfi/marc-record';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';
import { filterOperation } from '../src/reducers/processFilter.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:index-mergeUI:test');
const debugData = debug.extend('data');

generateTests({
  callback,
  path: [import.meta.dirname, '..', 'test-fixtures', 'reducers', 'index-mergeUI'],
  recurse: false,
  useMetadataFile: true,
  fixura: {
    failWhenNotFound: false,
    reader: READERS.JSON
  }
});

function callback({getFixture}) {

  debug(`Runnin tests for internal merge`);
  //return;

  const base = new MarcRecord(getFixture('base.json'), {subfieldValues: false});
  const source = new MarcRecord(getFixture('source.json'), {subfieldValues: false});
  const expectedRecord = new MarcRecord(getFixture('merged.json'));

  // Run reducers for mergeUI
  const reducers = MergeReducersForMergeUI;

  debugData(`Reducers: ${inspect(reducers, {colors: true, maxArrayLength: 30, depth: 8})})}`);

  const result = merger({base, source, reducers});

  //const resultRecord = merger({base: base.toObject(), source: source.toObject(), reducers, baseValidators: {subfieldValues: false}, sourceValidators: {subfieldValues: false}});

  debug(`Merge result is: ${result.constructor.name}`);
  //debugData(`RESULT: ${inspect(result.toObject(), {depth: 4})}`);
  //debugData(`EXPECTED: ${inspect(expectedRecord, {depth: 4})}`);
  const {formattedResult, formattedExpectedResult} = ignoreF583TimeStamp(result, expectedRecord);

  debugData(`RESULT: ${JSON.stringify(result.toObject())}`);
  debugData(`EXPECTED: ${JSON.stringify(expectedRecord.toObject())}`);
  assert.deepEqual(formattedResult.toObject(), formattedExpectedResult.toObject());

  function ignoreF583TimeStamp(record, expectedRecord) {
    debug(`Delete f583s with timeStamp`);
    const removeF583Config = {
           operation: "removeSubfield",
            comment: "remove 583X $c timestamp subfields",
            recordType: "both",
            fieldSpecification: {
                tagPattern: "^583$"
            },
            deletableSubfieldFilter: {"code": "c"}
          }

    filterOperation(record, expectedRecord, removeF583Config, true);
    return {formattedResult: record, formattedExpectedResult: expectedRecord};
  }

}
