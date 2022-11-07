//import createDebugLogger from 'debug';
//import {/*fieldToString,*/ nvdebug} from './utils';


// Do later: 300/773$h, X00$e Relator term...

//const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
//const debugData = debug.extend('data');

export default () => (base, source) => {
  mtsCaseRecord(base);
  mtsCaseRecord(source);
  return {base, source};
};

function mtsQualifyingInformation(value) {
  if (value.match(/^hft[.,]?$/iu)) { // nidottu
    return 'häftad';
  }
  if (value.match(/^inb[.,]?$/iu)) {
    return 'inbunden';
  }
  if (value.match(/^mp3[.,]?$/iu)) {
    return 'MP3';
  }
  if (value.match(/^nid[.,]?$/iu)) {
    return 'nidottu';
  }
  if (value.match(/^\(?pdf\)?[.,]?$/iu)) {
    return 'PDF';
  }
  if (value.match(/^sid[.,]?$/iu)) {
    return 'sidottu';
  }

  return value;
}

function mtsCaseSubfield(tag, subfield) {
  if (['015', '020', '024', '028'].includes(tag) && subfield.code === 'q') {
    subfield.value = mtsQualifyingInformation(subfield.value); // eslint-disable-line functional/immutable-data
    return;
  }
}

function mtsCaseField(field) {
  if (field.subfields) {
    field.subfields.forEach(sf => mtsCaseSubfield(field.tag, sf));
    return;
  }
}


function mtsCaseRecord(record) {
  record.fields.forEach(field => mtsCaseField(field));
}
