// NB! The logic of this reducer is different from others. It derives a field 776, it does not merge it.
// NB #2! This will delete fields 015, 020, 022 and 338 from source
// NB #2.1! We could (should?) do this in muuntajaConfig.json when preprocessing merge...

//import createDebugLogger from 'debug';
import ISBN from 'isbn3';

//import {fieldHasSubfield, nvdebug} from './utils';

//const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:muuntaja776');
//const debugData = debug.extend('data');

export default () => (base, source) => {
  const subfieldsForField776 = createSubfieldForField776(source);

  removeIdentifierFields(source);

  if (subfieldsForField776 !== undefined) {
    const field = {'tag': '776', 'ind1': '0', 'ind2': '8', 'subfields': subfieldsForField776};
    base.insertField(field);
    return {base, source};
  }

  return {base, source};
};

function removeIdentifierFields(record) {
  record.fields = record.fields.filter(f => !['015', '020', '022', '338'].includes(f.tag)); // eslint-disable-line functional/immutable-data
}

function createIdentiferSubfield(x, z, o) {
  if (z) {
    return {'code': 'z', 'value': z};
  }
  if (x) {
    return {'code': 'x', 'value': x};
  }
  if (o) {
    return {'code': 'o', 'value': o};
  }
  return undefined;
}

function createSubfieldForField776(record) {
  // The variable names below are based on field 776 subfield codes
  const z = getIsbn(record);
  const x = z ? undefined : getIssn(record);
  const o = x || z ? undefined : getOtherIdentifier(record);

  const idenfifierSubfield = createIdentiferSubfield(x, z, o);
  if (idenfifierSubfield === undefined) {
    return undefined;
  }


  // Add $i creation!
  const i = getRelationshipInformation(record);
  if (i === undefined) {
    return [idenfifierSubfield];
  }
  return [{'code': 'i', 'value': i}, idenfifierSubfield];
}

function getRelationshipInformation(record) {
  const field338 = record.get(/^338$/u);
  if (field338.length === 1) {
    // There should be only one $b...
    const b = field338[0].subfields.find(sf => sf.code === 'b');
    if (b) {
      if (b.value === 'cr') {
        return 'Verkkoaineisto:';
      }
      if (b.value === 'nc') {
        return 'Painettu:';
      }
    }
  }
  return undefined;
}

function getIsbn(record) {
  const fields = record.get(/^020$/u);

  const subfields = fields.map(field => field.subfields.filter(sf => getIsbnRelevantSubfield(sf))).flat();

  if (subfields.length) {
    // NB! The "recommendation" is that ISBN is returned without '-' hyphens.
    // (I think removing them is a bir stupid, but let's go with the flow):
    const isbnString = subfields[0].value.replace(/-/gu, '');
    return isbnString;
  }
  return undefined;

  function getIsbnRelevantSubfield(subfield) {
    if (subfield.code !== 'a') {
      return false;
    }
    const auditedISBN = ISBN.audit(subfield.value);
    return auditedISBN.validIsbn;
  }
}

function getIssn(record) {
  const fields = record.get(/^022$/u);
  const subfields = fields.map(field => field.subfields.filter(sf => getIssnRelevantSubfield(sf))).flat();

  if (subfields.length) {
    return subfields[0].value;
  }
  return undefined;

  function getIssnRelevantSubfield(subfield) {
    if (subfield.code !== 'a') {
      return false;
    }
    // I think there's a proper ISSN validator by P.T. under @natlibfi, but I'm too lazy to learn it now
    return subfield.value.match(/^[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9Xx]$/u);
  }
}

function getOtherIdentifier(record) {
  const fields = record.get(/^015$/u);
  const subfields = fields.map(field => field.subfields.filter(sf => isRelevantOtherIdentifier(field.tag, sf))).flat();
  if (subfields.length > 0) {
    return subfields[0].value; // might need some processing...
  }
  return undefined;

  function isRelevantOtherIdentifier(tag, sf) {
    // Currently this is pretty stupid...
    return tag && sf.code === 'a';
  }
}


