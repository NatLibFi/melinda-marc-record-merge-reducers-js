//import createDebugLogger from 'debug';
import clone from 'clone';
import {fieldToString} from './utils';


//const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers/reducers/normalizeEncoding');

export default function () {

  return {
    description: 'Normalizes diacritics from latin characters',
    validate, fix
  };

  function fix(record) {
    const res = {message: [], fix: [], valid: true};
    //message.fix = []; // eslint-disable-line functional/immutable-data

    // Actual parsing of all fields
    if (!record.fields) {
      return false;
    }

    record.fields.forEach(field => {
      fieldFixComposition(field);
      //validateField(field, true, message);
    });

    // message.valid = !(message.message.length >= 1); // eslint-disable-line functional/immutable-data
    return res;
  }

  function validate(record) {
    const res = {message: []};

    // Actual parsing of all fields
    if (!record.fields) {
      return false;
    }

    record.fields.forEach(field => {
      validateField(field, res);
    });

    res.valid = !(res.message.length >= 1); // eslint-disable-line functional/immutable-data
    return res;
  }

  function validateField(field, res) {
    if (!field.subfields) {
      return;
    }
    const orig = fieldToString(field);

    const normalizedField = fieldFixComposition(clone(field));
    const mod = fieldToString(normalizedField);
    if (orig !== mod) { // Fail as the input is "broken"/"crap"/sumthing
      res.message.push(`'${orig}' requires normalization`); // eslint-disable-line functional/immutable-data
      return;
    }
    return;
  }
}


// Traditionally these six are precomposed and all the rest decomposed
function precomposeFinnishLetters(value = '') {
  return value.
    replace(/å/gu, 'å').
    replace(/ä/gu, 'ä').
    replace(/ö/gu, 'ö').
    replace(/Å/gu, 'Å').
    replace(/Ä/gu, 'Ä').
    replace(/Ö/gu, 'Ö');
}

function fixComposition(value = '') {
  // Target: Diacritics use Melinda internal notation.
  // General solution: Decompose everything and then compose 'å', 'ä', 'ö', 'Å', 'Ä' and 'Ö'.
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
  // Bug/Feature: the generic normalize() function also normalizes non-latin encodings as well, is this ok?
  // Exception: Input contains non-Latin script letters: don't decompose (see field 880 tests):
  if (value.match(/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u)) {
    // Problem with this approach: mixed language content (eg. cyrillic + latin) won't get normalized.
    // Hack/Damage control: we might add decomposition rules for most common diacritis here (eg. ü, é...).
    // OR we could split input to words and handle them separately?
    // NB! Hack not implemented yet. The main source of problematic case would probably be greek characters
    // within texts, that are written with latin alphabet.
    return precomposeFinnishLetters(value);
  }
  return precomposeFinnishLetters(String(value).normalize('NFD'));
}

export function fieldFixComposition(field) {
  if (!field.subfields) {
    return field;
  }
  //const originalValue = fieldToString(field);
  //nvdebug(`fFC: '${originalValue}'`, debug);
  field.subfields.forEach((subfield, index) => {
    field.subfields[index].value = fixComposition(subfield.value); // eslint-disable-line functional/immutable-data
  });
  //const newValue = fieldToString(field);
  //if (originalValue !== newValue) { // eslint-disable-line functional/no-conditional-statement
  //  debug(`FIXCOMP: '${originalValue}' => '${newValue}'`);
  //}
  return field;
}

/*
  export function recordFixComposition(record) {
    if (!record.fields) {
      return record;
    }
    record.fields.forEach((field, index) => {
      record.fields[index] = fieldFixComposition(field); // eslint-disable-line functional/immutable-data
    });
    return record;
  }
  */

