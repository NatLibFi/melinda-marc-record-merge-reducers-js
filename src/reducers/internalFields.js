import createDebugLogger from 'debug';
import {checkIdenticalness} from './utils.js';

// Test 01: Identical LOW, CAT, SID (2x each) --> keep base
// Test 02: Different values (2x) --> copy fields

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/(LOW|CAT|SID)$/u);
  const sourceFields = source.get(/^(LOW|CAT|SID)$/u);

  // Test 01
  if (checkIdenticalness(baseFields, sourceFields) === true) {
    return base;
  }

  // Test 02
  copyInternal();

   function copyInternal() {
    const sourceTags = sourceFields.map(field => field.tag);
    sourceTags.forEach(tag => debug(`Comparing field ${tag}`));

    // Non-identical fields are copied from source to base as duplicates
    const filterMissing = function(sourceField) {
      if ('value' in sourceField) {
        debug(`Checking control field ${sourceField.tag} for identicalness`);
        return baseFields.some(isIdenticalControlField) === false;
      }
      if ('subfields' in sourceField) {
        debug(`Checking data field ${sourceField.tag} for identicalness`);
        return baseFields.some(isIdenticalDataField) === false;
      }

      function normalizeControlField(field) {
        return field.value.toLowerCase().replace(/\s+/u, '');
      }

      function isIdenticalControlField(baseField) {
        const normalizedBaseField = normalizeControlField(baseField);
        const normalizedSourceField = normalizeControlField(sourceField);
        return normalizedSourceField === normalizedBaseField;
      }
      function isIdenticalDataField(baseField) {
        if (sourceField.tag === baseField.tag &&
            sourceField.ind1 === baseField.ind1 &&
            sourceField.ind2 === baseField.ind2 &&
            sourceField.subfields.length === baseField.subfields.length) {
          return baseField.subfields.every(isIdenticalSubfield);
        }
        function normalizeSubfield(subfield) {
          return subfield.value.toLowerCase().replace(/\s+/u, '');
        }
        function isIdenticalSubfield(baseSub) {
          const normBaseSub = normalizeSubfield(baseSub);
          return sourceField.subfields.some(sourceSub => {
            const normSourceSub = normalizeSubfield(sourceSub);
            return normSourceSub === normBaseSub;
          });
        }
      }
    };
    // Search for fields missing from base
    const missingFields = sourceFields.filter(filterMissing);
    missingFields.forEach(f => base.insertField(f));
    if (missingFields.length > 0) {
      const missingTags = missingFields.map(field => field.tag);
      missingTags.forEach(tag => debug(`Field ${tag} copied from source to base`));
      return base;
    }
    if (missingFields.length === 0) {
      debug(`No missing fields found`);
      return base;
    }
    debug(`No missing fields found`);
    return base;
  }
}
