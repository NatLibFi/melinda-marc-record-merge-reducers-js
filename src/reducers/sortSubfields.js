import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:sortSubfields');

const defaultSortOrderString = '8673abcdefghijklmnopqrstuvwxyz420159';
const defaultSortOrder = defaultSortOrderString.split('');

// List *only* exceptional order here. Otherwise default order is used.
const subfieldSortOrder = [
  {'tag': '040', 'sortOrder': ['8', '6', 'a', 'b', 'e', 'c', 'd', 'x']},
  {'tag': '048', 'sortOrder': ['8', '6', 'b', 'a']},
  {'tag': '100', 'sortOrder': ['6', 'a', 'b', 'c', 'q', 'd', 'e', 'j', 't', 'u', 'l', 'f', '0', '5', '9']}, // don't do $g
  {'tag': '110', 'sortOrder': ['a', 'b', 'n']},
  {'tag': '111', 'sortOrder': ['a', 'n', 'd', 'c', 'e', 'g', 'j']},
  {'tag': '130', 'sortOrder': ['a', 'n', 'p', 'k', 'l']},
  {'tag': '240', 'sortOrder': ['a', 'm', 'n', 'p', 's', 'l', '2', '0', '1', '5', '9']},
  {'tag': '245', 'sortOrder': ['6', 'a', 'b', 'n', 'p', 'k', 'f', 'c']},
  {'tag': '246', 'sortOrder': ['i', 'a', 'n', 'p']},
  {'tag': '382', 'sortOrder': ['a']},
  {'tag': '385', 'sortOrder': ['8', 'm', 'n', 'a']},
  {'tag': '386', 'sortOrder': ['8', 'm', 'n', 'a']},
  {'tag': '490', 'sortOrder': ['a', 'x', 'y', 'v', 'l']},
  {'tag': '505', 'sortOrder': ['a']},
  {'tag': '526', 'sortOrder': ['i', 'a', 'b', 'x', 'z']},
  {'tag': '600', 'sortOrder': ['6', 'a', 'b', 'c', 'q', 'd', 'e', '0', '5', '9']},
  {'tag': '610', 'sortOrder': ['6', 'a', 'b', 'n']},
  {'tag': '611', 'sortOrder': ['a', 'n', 'd', 'c', 'e', 'g', 'j']},
  {'tag': '700', 'sortOrder': ['6', 'i', 'a', 'b', 'c', 'q', 'd', 'e', 't', 'u', 'l', 'f', '0', '5', '9']},
  {'tag': '710', 'sortOrder': ['a', 'b', 'n']},
  {'tag': '711', 'sortOrder': ['a', 'n', 'd', 'c', 'e', 'g', 'j']},
  {'tag': '773', 'sortOrder': ['7', 'w', 'a', 't', 'd', 'm', 'h', 'g', 'k', 'o', 'x', 'z', 'g', 'q']},
  {'tag': '776', 'sortOrder': ['i', 'a']},
  {'tag': '800', 'sortOrder': ['i', 'a', 'b', 'c', 'q', 'd', 'e', 't', 'u', 'l', 'f', '0', '5', '9']},
  {'tag': '810', 'sortOrder': ['a', 'b', 'n']},
  {'tag': '811', 'sortOrder': ['a', 'n', 'd', 'c', 'e', 'g', 'j']},
  {'tag': '830', 'sortOrder': ['a', 'n', 'x', 'v']}, // INCOMPLETE, SAME AS 490? APPARENTLY NOT...
  {'tag': '880', 'sortOrder': ['a']},
  {'tag': 'LOW', 'sortOrder': ['a', 'b', 'c', 'l', 'h']},
  {'tag': 'SID', 'sortOrder': ['c', 'b']} // Hack, so that default order is not used
];

function getSubfieldSortOrder(field) {
  const entry = subfieldSortOrder.filter(currEntry => field.tag === currEntry.tag);
  if (entry.length > 0 && 'sortOrder' in entry[0]) {
    debug(`sort order for ${field.tag}: ${entry[0].sortOrder}`);
    return entry[0].sortOrder;
  }
  //debug(`NO DROPPABLE SUBFIELDS FOUND FOR ${field.tag}.`);
  return '';
}


function swapSubfields(field, sortOrder) {
  const loopAgain = field.subfields.some((sf, index) => {
    if (index === 0) {
      return false;
    }
    const currPos = getPosition(sf, sortOrder);
    const prevPos = getPosition(field.subfields[index - 1], sortOrder);
    if (currPos === -1 || prevPos === -1 || currPos >= prevPos) {
      return false;
    }
    // Swap:
    const tmp = field.subfields[index - 1];
    field.subfields[index - 1] = sf; // eslint-disable-line functional/immutable-data
    field.subfields[index] = tmp; // eslint-disable-line functional/immutable-data
    return true;
  });

  if (loopAgain) {
    return swapSubfields(field, sortOrder);
  }

  return;

  function getPosition(subfield, sortOrder) {
    // Magic exception that *always* comes first, used by Aleph in linking overlong fields
    if (sortOrder.indexOf('9') > -1 && subfield.code === '9' && ['^', '^^'].includes(subfield.value)) {
      return -0.5; // normal "best value" is 0, and "worst value" is N
    }
    return sortOrder.indexOf(subfield.code);
  }
}

export function sortAdjacentSubfields(field) {
  // Features:
  // - Swap only sort adjacent pairs.
  // - No sorting over unlisted subfield codes. Thus a given subfield can not shift to wrong side of 700$t...

  // Implement: 880 field should use values from $6...

  // Should we support multiple sort orders per field?
  const sortOrder = getSubfieldSortOrder(field);

  //if (sortOrder === null) { return field; } //// Currently always sort..

  swapSubfields(field, ['8', '6', '7', '3', 'a', '4', '2', '0', '1', '5', '9']); // <= Handle control subfield order (it never changes)
  swapSubfields(field, sortOrder || defaultSortOrder);

  return field;
}

