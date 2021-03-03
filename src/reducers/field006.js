import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {checkIdenticalness} from './utils.js';

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^006$/u);
  const sourceFields = source.get(/^006$/u);
  debug(`### baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  debug(`### sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  if (checkIdenticalness(baseFields, sourceFields) === true) {
    return base;
  }

  // ### Olisiko joku lyhyempi ja siistimpi tapa käydä läpi useita kenttiä?
  // ### Ilman että tulee koko ajan tuplia ja pitää muuntaa stringiksi ja siivota ne pois
  // ### Mielellään vielä niin että sen voisi yleistää utilsiin,
  // ### tämä on hankala kun getFieldXXX tulee sisemmän loopin sisällä
  // ### ja se on joka kentälle aina vähän erilainen kentän speksien mukaan

  // If there are multiple instances of the field in source and/or base
  if (sourceFields.length > 1 || baseFields.length > 1) {
    debug(`### in outer loop`);
    // Iterate through all fields in base and source arrays
    const outerLoop = sourceFields.map(sourceField => {
      debug(`### in inner loop`);
      const innerLoop = baseFields.map(baseField => getField006(base, baseField, sourceField));
      debug(`### innerLoop: ${JSON.stringify(innerLoop, undefined, 2)}`);
      // Destructure array returned by innerLoop into object to pass to outerLoop
      // ### Tässä poistetaan turhaan syntynyt tupla, mutta miten sen syntymisen voisi estää? (ja samoin alempana)
      const [tempObj] = innerLoop;
      debug(`### tempObj: ${JSON.stringify(tempObj, undefined, 2)}`);
      return tempObj;
    });
    // The outer loop returns an array with as many duplicate objects as there are fields
    // Filter out duplicates and return only one result object in MarcRecord format
    const stringified = outerLoop.map(obj => JSON.stringify(obj));
    debug(`### stringified: ${JSON.stringify(stringified, undefined, 2)}`);
    const filtered = JSON.parse(stringified.filter((item, index) => stringified.indexOf(item) >= index));
    debug(`### filtered: ${JSON.stringify(filtered, undefined, 2)}`);
    return new MarcRecord(filtered);
  }

  // Default case: there is just one instance of the field in both source and base
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  const [sourceField] = sourceFields;

  // Run the function to get the base record to return
  return getField006(base, baseField, sourceField);

  function getField006(base, baseField, sourceField) {
    // Test 02: If Leader 000/06 is 'o' or 'p' in source, copy 006 from source to base as new field (2x)
    if (source.leader[6] === 'o' || source.leader[6] === 'p') {
    // Check that base does not yet contain the sourceField to be added
    // ### Tässä kohtaa pitää siivota tupla pois, jos basessa onkin useampi kpl samaa kenttää ennestään
    const bfStringified = base.fields.map(field => JSON.stringify(field));
    debug(`### bfStringified: ${JSON.stringify(bfStringified, undefined, 2)}`);
    const sfStringified = JSON.stringify(sourceField);
    debug(`### sfStringified: ${JSON.stringify(sfStringified, undefined, 2)}`);
      if (bfStringified.indexOf(sfStringified) === -1) {
        base.insertField(sourceField);
        debug(`Copying field 006 from source to base`);
        debug(`### Modified base: ${JSON.stringify(base, undefined, 2)}`);
        return base;
      }
    // If the source field has already been added
    debug(`### Not modifying base`);
    return base;
    }
    // Test 03: If Leader 000/06 is something else, do nothing
    debug(`Keeping base field 006`);
    return base;
  }
}
