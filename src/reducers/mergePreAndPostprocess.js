//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldFixPunctuation} from './punctuation.js';
import {fieldRenameSubfieldCodes, nvdebug, stringToRegex} from './utils.js';
import {sortAdjacentSubfields} from './sortSubfields';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

export function postprocessField(field) {
  // Should we update indicator for article length (eg. 245)?
  return field;
}

function cloneField(field) {
  // mark it as coming from source:
  field.added = 1; // eslint-disable-line functional/immutable-data
  return JSON.parse(JSON.stringify(field));
}

export function postprocessRecord(record) {
  record.fields.forEach(field => {
    // remove merge-specific information:
    if (field.merged) { // eslint-disable-line functional/no-conditional-statement

      fieldFixPunctuation(field); // NB! This won't fix existing or added fields!
      // DO YOUR SHIT
      delete field.merged; // eslint-disable-line functional/immutable-data
      // NB! We could
      // - remove subsets?
      // - Fix X00 ind2 etc
    }
    if (field.added) { // eslint-disable-line functional/no-conditional-statement
      delete field.added; // eslint-disable-line functional/immutable-data
    }
  });
  return record;
}

/*
function convertOriginalToModifyingAgency(field) {
  // Convert source record's 040$a 040$d, since it can not be an $a of the base record.
  if (field.tag === '040' && field.subfields.some(sf => sf.code === 'a')) { // eslint-disable-line functional/no-conditional-statement
    debug(`  Convert source record's 040$a to $d`);
    fieldRenameSubfieldCodes(field, 'a', 'd');
    // Since subfields were sorted, they may be in the wrong order now:
    sortAdjacentSubfields(field);
  }
}
*/


const defaultSwapSubfieldCodes = [{'tagPattern': '^040$', 'from': 'a', 'to': 'd'}];


function swapIncomingSubfieldCodes(field, config) {
  const swapSubfieldCodes = config.swapSubfieldCodes ? config.swapSubfieldCodes : defaultSwapSubfieldCodes;
  nvdebug(`SWAPS: ${JSON.stringify(swapSubfieldCodes)}`, debug);
  swapSubfieldCodes.forEach((rule) => applyRule(field, rule));

  function applyRule(field, rule) {
    if (!field.tag.match(stringToRegex(rule.tagPattern))) {
      return; // don't apply
    }
    fieldRenameSubfieldCodes(field, rule.from, rule.to);
    // Since subfields were sorted, they may be in the wrong order now:
    sortAdjacentSubfields(field);
    return;
  }

}


function mainEntryToAddedEntry(field) {
  if (field.tag === '100' || field.tag === '110' || field.tag === '111' || field.tag === '130') { // eslint-disable-line functional/no-conditional-statement
    debug(`  Convert source record's ${field.tag} to 7XX`);
    field.tag = `7${field.tag.substring(1)}`; // eslint-disable-line functional/immutable-data
  }
}


export function cloneAndPreprocessField(originalField, config) {
  // source-only preprocessing:
  const field = cloneField(originalField);

  swapIncomingSubfieldCodes(field, config);

  //convertOriginalToModifyingAgency(field); // 040$a => $040$d
  mainEntryToAddedEntry(field); // 1XX => 7XX
  //reindexSubfield6s(field, record); // field's $6 values start from record's max $6 value + 1

  return field;
}


