import createDebugLogger from 'debug';
import { fieldsAreIdentical } from './utils';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

const stripCrap = / *[-;:,+]+$/u;
const defaultNeedsPunc = /([a-z0-9A-Z])$/u;

const cleanX00aComma = { 'code' : 'a', 'followedBy' : '#01', 'context': /[a-z],$/u, 'remove': /,$/u };
const cleanX00aDot = { 'code' : 'ade', 'followedBy' : 'bcdeg', 'context': /[a-z0-9]\.$/u, 'remove': /\.$/u };


const cleanX00eDot = { 'code' : 'e', 'followedBy' : 'eg', 'context': /(esittäjä|kirjoittaja|sanoittaja|säveltäjä|toimittaja)\.$/u, 'remove': /\.$/u };


const addX00aComma = { 'add': ',', 'code' : 'abcde', 'followedBy' : 'deg', 'context': defaultNeedsPunc };
const addX00aDot = { 'add': '.', 'code' : 'abcde', 'followedBy' : '#t01', 'context': defaultNeedsPunc };


const cleanPunctuationRules = {
  '100' : [ cleanX00aComma, cleanX00aDot, cleanX00eDot ],
  '300' : [ { 'code' : 'a', 'followedBy' : '!b', 'remove' : ' :' },
            { 'code' : 'ab', 'followedBy' : '!c', 'remove' : ' ;' }
  ],
  '700' : [ cleanX00aComma, cleanX00aDot, cleanX00eDot]
}

const addPairedPunctuationRules = {
  '100' : [ addX00aComma, addX00aDot ],
  '700' : [ addX00aComma, addX00aDot ]
}

/*
const pairedPunctuationRules = {
  'b' : [ {'tag': '300', 'target': ' :', 'relevantSubfields': 'a',    'needsCleanup': stripCrap, 'cleanup_regexp': stripCrap, 'needsPunc' : defaultNeedsPunc} ],
  'c' : [ {'tag': '300', 'target': ' ;', 'relevantSubfields': 'ab',   'needsCleanup': stripCrap, 'cleanup_regexp': stripCrap, 'needsPunc' : defaultNeedsPunc} ],
  'e' : [ {'tag': '300', 'target': ' +', 'relevantSubfields': 'abc',  'needsCleanup': stripCrap, 'cleanup_regexp': stripCrap, 'needsPunc' : defaultNeedsPunc},
          {'tag': '700', 'target': ',', 'relevantSubfields': 'abcdef', 'needsCleanup': /([a-z]å|ä|ö)\.$/u, 'cleanup_regexp': /\.$/u, 'needsPunc' : defaultNeedsPunc}. 
]
]
};

const finalPunctuationRules = {
  '100' : [ { 'self': 'abceg', 'followedBy': 't0', 'cleanup_regexp': stripCrap, 'target': '.', 'needsPunc' : defaultNeedsPunc} ],
  '100' : [ { 'self': 'd', 'followedBy': 't0', 'cleanup_regexp': stripCrap, 'target': '.', 'needsPunc' : /[^-]$/} ]
};


function fixFinalPunctuation(tag, subfield1, subfield2) {
  if ( !((tag+'') in finalPunctuationRules)) {
    debug(`No final punctuation rules found for ${tag}$${subfield1.code}`);
    return;
  }
  const activeRules = finalPunctuationRules[tag].filter(rule => rule.self.includes(subfield1.code));
  if ( activeRules.length === 0 ) {
    debug(`No final punctuation rules found for ${tag}$${subfield1.code}`);
    return;
  }
  activeRules.forEach(rule => { 
    if ( !subfield1.value.endsWith(rule.target) && ( !subfield2 || rule.followedBy.includes(subfield2.code))) {
      debug(`IMPLEMENT END PUNC RULE ${tag}$${subfield1.code}: target='${rule.target}' for '$${subfield1.code} ${subfield1.value}'`);
      if ( 'needsCleanup' in rule && subfield1.value.match(rule.needsCleanup) ) {
        subfield1.value = subfield1.value.replace(rule.cleanup_regexp, '');
        debug(` STRIP TO '$${subfield1.code} ${subfield1.value}'`);
      }
      if ( 'needsPunc' in rule && subfield1.value.match(rule.needsPunc) ) {
        subfield1.value += rule.target;     
      }
      debug(` FINAL '$${subfield1.code} ${subfield1.value}'`);    
    }
  });
}

function fixPairedPunctuation(tag, subfield1, subfield2) {
  if ( !(subfield2.code in pairedPunctuationRules)) {
    //debug(`No mid punctuation rules found for ${tag}$${subfield2.code}`);
    fixFinalPunctuation(tag, subfield1, subfield2);
    return;
  }
  const activeRules = pairedPunctuationRules[subfield2.code].filter(rule => rule['tag'] === tag);
  if ( activeRules.length === 0 ) {
    //debug(`No punctuation rules found for ${tag}$${subfield2.code}`);
    fixFinalPunctuation(tag, subfield1, subfield2);
    return;
  }

  activeRules.forEach(rule => { 
    if ( !subfield2.value.endsWith(rule.target) && rule.relevantSubfields.includes(subfield1.code)) {
      debug(`IMPLEMENT RULE ${tag}$${subfield2.code}: target='${rule.target}' for '$${subfield1.code} ${subfield1.value} $${subfield2.code} ${subfield2.value}'`);
      if ( 'needsCleanup' in rule && subfield1.value.match(rule.needsCleanup) ) {
        subfield1.value = subfield1.value.replace(rule.cleanup_regexp, '');
        debug(` STRIP TO '$${subfield1.code} ${subfield1.value} $${subfield2.code} ${subfield2.value}'`);
      }
      if ( 'needsPunc' in rule && subfield1.value.match(rule.needsPunc) ) {
        subfield1.value += rule.target;     
      }
      debug(` FINAL '$${subfield1.code} ${subfield1.value} $${subfield2.code} ${subfield2.value}'`);    
    }
  });
}

*/
function checkRule(rule, subfield1, subfield2) {
  if ( !rule.code.includes(subfield1.code) ) {
    return false;
  }
  if ( 'context' in rule && !subfield1.value.match(rule.context) ) {
    return false;
  }

  if ( subfield2 === null && !rule.followedBy.includes('#') ) {
    return false;
  }
  if ( subfield2 !== null && !rule.followedBy.includes(subfield2.code)) {
    return false;
  }
  debug(` ACCEPT ${rule.code}/${subfield1.code}, SF2=${rule.followedBy}/${subfield2 ? subfield2.code : 'N/A'}}`);
  return true;
}

