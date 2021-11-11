/*
* punctuation.js -- try and fix a marc field punctuation
*
* Author(s): Nicholas Volk <nicholas.volk@helsinki.fi>
*
* TODO: implement https://www.kiwi.fi/display/kumea/Loppupisteohje
*/
import {validateSingleField} from '@natlibfi/marc-record-validators-melinda/dist/ending-punctuation';
import createDebugLogger from 'debug';
import {fieldToString, isControlSubfieldCode} from './utils';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

//const stripCrap = / *[-;:,+]+$/u;
const commaNeedsPuncAfter = /(?:[a-z0-9A-Z]|å|ä|ö|Å|Ä|Ö|\))$/u;
const defaultNeedsPuncAfter = /(?:[a-z0-9A-Z]|å|ä|ö|Å|Ä|Ö)$/u;
const field300NeedsPunc = /(?:[\]a-zA-Z0-9)]|ä)$/u;
const blocksPuncRHS = /^(?:\()/u;
const allowsPuncRHS = /^(?:[A-Za-z0-9]|å|ä|ö|Å|Ä|Ö)/u;

// NB! 65X: Finnish terms don't use punctuation, but international ones do. Neither one is currently (2021-11-08) coded here.

// Will unfortunately trigger "Sukunimi, Th." type:
const removeX00Comma = {'code': 'abcqde', 'followedBy': '#01459', 'context': /(?:[a-z)]|ä|ä|ö),$/u, 'remove': /,$/u};
const cleanRHS = {'code': 'abcd', 'followedBy': 'bcde', 'context': /(?:(?:[a-z0-9]|å|ä|ö)\.|,)$/u, 'contextRHS': blocksPuncRHS, 'remove': /[.,]$/u};
const cleanX00dCommaOrDot = {'code': 'd', 'followedBy': 'et#01459', 'context': /[0-9][,.]$/u, 'remove': /[,.]$/u};
const cleanX00aDot = {'code': 'abcde', 'followedBy': 'cdegj', 'context': /(?:[a-z0-9)]|å|ä|ö)\.$/u, 'remove': /\.$/u};
// These $e dot removals are tricky: before removing the comma, we should know that it ain't an abbreviation such as "esitt."...
const cleanX00eDot = {'code': 'e', 'followedBy': 'egj', 'context': /(?:aja|jä)\.$/u, 'remove': /\.$/u};

const X00RemoveDotAfterBracket = {'code': 'cq', 'context': /\)\.$/u, 'remove': /\.$/u};


const addX00aComma = {'add': ',', 'code': 'abcdej', 'followedBy': 'cdeg', 'context': commaNeedsPuncAfter, 'contextRHS': allowsPuncRHS};
const addX00aDot = {'add': '.', 'code': 'abcde', 'followedBy': '#t01', 'context': defaultNeedsPuncAfter};

const NONE = 0;
const ADD = 2;
const REMOVE = 1;
const REMOVE_AND_ADD = 3;

const cleanCrappyPunctuationRules = {
  '100': [removeX00Comma, cleanX00aDot, cleanX00eDot, cleanX00dCommaOrDot, cleanRHS, X00RemoveDotAfterBracket],
  '600': [removeX00Comma, cleanX00aDot, cleanX00eDot, cleanX00dCommaOrDot, X00RemoveDotAfterBracket],
  '700': [removeX00Comma, cleanX00aDot, cleanX00eDot, cleanX00dCommaOrDot, X00RemoveDotAfterBracket, cleanRHS],
  '800': [removeX00Comma, cleanX00aDot, cleanX00eDot, cleanX00dCommaOrDot, X00RemoveDotAfterBracket],
  '245': [{'code': 'ab', 'followedBy': '!c', 'remove': / \/$/u}],
  '300': [
    {'code': 'a', 'followedBy': '!b', 'remove': / :$/u},
    {'code': 'ab', 'followedBy': '!c', 'remove': / ;$/u},
    {'code': 'abc', 'followedBy': '!e', 'remove': / \+$/u}
  ],
  '110': [removeX00Comma, cleanX00aDot, cleanX00eDot]
};

