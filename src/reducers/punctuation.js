/*
* punctuation.js -- try and fix a marc field punctuation
*
* Author(s): Nicholas Volk <nicholas.volk@helsinki.fi>
*/
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

//const stripCrap = / *[-;:,+]+$/u;
const defaultNeedsPunc = /(?:[a-z0-9A-Z]|å|ä|ö|Å|Ä|Ö)$/u;
const field300NeedsPunc = /(?:[\]a-zA-Z0-9)]|ä)$/u;

const cleanX00aComma = {'code': 'abde', 'followedBy': '#01', 'context': /[a-z],$/u, 'remove': /,$/u};
const cleanX00aDot = {'code': 'abcde', 'followedBy': 'bcdeg', 'context': /[a-z0-9]\.$/u, 'remove': /\.$/u};

const cleanX00eDot = {'code': 'e', 'followedBy': 'eg', 'context': /(?:aja|jä)\.$/u, 'remove': /\.$/u};

const addX00aComma = {'add': ',', 'code': 'abcde', 'followedBy': 'deg', 'context': defaultNeedsPunc};
const addX00aDot = {'add': '.', 'code': 'abcde', 'followedBy': '#t01', 'context': defaultNeedsPunc};


const cleanPunctuationRules = {
  '100': [cleanX00aComma, cleanX00aDot, cleanX00eDot],
  '300': [
    {'code': 'a', 'followedBy': '!b', 'remove': ' :'},
    {'code': 'ab', 'followedBy': '!c', 'remove': ' ;'},
    {'code': 'abc', 'followedBy': '!e', 'remove': ' +'}
  ],
  '700': [cleanX00aComma, cleanX00aDot, cleanX00eDot]
};

const addPairedPunctuationRules = {
  '100': [addX00aComma, addX00aDot],
  '300': [
    {'code': 'a', 'followedBy': 'b', 'add': ' :', 'context': field300NeedsPunc},
    {'code': 'ab', 'followedBy': 'c', 'add': ' ;', 'context': field300NeedsPunc},
    {'code': 'abc', 'followedBy': 'e', 'add': ' +', 'context': field300NeedsPunc}
  ],
  '700': [addX00aComma, addX00aDot]
};

function ruleAppliesToSubfield(rule, subfield) {
  // NB! Should be support negation here?
  if (!rule.code.includes(subfield.code)) {
    return false;
  }
  if ('context' in rule && !subfield.value.match(rule.context)) {
    return false;
  }
  return true;
}

function ruleAppliesToNextSubfield(rule, subfield) {
  const negation = rule.followedBy.includes('!');
  if (subfield === null) {
    if (negation) {
      return !rule.followedBy.includes('#');
    }
    return rule.followedBy.includes('#');
  }
  debug(`NSF ${subfield.code} - ${rule.followedBy} - ${negation}`);
  if (negation) {
    return !rule.followedBy.includes(subfield.code);
  }
  return rule.followedBy.includes(subfield.code);
}

function checkRule(rule, subfield1, subfield2) {
  if (!ruleAppliesToSubfield(rule, subfield1)) {
    //debug(`FAIL ON LHS FIELD`);
    return false;
  }

  if (!ruleAppliesToNextSubfield(rule, subfield2)) {
    //debug(`FAIL ON RHS FIELD`);
    return false;
  }

  debug(` ACCEPT ${rule.code}/${subfield1.code}, SF2=${rule.followedBy}/${subfield2 ? subfield2.code : 'N/A'}`);
  return true;
}

function removeCrappyPunctuation(tag, subfield1, subfield2) {
  if (!(`${tag}` in cleanPunctuationRules)) {
    debug(`No crappy punc clean up rule found for ${tag}$ (${subfield1.code})`);
    return;
  }
  const activeRules = cleanPunctuationRules[tag].filter(rule => checkRule(rule, subfield1, subfield2));

  activeRules.forEach(rule => {
    const originalValue = subfield1.value;
    subfield1.value = subfield1.value.replace(rule.remove, ''); // eslint-disable-line functional/immutable-data
    if (subfield1.value !== originalValue) { // eslint-disable-line functional/no-conditional-statement
      debug(` REMOVE PUNC: '$${subfield1.code} ${originalValue}' => '$${subfield1.code} ${subfield1.value}'`); // eslint-disable-line functional/immutable-data
    }
  });
}

function addPairedPunctuation(tag, subfield1, subfield2) {
  if (!(`${tag}` in addPairedPunctuationRules)) {
    debug(`No clean up rule found for ${tag}$${subfield1.code}`);
    return;
  }

  const activeRules = addPairedPunctuationRules[tag].filter(rule => checkRule(rule, subfield1, subfield2));
  activeRules.forEach(rule => {
    subfield1.value += rule.add; // eslint-disable-line functional/immutable-data
    debug(` ADD PUNC: '$${subfield1.code} ${subfield1.value}'`);
  });
}

function subfieldFixPunctuation(tag, subfield1, subfield2) {
  removeCrappyPunctuation(tag, subfield1, subfield2);

  addPairedPunctuation(tag, subfield1, subfield2);
}

export function fieldFixPunctuation(field) {
  debug('fieldFixPunctuation() TEST');
  if (!field.subfields) {
    return field;
  }
  field.subfields.forEach((sf, i) => {
    subfieldFixPunctuation(field.tag, sf, i + 1 < field.subfields.length ? field.subfields[i + 1] : null);
  });

  return field;
}
