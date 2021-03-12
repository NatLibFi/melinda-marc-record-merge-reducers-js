import createDebugLogger from 'debug';
import {checkIdenticalness} from './utils.js';
import {copy} from '@natlibfi/marc-record-merge';

// Test 01: Identical LOW, CAT, SID --> keep base
// Test 02: Different values --> copy fields

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/(LOW|CAT|SID)$/u);
  const sourceFields = source.get(/^(LOW|CAT|SID)$/u);

  if (checkIdenticalness(baseFields, sourceFields) === true) {
    return base;
  }

  copy({tagPattern: (/(LOW|CAT|SID)$/u)});

  /***
   * Miten tämän saa toimimaan perus-copy-toiminnolla?
   * Tässä tulee TypeError: _get__(...) is not a function
   * Jos kuitenkin halutaan erillinen reducer Alephin sisäisille kentille eikä laittaa niitä suoraan vain indexiin,
   * siltä varalta että jatkossa halutaan käsitellä näitä kenttiä jotenkin eri tavalla kuin vain kopsaamalla
   * erilaiset sourcesta baseen (jota perus-copy tekee).
   */


/*  function getInternalFields() {
    if (sourceFields.every(sourceField => baseFields.some(baseField => copyField(baseField, sourceField)))) {
      const addToBase = sourceFields.filter(field => !base.containsFieldWithValue(field.tag, field.subfields));
      debug(`sf subs: ${sourceFields.map(field => field.subfields)}`);
      addToBase.forEach(field => base.insertField(field));
      addToBase.forEach(field => debug(`Copying source field ${field.tag} to base`));
      return base;
    }

    function copyField(baseField, sourceField) {
      if (### specific conditions go here ###) {
        debug(`### copyField true`);
        return true;
      }
      debug(`### copyField false`);
      debug(`Keeping base field ${baseField.tag}`);
      return false;
    }
    return base;
  }*/
}