const cleanLegalX00Comma = {'code': 'abcde', 'followedBy': 'cdegj', 'context': /.,$/u, 'remove': /,$/u};
// Accept upper case letters in X00$b, since they are probably Roman numerals.
const cleanLegalX00bDot = {'code': 'b', 'followedBy': 't#01459', context: /^[IVXLCDM]+\.$/u, 'remove': /\.$/u};
const cleanLegalX00Dot = {'code': 'abcde', 'followedBy': 't#01459', 'context': /(?:[a-z0-9)]|å|ä|ö)\.$/u, 'remove': /\.$/u};

const legalX00punc = [cleanLegalX00Comma, cleanLegalX00bDot, cleanLegalX00Dot];
const cleanValidPunctuationRules = {
  '100': legalX00punc,
  '600': legalX00punc,
  '700': legalX00punc,
  '800': legalX00punc,
  '245': [
    {'name': 'A:B', 'code': 'a', 'followedBy': 'b', 'remove': / :$/u},
    {'name': 'ABK:F', 'code': 'abk', 'followedBy': 'f', 'remove': /,$/u},
    {'name': 'ABFNP:C', 'code': 'abfnp', 'followedBy': 'c', 'remove': / \/$/u}
  ],
  '300': [
    {'code': 'a', 'followedBy': 'b', 'remove': / :$/u},
    {'code': 'ab', 'followedBy': 'c', 'remove': / ;$/u},
    {'code': 'abc', 'followedBy': 'e', 'remove': / \+$/u}
  ],
  '110': [removeX00Comma, cleanX00aDot, cleanX00eDot]
};

const addPairedPunctuationRules = {
  '100': [addX00aComma, addX00aDot],
  '245': [
    {'code': 'a', 'followedBy': 'b', 'add': ' :', 'context': defaultNeedsPuncAfter},
    {'code': 'abk', 'followedBy': 'f', 'add': ',', 'context': defaultNeedsPuncAfter},
    {'code': 'abfnp', 'followedBy': 'c', 'add': ' /', 'context': defaultNeedsPuncAfter}
  ],
  '300': [
    {'code': 'a', 'followedBy': 'b', 'add': ' :', 'context': field300NeedsPunc},
    {'code': 'ab', 'followedBy': 'c', 'add': ' ;', 'context': field300NeedsPunc},
    {'code': 'abc', 'followedBy': 'e', 'add': ' +', 'context': field300NeedsPunc}
  ],
  '700': [addX00aComma, addX00aDot]
  // MISSING: 773 ". -" etc
};

function ruleAppliesToSubfieldCode(targetSubfieldCodes, currSubfieldCode) {
  const negation = targetSubfieldCodes.includes('!');
  if (negation) {
    return !targetSubfieldCodes.includes(currSubfieldCode);
  }
  return targetSubfieldCodes.includes(currSubfieldCode);
}


function ruleAppliesToCurrentSubfield(rule, subfield) {
  if (!ruleAppliesToSubfieldCode(rule.code, subfield.code)) {
    return false;
  }
  if ('context' in rule && !subfield.value.match(rule.context)) {
    return false;
  }
  return true;
}

function ruleAppliesToNextSubfield(rule, nextSubfield) {
  if (!('followedBy' in rule)) { // Return true, if we are not interested in the next subfield
    return true;
  }
  // The '#' existence check applies only to the RHS field. LHS always exists.
  if (nextSubfield === null) {
    const negation = rule.followedBy.includes('!');
    if (negation) {
      return !rule.followedBy.includes('#');
    }
    return rule.followedBy.includes('#');
  }

  if (!ruleAppliesToSubfieldCode(rule.followedBy, nextSubfield.code)) {
    return false;
  }
  if ('contextRHS' in rule && !nextSubfield.value.match(rule.contextRHS)) {
    return false;
  }
  return true;
}

