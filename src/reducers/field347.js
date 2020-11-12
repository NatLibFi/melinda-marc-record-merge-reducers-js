import createDebugLogger from 'debug';

export default function(base, source) {
    const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
    debug(`base: ${JSON.stringify(base, undefined, 2)}`);
    debug(`source: ${JSON.stringify(source, undefined, 2)}`);

    base.insertFields(source.fields.slice(-1));
    return base;
  }