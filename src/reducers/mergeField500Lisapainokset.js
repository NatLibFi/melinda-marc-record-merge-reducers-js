import {fieldToString, nvdebug} from './utils';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeField500Lisapainokset');


export default () => (base, source) => {
  mergeLisapainokset(base);
  mergeLisapainokset(source);
  return {base, source};
};


function validLisapainosField(field) {
  // We are only interested in field 500 with a lone $a subfield.
  // Especially $9 FENNI<KEEP> should not be merged!
  if (field.tag !== '500' || field.subfields.length !== 1 || field.subfields[0].code !== 'a') {
    return false;
  }
  return field.subfields[0].value.match(/^(?:Lisäpainokset|Lisäpainos): (?:[1-9][0-9]*\. p\. [0-9]+\.)(?: - [1-9][0-9]*\. p\. [0-9]+\.)*$/u);
}

function fieldToPrintsString(field) {
  return field.subfields[0].value.replace(/^(?:Lisäpainokset|Lisäpainos): /u, '').replace(/\.$/u, '');
}

export function mergeLisapainokset(record) {
  const relevantFields = record.fields.filter(field => validLisapainosField(field));
  if (relevantFields.length < 2) {
    return;
  }

  /* eslint-disable */
  // Gather data about 500 $a Lisäpainokset.*
  let allPrintData = [];
  let i;
  let j;
  for (i=0; i < relevantFields.length; i++) {
    const value = fieldToPrintsString(relevantFields[i]);
    const fieldsPrintData = value.split('. - ');
    for (j=0; j < fieldsPrintData.length; j++) {
      const currPrintData = fieldsPrintData[j];
      // Example value: "2. p. 2020"
      const [ printIndex ] = currPrintData.split('.');
      if (allPrintData[printIndex] !== undefined) {
        if (allPrintData[printIndex] !== currPrintData) {
          nvdebug(`MISMATCH:\n '${currPrintData}'\n '${allPrintData[printIndex]}'`, debug);
          return; // reason for for-loops: exit function from within nested loops
        }
      }
      allPrintData[printIndex] = currPrintData;
    }
  };

  
  const collapsedArray = allPrintData.filter(p => p !== undefined);

  const content = "Lisäpainokset: " + collapsedArray.join('. - ') + ".";

  nvdebug(`Replace '${fieldToString(relevantFields[0])}'`, debug);
  relevantFields[0].subfields[0].value = content; // Keep the place 
  nvdebug(`with    '${fieldToString(relevantFields[0])}'`, debug);

  relevantFields.forEach((field, index) => {
    if (index > 0) {
      nvdebug(`Remove '${fieldToString(relevantFields[0])}'`, debug);
      record.removeField(field);
      return;
    }
  });
  /* eslint-enable */
}