function checkRule(rule, subfield1, subfield2) {
  const name = rule.name || 'UNNAMED';
  if (!ruleAppliesToCurrentSubfield(rule, subfield1)) {
    // debug(`${name}: FAIL ON LHS FIELD: '$${subfield1.code} ${subfield1.value}', SF=${rule.code}`);
    return false;
  }

  if (!ruleAppliesToNextSubfield(rule, subfield2)) {
    const msg = subfield2 ? `${name}: FAIL ON RHS FIELD '${subfield2.code}' not in [${rule.followedBy}]` : `${name}: FAIL ON RHS FIELD`;
    debug(msg);
    return false;
  }

  debug(`${name}: ACCEPT ${rule.code}/${subfield1.code}, SF2=${rule.followedBy}/${subfield2 ? subfield2.code : 'N/A'}`);
  return true;
}

function applyPunctuationRules(tag, subfield1, subfield2, ruleArray = null, operation = NONE) {
  if (ruleArray === null || operation === NONE) {
    debug(`applyPunctuation(): No rules to apply!`);
    return;
  }

  if (!(`${tag}` in ruleArray)) {
    if (!['020', '650'].includes(tag) || !isControlSubfieldCode(subfield1.code)) { // eslint-disable-line functional/no-conditional-statement
      debug(`No punctuation rules found for ${tag} (looking for: ‡${subfield1.code})`);
    }
    return;
  }

  debug(`APR1A ${tag}: '${subfield1.value}'`);
  const activeRules = ruleArray[tag].filter(rule => checkRule(rule, subfield1, subfield2));

  activeRules.forEach(rule => {
    const originalValue = subfield1.value;
    if (rule.remove && [REMOVE, REMOVE_AND_ADD].includes(operation) && subfield1.value.match(rule.remove)) { // eslint-disable-line functional/no-conditional-statement
      debug(`    REMOVAL TO BE PERFORMED FOR \${subfield1.code} '${subfield1.value}'`);
      subfield1.value = subfield1.value.replace(rule.remove, ''); // eslint-disable-line functional/immutable-data
      debug(`    REMOVAL PERFORMED FOR '${subfield1.value}'`);
    }
    if (rule.add && [ADD, REMOVE_AND_ADD].includes(operation)) { // eslint-disable-line functional/no-conditional-statement
      subfield1.value += rule.add; // eslint-disable-line functional/immutable-data
      debug(`    ADDED '${rule.add}' TO '${subfield1.value}'`);
    }
    if (subfield1.value !== originalValue) { // eslint-disable-line functional/no-conditional-statement
      debug(` PROCESS PUNC: '‡${subfield1.code} ${originalValue}' => '‡${subfield1.code} ${subfield1.value}'`); // eslint-disable-line functional/immutable-data
    }
  });
}

function subfieldFixPunctuation(tag, subfield1, subfield2) {
  applyPunctuationRules(tag, subfield1, subfield2, cleanCrappyPunctuationRules, REMOVE);
  applyPunctuationRules(tag, subfield1, subfield2, addPairedPunctuationRules, ADD);
}

/*
function getFinalPunctuationSubfield264(field, subfield) {
  // "Copyright-vuoden kanssa ei käytetä loppupistettä (2. indikaattori = 4)."
  // "Must be $a condition" is aped from marc-record-validators-melinda/src/ending-punctuation-conf.js.
  if (field.ind2 === 4 || subfield.code !== 'c') {
    return false;
  }

  // "264-kenttään tulee loppupiste, JOS on käytetty osakenttää ‡c tuotantoajan, julkaisuajan, jakeluajan tai valmistusajan ilmaisemiseen
  // (2. indikaattori = 0, 1, 2 tai 3) JA osakenttä ‡c ei pääty hakasulkuun ']' tai tavuviivaan '-'   tai kaarisulkuun ')'  tai kysymysmerkkiin '?'
  // NB! No need to check ind2 as the only other possible value has already been covered.
  // NB! Can be use the generic punc regexp here?
  if (subfield.value.match(/[-\])?.]$/u)) {
    return false;
  }
  return subfield;
}
*/

