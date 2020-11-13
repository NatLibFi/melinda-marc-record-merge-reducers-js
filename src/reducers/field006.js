import createDebugLogger from 'debug';

export default function(base, source) {
    const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
    const baseFields = base.get(/^006$/);
    const sourceFields = source.get(/^006$/);
    debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
    debug(`baseFields.leader: ${baseFields.leader}`);
    debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);
    debug(`sourceFields.leader: ${sourceFields.leader}`);

    // Test 01: Jos Melinda-tietueelta puuttuu kenttä kokonaan, saa tulla, jos Leader 000/06=o tai p
    if (baseFields.length === 0 && (baseFields.leader[6] === "o" || baseFields.leader[6] === "p")) {
        debug(`Copying field from source`);
        base.insertFields(source.fields.slice(-1));
        return base;
    }
    // Test 02: Melinda on ensisijainen: jos Melindassa on jo 006 se säilytetään.
    debug(`Keeping base field`);
    return base;
  }