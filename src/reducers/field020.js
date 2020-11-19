import createDebugLogger from 'debug';
import {normalizeSync} from 'normalize-diacritics';

export default ({tagPattern}) => (base, source) => {
    const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
    const baseFields = base.get(tagPattern);
    const sourceFields = source.get(tagPattern);
    debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
    debug(`base.leader: ${base.leader}`);
    debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);
    debug(`source.leader: ${source.leader}`);

    const [baseField] = baseFields;
    const [sourceField] = sourceFields;

    const baseSubsNormalized = baseField.subfields.map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}));
    debug(`baseSubsNormalized: ${JSON.stringify(baseSubsNormalized, undefined, 2)}`);
    const sourceSubsNormalized = sourceField.subfields.map(({code, value}) => ({code, value: normalizeSubfieldValue(value)}));
    debug(`sourceSubsNormalized: ${JSON.stringify(sourceSubsNormalized, undefined, 2)}`);

    const baseSubA = baseSubsNormalized.filter(subfield => subfield.code === "a")[0].value;
    debug(`baseSubA: ${JSON.stringify(baseSubA, undefined, 2)}`);
    const sourceSubA = sourceSubsNormalized.filter(subfield => subfield.code === "a")[0].value;
    debug(`sourceSubA: ${JSON.stringify(sourceSubA, undefined, 2)}`);

    /*select
    strictEquality mutta vain osakentälle ‡a?
	verrataan osakenttää ‡a > jos eri, tietueita ei yhdistetä vaan tuodaan se uutena
    väliviivoja ei huomioida vertailussa
    Niin, että kun se $a matchaa, niin pidetään pohja(Melinda) -tietueen kenttä, ja lisätään siihen lähdetietueesta ne osakentät mitä siinä ei oo
    Niitä pitää ehkä myös järjestää jotenkin fiksusti
    sit jos se $a ei matchaa, niin tuodaan koko kenttä
    */
    // Test 09: If subfield a is different, copy field from source to base as new field
    if (baseSubA !== sourceSubA) {
        debug(`Copying source field ${sourceField.tag} to base`);
        sourceFields.forEach(f => base.insertField(f));
        return base;
    }

    // Test 10: If subfield a is the same, copy other subfields from source field to base field
    // - repeatable subfields (q, z, 8) as additional copies
    // - non-repeatable subfields (c, 6) only if missing from base

    if (baseSubA === sourceSubA) {

        return base;
    }

    function normalizeSubfieldValue(value) {
        // Regexp options: g: global search, u: unicode
        const punctuation = /[.,\-/#!$%^&*;:{}=_`~()[\]]/gu;
        return normalizeSync(value).toLowerCase().replace(punctuation, '', 'u').replace(/\s+/gu, ' ').trim();
    }

    function replaceBasefieldWithSourcefield(base) {
        const index = base.fields.findIndex(field => field === baseField);
        base.fields.splice(index, 1, sourceField); // eslint-disable-line functional/immutable-data
        debug(`Replacing base field ${baseField.tag} with source`);
        return base;
    }
}