/*
function getRelevantSubfields(field) {
  // Skip non-interesting fields:
  if (!field.tag.match(/^(?:036|051|[1678](?:00|10|11|30)|242|245|250|260|264|307|340|343|351|352|362|50[0-9]|51[1-8]|52[0-6]|53[0348]|54[014567]|55[0256]|56[1237]|58[01458]|720|740|752|754|76[0-9]|77[0-9]|78[0-7]|880)$/u)) {
    return [];
  }
  // Pick subfields:
  return field.subfields.filter(subfield => {
    if ('uw0123456789'.includes(subfield.code)) {
      return false;
    }
    if (field.tag === '242' && subfield.code === 'y') {
      return false;
    }

    if (field.tag === '506' && subfield.code === 'f') {
      return false;
    }
    if (subfield.code === 'u' && field.tag in ['520', '538']) {
      return false;
    }
    return true;
  });
}
*/

/*
function getFinalPunctuationSubfield(field) {
  const relevantSubfields = getRelevantSubfields(field);
  const index = relevantSubfields.length - 1;
  if (index < 0) {
    return null;
  }
  // Already has punctuation ("Välimerkit: .?-!") :
  if ('.?-!'.includes(relevantSubfields[index].value.slice(-1))) {
    return null;
  }

  // Exceptions:
  // X00, X10, X11, X30 and 740:
  if (field.tag.match(/^(?:[1678]00|[1678]10|[1678]11|[1678]30|740)$/u)) {
    if (relevantSubfields[index].value.slice(-1) === ')') {
      return null; // Is this really an expection. See 260 specs...
    }
  }

  if (field.tag === '264') { // Exceptionally indicators affect punctuation
    return getFinalPunctuationSubfield264(field, relevantSubfields[index]);
  }


  if (field.tag === '340' && 'cdgjkmop'.includes(relevantSubfields[index].code)) {
    return null;
  }

  if (field.tag.match(/^(?:647|648|65[0145678]|662)$/u)) {
    // "EI suomalaisten sanastojen termeihin, muihin sanaston käytännön mukaan, yleensä KYLLÄ"
    // NB! As we are Finns, we default to our way.
    // We should add punc to most of the non-Finnish lexicons.. Will list them as exceptions here eventually.
    return null;
  }

  if (field.tag === '036' && relevantSubfields[index].code !== 'b') {
    return false;
  }

  // Fields 567 and 760...788:
  if (relevantSubfields[index].code !== 'a' && field.tag.match(/^(?:567|76.|77.|78.)$/u)) {
    // Funny, we don't want $a in 773 anyway...
    return null;
  }
  return relevantSubfields[index];
}
*/

/*
function addFinalPunctuation(field) {
  // Add punctuation as per https://www.kiwi.fi/display/kumea/Loppupisteohje:
  const subfield = getFinalPunctuationSubfield(field);
  if (subfield && subfield.value.slice(-1) !== '.') {
    debug(`  Adding final punctuation '.' to '${field.tag} $${subfield.code} ${subfield.value}'.`);
    subfield.value += '.';
  }
  // Remove?
}
*/

export function fieldStripPunctuation(field) {
  if (!field.subfields) {
    return field;
  }

  field.subfields.forEach((sf, i) => {
    debug(`FSP1: '${sf.value}'`);
    applyPunctuationRules(field.tag, sf, i + 1 < field.subfields.length ? field.subfields[i + 1] : null, cleanValidPunctuationRules, REMOVE);
    debug(`FSP2: '${sf.value}'`);
    applyPunctuationRules(field.tag, sf, i + 1 < field.subfields.length ? field.subfields[i + 1] : null, cleanCrappyPunctuationRules, REMOVE);
    debug(`FSP3: '${sf.value}'`);
  });
  return field;
}

export function fieldFixPunctuation(field) {
  debug(`################### fieldFixPunctuation() TEST ${fieldToString(field)}`);
  if (!field.subfields) {
    return field;
  }
  field.subfields.forEach((sf, i) => {
    subfieldFixPunctuation(field.tag, sf, i + 1 < field.subfields.length ? field.subfields[i + 1] : null);
  });
  //addFinalPunctuation(field); // Attempt to use the (modified version of) existing stuff. Nothings happens as of now.
  validateSingleField(field, false, true); // NB! Don't use field.tag as second argument! It's a string, not an int. 3rd arg must be true (=fix)
  return field;
}
