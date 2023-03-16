import createDebugLogger from 'debug';
//import clone from 'clone';
import {cloneAndNormalizeFieldForComparison} from './normalize.js';
//import {mayContainControlNumberIdentifier, normalizeControlSubfieldValue} from './normalizeIdentifier';
import {normalizeAs, normalizeControlSubfieldValue} from '@natlibfi/marc-record-validators-melinda/dist/normalize-identifiers';
import {
  fieldHasSubfield,
  fieldToString, isControlSubfieldCode, nvdebug,
  subfieldIsRepeatable, subfieldsAreIdentical, subfieldToString
} from './utils.js';
import {mergeSubfield} from './mergeSubfield.js';
import {sortAdjacentSubfields} from './sortSubfields.js';
import {valueCarriesMeaning} from './worldKnowledge.js';
import {resetSubfield6Tag} from './subfield6Utils.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeOrAddSubfield');


function mergeOrAddSubfieldNotRequiredSpecialCases(targetField, candSubfield) {
  // Add hard-coded exceptions here
  nvdebug(`not required? '${subfieldToString(candSubfield)}' vs '${fieldToString(targetField)}'`);
  if (targetField.tag === '040' && candSubfield.code === 'd' &&
      targetField.subfields.some(sf => sf.code === 'a' && sf.value === candSubfield.value)) {
    debug('040‡d matched 040‡a');
    return true;
  }

  // Don't add 264$b 'Kustannuspaikka tuntematon' etc
  if (!valueCarriesMeaning(targetField.tag, candSubfield.code, candSubfield.value)) {
    return true;
  }

  if (candSubfield.code === 'g' && candSubfield.value === 'ENNAKKOTIETO.') {
    // Skip just ‡g subfield or the whole field?
    // We decided to skip just this subfield. We want at least $0 and maybe even more from ennakkotieto.
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

function mergeOrAddSubfieldNotRequired(normalizedTargetField, normalizedCandSubfield) {
  nvdebug(`     Look for identical subfields in '${fieldToString(normalizedTargetField)}'`);

  if (normalizedTargetField.subfields.some(sf => subfieldsAreIdentical(sf, normalizedCandSubfield))) {
    // Subfield with identical normalized value exists. Do nothing.
    // Not ideal 382‡n subfields, I guess... Nor 505‡trg repetitions... These need to be fixed...
    return true;
  }

  if (mergeOrAddSubfieldNotRequiredSpecialCases(normalizedTargetField, normalizedCandSubfield)) {
    return true;
  }

  return false; // (note that this is a double negation: not required is false)
}

function addSubfield(targetField, candSubfield) {
  const str = `${candSubfield.code} ${candSubfield.value}`;
  nvdebug(` Added subfield ‡'${str}' to field`, debug);
  // Add subfield to the end of all subfields. NB! Implement a separate function that does this + subfield reordering somehow...
  targetField.subfields.push(candSubfield); // eslint-disable-line functional/immutable-data

  targetField.merged = 1; // eslint-disable-line functional/immutable-data

  setPunctuationFlag(targetField, candSubfield);
  sortAdjacentSubfields(targetField);

}

function setPunctuationFlag(field, addedSubfield) {
  if (isControlSubfieldCode(addedSubfield.code)) { // These are never punctuation related
    return;
  }
  field.useExternalEndPunctuation = 1; // eslint-disable-line functional/immutable-data
}


function resetPaired880(candFieldPair880, targetField, punctlessCandSubfield) {
  // No relevant:
  if (punctlessCandSubfield.code !== '6') {
    return;
  }
  if (targetField.tag === '880') {
    return;
  }
  // NB! $6 comes first:
  if (candFieldPair880 === undefined || !candFieldPair880.subfields || candFieldPair880.subfields[0].code !== '6') {
    return;

  }
  nvdebug(`880 contents: ${fieldToString(candFieldPair880)}`);
  resetSubfield6Tag(candFieldPair880.subfields[0], targetField.tag);
}

export function mergeOrAddSubfield(targetField, normalizedCandSubfield, punctlessCandSubfield, candFieldPairs880 = []) {
  const normalizedTargetField = cloneAndNormalizeFieldForComparison(targetField);

  nvdebug(`   Q: mergeOrAddSubfield '${subfieldToString(punctlessCandSubfield)}'`, debug);
  nvdebug(`      with field '${fieldToString(targetField)}'?`, debug);
  if (mergeOrAddSubfieldNotRequired(normalizedTargetField, normalizedCandSubfield)) {
    nvdebug(`    A: No. No need to merge nor to add the subfield '${subfieldToString(punctlessCandSubfield)}'`, debug);
    return;
  }

  // Currently only X00$d 1984- => 1984-2000 type of changes.
  // It all other cases the original subfield is kept.
  const original = fieldToString(targetField);
  if (mergeSubfield(targetField, punctlessCandSubfield)) { // We might need the normalizedCandSubfield later on
    if (original !== fieldToString(targetField)) {
      nvdebug(`    A: Merge. Subfield '${subfieldToString(punctlessCandSubfield)}' replaces the original subfield.`, debug);
      targetField.merged = 1; // eslint-disable-line functional/immutable-data
      setPunctuationFlag(targetField, punctlessCandSubfield);
      return;
    }
    nvdebug(`      A: No. Field ${original} had a better merge candidate than our subfield '${subfieldToString(punctlessCandSubfield)}' replace.`, debug);
    return;
  }

  // Subfield codes missing from the original record can be added by default:
  if (!fieldHasSubfield(targetField, punctlessCandSubfield.code)) {
    nvdebug(`    A: Yes. Add previously unseen subfield '${subfieldToString(punctlessCandSubfield)}'`, debug);
    targetField.merged = 1; // eslint-disable-line functional/immutable-data
    setPunctuationFlag(targetField, punctlessCandSubfield);
    candFieldPairs880.forEach(pair => resetPaired880(pair, targetField, punctlessCandSubfield));
    addSubfield(targetField, punctlessCandSubfield);
    return;
  }

  // melindaCustomMergeFields.json tells us whether the subfield is repeatable or not:
  if (subfieldIsRepeatable(targetField.tag, punctlessCandSubfield.code)) {
    nvdebug(`    A: Yes. Add repeatable subfield '${subfieldToString(punctlessCandSubfield)}'`, debug);
    targetField.merged = 1; // eslint-disable-line functional/immutable-data
    setPunctuationFlag(targetField, punctlessCandSubfield);
    addSubfield(targetField, punctlessCandSubfield);
    return;
  }

  nvdebug(`    A: No. Non-repeatable subfield '${subfieldToString(punctlessCandSubfield)}'`, debug);
}
