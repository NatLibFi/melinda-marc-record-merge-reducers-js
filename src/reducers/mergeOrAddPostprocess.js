// This field should be renamed, as it is called also from outside megre.

//import {MarcRecord} from '@natlibfi/marc-record';
import {fieldFixPunctuation} from './punctuation.js';
import {fieldTranslateRelatorTerm, getCatalogingLanguage} from './fixRelatorTerms.js';

function postprocessBaseRecord(base, source) {
  const fromLanguage = getCatalogingLanguage(source);
  const toLanguage = getCatalogingLanguage(base);
  base.fields.forEach(field => {
    if (field.merged || field.addedd) { // eslint-disable-line functional/no-conditional-statement
      fieldTranslateRelatorTerm(field, fromLanguage, toLanguage);
    }
    // remove merge-specific information:
    if (field.merged) { // eslint-disable-line functional/no-conditional-statement
      // Field level ideas about things that could be done here:
      // - Fix indicators?
      // Record level fixes should be implemented as validators/fixers
      // in marc-record-validators-melinda and ust called from here.
      fieldFixPunctuation(field); // NB! This will fix only fields with merged content
      delete field.merged; // eslint-disable-line functional/immutable-data
    }

    if (field.punctuate) { // eslint-disable-line functional/no-conditional-statement
      delete field.punctuate; // eslint-disable-line functional/immutable-data
    }

    if (field.added) { // eslint-disable-line functional/no-conditional-statement
      delete field.added; // eslint-disable-line functional/immutable-data
    }

    /*
    if (field.deleted) { // eslint-disable-line functional/no-conditional-statement
      delete field.deleted; // eslint-disable-line functional/immutable-data
    }
*/

  });
}


function removeDeleteFields(record) {
  // remove fields that are marked as deleted:
  record.fields = record.fields.filter(f => !f.deleted); // eslint-disable-line functional/immutable-data
}


export function postprocessRecords(base, source) {
  postprocessBaseRecord(base, source);
  removeDeleteFields(source);
}
