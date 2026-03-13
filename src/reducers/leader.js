//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {baseHasEqualOrHigherEncodingLevel, deleteAllPrepublicationNotesFromField500InNonPubRecord, getEncodingLevel} from '@natlibfi/marc-record-validators-melinda';

export default () => (base, source, ignoreLDRmismatch = false) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:leader');
  //debug(`********* We have base: **********`);
  //debug(base.constructor.name);
  /*
  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  // Should this be sourceRecord.leader?
  const baseFields = baseRecord.get(/^LDR$/u);
  const sourceFields = sourceRecord.get(/^LDR$/u);
  debugDev(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  debugDev(`base.leader: ${base.leader}`);
  debugDev(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);
  debugDev(`source.leader: ${source.leader}`);
  */

  debug(`ignoreLDRmismatch: ${ignoreLDRmismatch}`);

  // Test 01: If LDR 000/06 or 07 is different, do not merge
  // use ignoreLDRmismatch to allow merge anyways
  if (!ignoreLDRmismatch && !compatibleLeaders(source.leader, base.leader)) {
    debug(`Differing LDR/06 or LDR/07, not able to merge`);
    throw new Error(`LDR 000/06 or 07 is different in base and source`);
  }

  setRecordStatus(base, source); //

  setBaseEncodingLevel(base, source); // take the better LDR/17
  return {base, source};

  function compatibleLeaders(leader1, leader2) {
    if (leader1[6] !== leader2[6]) {
      return false;
    }
    if (leader1[7] !== leader2[7]) {
      // Hard-coded exception: don't let these prevent merge:
      // We have 1000000+ cases with article 'b' that should be 'a'...
      if (['a', 'b'].includes(leader1[7]) && ['a', 'b'].includes(leader2[7])) {
        return true;
      }
      return false;
    }

    return true;
  }
};

function getRecordStatus(record) {
  return record.leader.substring(5, 6);
}


function setRecordStatus(base, source) {
  const baseStatus = getRecordStatus(base);

  const sourceStatus = getRecordStatus(source);

  if (baseStatus === 'n') {
    // Replace 'n' with source's 'c'. Used the array in condition here, so that it's easy to expand it with other values if needed/wanted.
    if (['c'].includes(sourceStatus)) {
      base.leader = base.leader.substring(0, 5) + sourceStatus + base.leader.substring(6);
      return;
    }
  }
}


function setBaseEncodingLevel(base, source) { // See MET-33
  const baseEncodingLevel = getEncodingLevel(base);
  const sourceEncodingLevel = getEncodingLevel(source);

  if (baseHasEqualOrHigherEncodingLevel(baseEncodingLevel, sourceEncodingLevel)) {
    return; // No action required
  }
  // Source's LDR/17 is copied to base's LDR/17:
  base.leader = base.leader.substring(0, 17) + sourceEncodingLevel + base.leader.substring(18);
  deleteAllPrepublicationNotesFromField500InNonPubRecord(base);
}
