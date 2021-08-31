//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {
  fieldHasSubfield,
  fieldRenameSubfieldCodes,
  fieldToString
} from './utils.js';


// TODO: Possible modifications:
// Move 040 back to a separate file, as it differs from everything else.
// We might be able to simplify things after that.
// Special treatments needed for:
// - punctuation between fields..
// - X00$d
// - indicator for article length (eg. 245)


const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');


function postprocessX00a(field) {
  if (!field.tag.match(/^[1678]00$/u)) {
    return field;
  }
  debug(`postprocessX00a(${fieldToString(field)})`);
  field.subfields.forEach((sf, index) => {
    if (sf.code !== 'a' || index + 1 === field.subfields.length) {
      return;
    }
    if ('de'.indexOf(field.subfields[index + 1].code) > -1) {
      if (sf.value.match(/[aeiouyäö][a-zåäö]$/u)) {
        debug(`ADD ',' TO '${sf.value}'`);
        sf.value += ','; // eslint-disable-line functional/immutable-data
        return;
      }
      // Final '.' => ','
      if (sf.value.match(/[aeiouyäö][a-zåäö]\.$/u)) {
        sf.value = `${sf.value.slice(0, -1)},`; // eslint-disable-line functional/immutable-data
        return; // KESKEN
      }
    }
  });
}

function postprocessXX0eFunction(field) {
  if (!field.tag.match(/^[1678][01]0$/u)) {
    return field;
  }
  debug(`postprocessXX0e(${fieldToString(field)})`);
  field.subfields.forEach((sf, index) => {
    if (sf.code !== 'e' || index + 1 === field.subfields.length) {
      return;
    }
    if ('e'.indexOf(field.subfields[index + 1].code) > -1) {
      // Final '.' => ',' if followed by $e (and if '.' follows an MTS term)
      if (sf.value.match(/(?:esittäjä|kirjoittaja|sanoittaja|sovittaja|säveltäjä|toimittaja)\.$/u)) {
        sf.value = `${sf.value.slice(0, -1)},`; // eslint-disable-line functional/immutable-data
        return; // KESKEN
      }
    }
  });
}

function postprocessLifespan(field) {
  if (!field.tag.match(/^[1678]00$/u)) {
    return field;
  }
  debug(`postprocessLifespan(${fieldToString(field)})`);
  field.subfields.forEach((sf, index) => {
    if (sf.code !== 'd' || index + 1 === field.subfields.length) {
      return;
    }
    if (field.subfields[index + 1].code === 'e') {
      if (sf.value.match(/^[0-9]+-[0-9]+$/u)) {
        debug(`ADD ',' TO '${sf.value}'`);
        sf.value += ','; // eslint-disable-line functional/immutable-data
        return;
      }
      // Final '.' => ','
      if (sf.value.match(/^[0-9]+-(?:[0-9]+)?\.$/u)) {
        sf.value = `${sf.value.slice(0, -1)},`; // eslint-disable-line functional/immutable-data
        return; // KESKEN
      }
    }
  });
}

export function postprocessField(field) {
  // Placeholder for proper
  postprocessX00a(field);
  postprocessXX0eFunction(field); // X00$e and X10$e
  postprocessLifespan(field); // X00$d
  return field;
}

const sf6Regexp = /^[0-9][0-9][0-9]-[0-9][0-9]/u;

function subfield6Index(subfield) {
  if (!subfield.value.match(sf6Regexp)) {
    return 0;
  }
  const tailPart = subfield.value.substring(4, 6); // 4 is for "TAG-"
  const result = parseInt(tailPart, 10);
  debug(`SF6: ${subfield.value} => ${tailPart} => ${result}`);
  return result;
}

function fieldSubfield6Index(field) {
  const sf6s = field.subfields.filter(subfield => subfield.code === '6');
  if (sf6s.length === 0) {
    return 0;
  }
  // There's supposed to be just instance of subfield 6:
  return subfield6Index(sf6s[0]);
}

function getMaxSubfield6(record) {
  // Should we cache the value here?
  const vals = record.fields.map((field) => {
    if (field.sourced) {
      return 0;
    } // field already added from source
    return fieldSubfield6Index(field);
  });
  return Math.max(...vals);
}

/*
function updateSubfield6(field, index) {
  const sf6s = field.subfields.filter(subfield => subfield.code === '6');
  const strindex = index < 10 ? `0${index}` : `${index}`;
  sf6s[0].value.replace(sf6s[0].substring(4, 6), strindex);
}
*/

function cloneField(field) {
  // mark it as coming from source:
  field.sourced = 1; // eslint-disable-line functional/immutable-data
  return JSON.parse(JSON.stringify(field));
}

export function postprocessRecordAfterMerge(record) {
  record.fields.forEach(field => {
    // remove merge-specific information:
    delete field.sourced; // eslint-disable-line functional/immutable-data
  });
}

function convertOriginalToModifyingAgency(field) {
  // Convert source record's 040$a 040$d, since it can not be an $a of the base record.
  if (field.tag === '040') { // eslint-disable-line functional/no-conditional-statement
    debug(`  Convert source record's 040$a to $d`);
    fieldRenameSubfieldCodes(field, 'a', 'd');
  }
}

function mainEntryToAddedEntry(field) {
  if (field.tag === '100' || field.tag === '110' || field.tag === '111' || field.tag === '130') { // eslint-disable-line functional/no-conditional-statement
    debug(`  Convert source record's ${field.tag} to 7XX`);
    field.tag = `7${field.tag.substring(1)}`; // eslint-disable-line functional/immutable-data
  }
}

function reindexSubfield6s(field, record) {
  if (record && fieldHasSubfield(field, '6')) {
    const baseMax = getMaxSubfield6(record);
    debug(`MAX SF6 is ${baseMax}`);
    // This is done for every subfield $6... Could be optimized esp. if this includes the fields added by this script...
    if (baseMax) {

      return {'tag': field.tag,
        'ind1': field.ind1,
        'ind2': field.ind2,
        'sourced': 1,
        'subfields': field.subfields.map((sf) => {
          if (sf.code === '6') { // eslint-disable-line functional/no-conditional-statement
            const index = subfield6Index(sf) + baseMax;
            const strindex = index < 10 ? `0${index}` : `${index}`;
            sf.value = sf.value.substring(0, 4) + strindex + sf.value.substring(6); // eslint-disable-line functional/no-conditional-statement
            debug(`SF6 is now ${sf.value}`);
          }
          return sf;
        })};
    }
  }
}

// NB! These are defined also in mergeSubfield.js. Do something...
const notYear       = /^\([1-9][0-9]*\)[,.]?$/u;

function datesAssociatedWithName(field) {
  if (!field.tag.match(/^[1678]00$/u)) {
    return field;
  }

  if ( field.subfields.some(sf => sf.code === 'd' && notYear.test(sf.value)) ) {
    field.subfields = field.subfields.filter(sf => sf.code !== 'd' || !notYear.test(sf.value));  // eslint-disable-line functional/immutable-data
  }

} 

export function cloneAndPreprocessField(originalField, record) {
  const field = cloneField(originalField);

  convertOriginalToModifyingAgency(field); // 040$a => $040$d

  mainEntryToAddedEntry(field); // 1XX => 7XX

  reindexSubfield6s(field, record); // field's $6 values start from record's max $6 value + 1

  datesAssociatedWithName(field); // remove $d (1)

  return field;
}
