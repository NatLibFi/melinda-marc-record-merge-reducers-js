import createDebugLogger from 'debug';

export default function(base, source) {
    const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
    debug(`base: ${JSON.stringify(base, undefined, 2)}`);
    debug(`source: ${JSON.stringify(source, undefined, 2)}`);

    // Jos Melinda-tietueelta puuttuu kenttä kokonaan, saa tulla, jos Leader 000/06=o tai p
    if (base.length === 0 && (base.leader[6] === "o" || base.leader[6] === "p")) {
        base.insertFields(source.fields.slice(-1));
        return base;
    }
    // Melinda on ensisijainen: jos Melindassa on jo 006 se säilytetään.
    return base;
  }