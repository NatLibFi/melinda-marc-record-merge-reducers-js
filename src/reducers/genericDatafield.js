//import createDebugLogger from 'debug';

import {
  tagToRegexp,
  mergeOrAddField,
} from './mergeField.js';

// const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

// List of datafields *that are handled by the generic code*!
// NB! 100/110/111/130-700/710/711/730 stuff is in mainEntry.js
// Hmm... This list is incomplete. How to handle 6XX etc?

const datafields = [ '013', '015', '016', '017', '020', '022', '024', '028', '035', '040', '042', '050', '052', '055', '060', '070', '080', '082', '083', '084',
  '210', '240', '242', '245', '246', '250', '255', '258',
  '321', '336', '337', '338', '340', '341', '342', '343', '344', '346', '347', '348', '351', '352', '355', '362', '363', '365', '366', '370', '377', '380',
  '381', '382', '383', '385', '386', '388', '490',
  '500', '501', '502', '504', '505', '505', '506', '508', '509', '510', '511', '513', '515', '518', '520', '521', '522', '524', '525', '530', '534', '535',
  '536', '538', '540', '541', '542', '544', '545', '546', '547', '550', '552', '555', '556', '561', '562', '563', '565', '567', '580', '581', '584', '585',
  '586', '588', 
  '720', '740', '751', '752', '753', '754', '758', '760', '762', '765', '767', '770', '772', '775', '776', '777', '780', '785', '786', '787',
  '856', '883', '886', '887', '900', '910', '911', '940', '995'
];

export default () => (record, record2) => {
  datafields.forEach(tag => {
    const tagAsRegexp = tagToRegexp(tag)
    const candidateFields = record2.get(tagAsRegexp); // Get array of source fields
    candidateFields.forEach(candField => mergeOrAddField(record, candField));
  });
  return record;
};


