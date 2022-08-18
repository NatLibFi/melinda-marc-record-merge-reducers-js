//import {MarcRecord} from '@natlibfi/marc-record';
import {fieldFixPunctuation} from './punctuation.js';

export function postprocessRecord(record) {
  record.fields.forEach(field => {
    // remove merge-specific information:
    if (field.merged) { // eslint-disable-line functional/no-conditional-statement

      fieldFixPunctuation(field); // NB! This will fix only fields with merged content
      // DO YOUR SHIT
      delete field.merged; // eslint-disable-line functional/immutable-data
      // NB! We could
      // - remove subsets?
      // - Fix X00 ind2 etc
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

  // remove fields that are marked as deleted:
  record.fields = record.fields.filter(f => !f.deleted); // eslint-disable-line functional/immutable-data

  return record;
}
