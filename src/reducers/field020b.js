import createDebugLogger from 'debug';

import {
  getRepCodes,
  getNonRepCodes,
  compareAllSubfields,
  getNonRepSubs,
  getRepSubs,
  modifyBaseField,
  sortSubfields,
  repeatableField
} from './utils.js';

// Test 09: Copy new field from source to base record (case 1)
// Test 10: Copy subfields from source field to base field (case 2)
// Test 11: Both cases in the same record: copy a new field (case 1) and add subfields to an existing field (case 2)

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^020$/u; // Tag in regexp format (for use in MarcRecord functions)
  const tagString = fieldTag.source.slice(1, 4); // Tag number as string
  const baseFields = base.get(fieldTag); // Get array of base fields
  //debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  const sourceFields = source.get(fieldTag); // Get array of source fields
  //debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  // Get arrays of repeatable and non-repeatable subfield codes from melindaCustomMergeFields.json
  const repCodes = getRepCodes(tagString);
  //debug(`repCodes: ${JSON.stringify(repCodes, undefined, 2)}`);
  const nonRepCodes = getNonRepCodes(tagString);
  //debug(`nonRepCodes: ${JSON.stringify(nonRepCodes, undefined, 2)}`);

  const result = pump(baseFields, sourceFields);
  debug(`result: ${JSON.stringify(result, undefined, 2)}`);

  function pump(loopArray, keepArray = []) {
    const [baseField, ...newLoopArray] = loopArray;
    if (baseField === undefined) {
      debug(`loopArray1: ${JSON.stringify(loopArray, undefined, 2)}`);
      debug(`keepArray1: ${JSON.stringify(keepArray, undefined, 2)}`);
      return keepArray;
    }

    repeatableField(base, tagString, baseField, sourceField, repCodes, nonRepCodes);


    debug(`baseField: ${JSON.stringify(baseField, undefined, 2)}`);
    const bfStr = JSON.stringify(baseField);
    debug(`bfStr: ${bfStr}`);
    debug(`loopArray2: ${JSON.stringify(loopArray, undefined, 2)}`);
    debug(`keepArray2: ${JSON.stringify(keepArray, undefined, 2)}`);

    if (JSON.stringify(keepArray).includes(JSON.stringify(baseField))) {
      debug(`inside if loop`);
      debug(`keepArray3: ${JSON.stringify(keepArray, undefined, 2)}`);
      debug(`newLoopArray: ${JSON.stringify(newLoopArray, undefined, 2)}`);
      return pump(newLoopArray, keepArray);
    }  return pump(newLoopArray, [...keepArray, baseField]);
  }

/*const src = [{code: 'a', value: 'aaa'},{code: 'b', value: 'bbb'}];
const bs = [{code: 'a', value: 'aaa'}, {code: 'c', value: 'ccc'}];

const result = pump(bs, src);
debug(`result: ${JSON.stringify(result, undefined, 2)}`);

function pump(loopArray, keepArray = []) {
  const [current, ...newLoopArray] = loopArray;
  if (current === undefined) {
    debug(`loopArray1: ${JSON.stringify(loopArray, undefined, 2)}`);
    debug(`keepArray1: ${JSON.stringify(keepArray, undefined, 2)}`);
    return keepArray;
  }
  // Tehdään asioita current valuelle

  debug(`current: ${JSON.stringify(current, undefined, 2)}`);
  const currStr = JSON.stringify(current);
  debug(`currStr: ${currStr}`);
  debug(`loopArray2: ${JSON.stringify(loopArray, undefined, 2)}`);
  debug(`keepArray2: ${JSON.stringify(keepArray, undefined, 2)}`);

  if (JSON.stringify(keepArray).includes(JSON.stringify(current))) {
    debug(`inside if loop`);
    debug(`keepArray3: ${JSON.stringify(keepArray, undefined, 2)}`);
    debug(`newLoopArray: ${JSON.stringify(newLoopArray, undefined, 2)}`);
    return pump(newLoopArray, keepArray);
  }  return pump(newLoopArray, [...keepArray, current]);
}*/



  // Iterate through all fields in source and base arrays


/*function pump(loopArray, keepArray = []) {
  const [current, ...newLoopArray] = loopArray;
  if (current === undefined) {
    return keepArray;
  }

  // Tehdään asioita current valuelle
  const current = repeatableField(base, tagString, baseField, sourceField, repCodes, nonRepCodes);

  if (current === 'not wanted') {
    return pump(newLoopArray, keepArray);
  }  return pump(newLoopArray, [...keepArray, current]);
}*/

/*  function loopSource(sourceFields) {
    debug(`Entering loopSource`);
    sourceFields.map(sourceField => {
      return loopBase(baseFields);
    }); // loopSource end
  }

  function loopBase(baseFields) {
    baseFields.map(baseField => {
    debug(`Entering loopBase`);
    const result = repeatableField(base, tagString, baseField, sourceField, repCodes, nonRepCodes);
    return result;
    });
  } // loopBase end
const result = loopSource(sourceFields);
debug(`result: ${JSON.stringify(result, undefined, 2)}`);
return result; // This is the final MarcRecord object*/
}; // export default end