function removeCrappyPunctuation(tag, subfield1, subfield2) {
  if ( !((tag+'') in cleanPunctuationRules)) {
    debug(`No crappy punc clean up rule found for ${tag}$ (${subfield1.code})`);
    return;
  }
  const activeRules = cleanPunctuationRules[tag].filter(rule => checkRule(rule, subfield1, subfield2));

  activeRules.forEach(rule => {
    subfield1.value = subfield1.value.replace(rule.remove, '');
    debug(` POST-CRAPPY PUNC: '$${subfield1.code} ${subfield1.value}'`);
  });
}


function addPairedPunctuation(tag, subfield1, subfield2) {
  if ( !((tag+'') in addPairedPunctuationRules)) {
    debug(`No clean up rule found for ${tag}$${subfield1.code}`);
    return;
  }
  
  const activeRules = addPairedPunctuationRules[tag].filter(rule => checkRule(rule, subfield1, subfield2));
  activeRules.forEach(rule => {
    subfield1.value += rule.add;
    debug(` ADD PUNC: '$${subfield1.code} ${subfield1.value}'`);
  });
}

function subfieldFixPunctuation(tag, subfield1, subfield2) {
  removeCrappyPunctuation(tag, subfield1, subfield2);

  addPairedPunctuation(tag, subfield1, subfield2);

  /*
  if ( subfield2 === null ) {
    //debug(`No mid-punctuation rules found for $${subfield2.code}`);
    return fixFinalPunctuation(tag, subfield1, subfield2);
  }
  debug(`sFP Proceed with ${subfield1.code} ${subfield1.value}`);
  debug(`Proceed with ${subfield2.code} ${subfield2.value}`);
  fixPairedPunctuation(tag, subfield1, subfield2);
  */
} 

export function fieldFixPunctuation(field) {
  debug("fieldFixPunctuation() TEST");
  if (!field.subfields) {
    return field;
  }
  field.subfields.forEach((sf, i) => { subfieldFixPunctuation(field.tag, sf, (i+1 < field.subfields.length ? field.subfields[i+1] : null)); });
    
  return field;
}
