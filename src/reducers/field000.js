import createDebugLogger from 'debug';

export default function(base, source) {
    const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
    // Rules for handling leader
    // If 000/06 or 000/07 is different, do not merge
    debug(`base: ${JSON.stringify(base, undefined, 2)}`);
    debug(`source: ${JSON.stringify(source, undefined, 2)}`);
    if (base.leader[6] !== source.leader[6] || base.leader[7] !== source.leader[7]) {
        return base;
    }
    base.insertFields(source.fields.slice(-1));
    return base;
  }