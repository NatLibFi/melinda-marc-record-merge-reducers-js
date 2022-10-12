import createDebugLogger from 'debug';
import clone from 'clone';
import {cloneAndRemovePunctuation} from './normalize.js';
//import {mayContainControlNumberIdentifier, normalizeControlSubfieldValue} from './normalizeIdentifier';
import {normalizeAs, normalizeControlSubfieldValue} from '@natlibfi/marc-record-validators-melinda/dist/normalize-identifiers';
import {
  fieldHasSubfield,
  fieldToString, isControlSubfieldCode, nvdebug,
  subfieldIsRepeatable, subfieldsAreIdentical
} from './utils.js';
import {mergeSubfield} from './mergeSubfield.js';
import {sortAdjacentSubfields} from './sortSubfields.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeSubfield');


function insertSubfieldAllowed(targetField, candSubfield) {
  // Subfield codes missing from the original record can be added by default:
  if (!fieldHasSubfield(targetField, candSubfield.code)) {
    return true;
  }
  // melindaCustomMergeFields.json tells us whether the subfield is repeatable or not:
  return subfieldIsRepeatable(targetField.tag, candSubfield.code);
}


function mergeOrAddSubfieldNotRequiredSpecialCases(targetField, candSubfield) {
  // Add hard-coded exceptions here
  if (targetField.tag === '040' && candSubfield.code === 'd' &&
      targetField.subfields.some(sf => sf.code === 'a' && sf.value === candSubfield.value)) {
    debug('040‡d matched 040‡a');
    return true;
  }
  if (candSubfield.code === 'g' && candSubfield.value === 'ENNAKKOTIETO.') {
    // Skip just ‡g subfield or the whole field?
    // We decided to skip just this subfield. We want at least $0 and maybe more even from ennakkotieto.
    debug('Skip ‡g ENNAKKOTIETO.');
    return true;
  }
  // Don't add $0 subfields that mean the same even if they look different:
  const alephIdentifierType = normalizeAs(targetField.tag, candSubfield.code);
  if (alephIdentifierType !== undefined) {
    const normalizedSubfieldValue = normalizeControlSubfieldValue(candSubfield.value, alephIdentifierType);
    if (targetField.subfields.some(sf => normalizeControlSubfieldValue(sf.value) === normalizedSubfieldValue && sf.code === candSubfield.code)) {
      return true;
    }
  }
  return false;
}

function mergeOrAddSubfieldNotRequired(targetField, candSubfield) {
  // candSubfield has been stripped of punctuation.
  const normalizedTargetField = cloneAndRemovePunctuation(targetField);

  nvdebug(`     Look for identical subfields in '${fieldToString(normalizedTargetField)}'`);

  if (normalizedTargetField.subfields.some(sf => subfieldsAreIdentical(sf, candSubfield))) {
    // Subfield with identical normalized value exists. Do nothing.
    // Not ideal 382‡n subfields, I guess... Nor 505‡trg repetitions... These need to be fixed...
    return true;
  }

  if (mergeOrAddSubfieldNotRequiredSpecialCases(targetField, candSubfield)) {
    return true;
  }

  return false; // (note that this is a double negation: not required is false)
}

function addSubfield(targetField, candSubfield) {
  const str = `${candSubfield.code} ${candSubfield.value}`;
  nvdebug(` Added subfield ‡'${str}' to field`, debug);
  // Add subfield to the end of all subfields. NB! Implement a separate function that does this + subfield reordering somehow...
  targetField.subfields.push(candSubfield); // eslint-disable-line functional/immutable-data
  if (!isControlSubfieldCode(candSubfield.code)) { // eslint-disable-line functional/no-conditional-statement
    targetField.punctuate = 1; // eslint-disable-line functional/immutable-data
  }
  targetField.merged = 1; // eslint-disable-line functional/immutable-data
  sortAdjacentSubfields(targetField);
}

export function mergeOrAddSubfield(record, targetField, candSubfield) {
  nvdebug(`   Q: mergeOrAddSubfield '‡${candSubfield.code} ${candSubfield.value}'`, debug);
  nvdebug(`      with field '${fieldToString(targetField)}'?`, debug);
  if (mergeOrAddSubfieldNotRequired(targetField, clone(candSubfield))) {
    nvdebug(`    A: No. No need to merge nor to add the subfield '‡${candSubfield.code} ${candSubfield.value}'`, debug);
    return;
  }

  // Currently only X00$d 1984- => 1984-2000 type of changes.
  // It all other cases the original subfield is kept.
  const original = fieldToString(targetField);
  if (mergeSubfield(targetField, candSubfield)) {
    if (original !== fieldToString(targetField)) {
      nvdebug(`    A: Merge. Subfield '‡${candSubfield.code} ${candSubfield.value}' replaces the original subfield.`, debug);
      targetField.merged = 1; // eslint-disable-line functional/immutable-data
      targetField.punctuate = 1; // eslint-disable-line functional/immutable-data
      return;
    }
    nvdebug(`      A: No. Field ${original} had a better merge candidate than our subfield '‡${candSubfield.code} ${candSubfield.value}' replace.`, debug);
    return;
  }

  if (insertSubfieldAllowed(targetField, candSubfield)) {
    nvdebug(`    A: Yes. Add subfield '‡${candSubfield.code} ${candSubfield.value}'`, debug);

    addSubfield(targetField, candSubfield);
    return;
  }


  // Didn't do anything, but thinks something should have been done:
  nvdebug(`    A: Could not decide. Add decision rules. 'Til then, do nothing to '‡${candSubfield.code} ${candSubfield.value}'`, debug);
}
