//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {
  fieldHasSubfield,
  fieldRenameSubfieldCodes,
  fieldToString
} from './utils.js';


// Possible modifications:
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

const sf6Regexp = /^[0-9][0-9][0-9]-[0-9]+$/u;
function subfield6Index(subfield) {
  if (!subfield.value.match(sf6Regexp)) {
    return 0;
  }
  return parseInt(subfield.value.substring(subfield.value.indexOf('-') + 1), 10);
}

function fieldSubfield6Index(field) {
  const sf6s = field.subfields.filter(subfield => subfield.code === '6');
  if (sf6s.length === 0) {
    return 0;
  }
  // There's supposed to be just instance of subfield 6:
  return parseInt(subfield6Index(sf6s[0], 10));
}

function getMaxSubfield6(record) {
  // Should we cache the value here?
  return Math.max(record.fields.map(field => fieldSubfield6Index(field)));
}

function updateSubfield6(field, index) {
  dfddsd_explode();
}


function cloneField(field) {
  return JSON.parse(JSON.stringify(field));
}

export function cloneAndPreprocessField(originalField, record) {
  const field = cloneField(originalField);
  // Convert source record's 040$a 040$d, since it can not be an $a of the base record.
  if (field.tag === '040') {
    debug(`  Convert source record's 040$a to $d`);
    fieldRenameSubfieldCodes(field, 'a', 'd');
  }

  if ( field.tag === '100' || field.tag === '110' || field.tag === '111' || field.tag === '130' ) {
    debug(`  Convert source record's ${field.tag} to 7XX`);
    field.tag = `7${field.tag.substring(1)}`; // eslint-disable-line functional/immutable-data
  }

  if (record && fieldHasSubfield(field, '6')) {
    const index = getMaxSubfield6(record);
    // This is done for every subfield $6... Could be optimized esp. if this includes the fields added by this script...
    if (index) {
      return {'tag': field.tag,
        'ind1': field.ind1,
        'ind2': field.ind2,
        'subfields': field.subfields.map(sf => updateSubfield6(sf, index))};
    }
  }
  return field;
}
