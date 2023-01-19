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
  record.fields = record.fields.filter(f => !['015', '020', '022'].includes(f.tag)); // eslint-disable-line functional/immutable-data
}

function createIdentiferSubfield(x, z, o) {
  if (x) {
    return {'code': 'x', 'value': x};
  }
  if (z) {
    return {'code': 'z', 'value': z};
  }
  if (o) {
    return {'code': 'o', 'value': o};
  }
  return undefined;
}

function createSubfieldForField776(record) {
  // The variable names below are based on field 776 subfield codes
  const x = getIsbn(record);
  const z = x ? undefined : getIssn(record);
  const o = x || z ? undefined : getOtherIdentifier(record);

  const idenfifierSubfield = createIdentiferSubfield(x, z, o);
  if (idenfifierSubfield === undefined) {
    return undefined;
  }


  // Add $i creation!

  return [idenfifierSubfield];
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
  if (fields.length > 0) {
    return undefined;
  }
  return undefined;
}

function getOtherIdentifier(record) {
  const fields = record.get(/^015$/u);
  if (fields.length > 0) {
    return undefined;
  }
  return undefined;
}


