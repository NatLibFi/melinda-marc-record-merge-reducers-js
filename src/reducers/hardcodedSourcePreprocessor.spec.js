import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './hardcodedSourcePreprocessor';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';


// NB! fieldSpecification is for grepping the right fields!
const defaultConfig = [ // Move this to a file eventually

  {'operation': 'removeSubfield',
    'recordType': 'source',
    'fieldSpecification': {
      'tagPattern': '^(?:020|024?)$',
      'subfieldFilters': [{'code': 'c'}]
    },
    'deletableSubfieldFilter': {'code': 'c'}},

  {
    'operation': 'renameSubfield',
    'recordType': 'source',
    'fieldSpecification': {
      'tag': '040',
      'subfieldFilters': [{'code': 'a'}]
    },
    'renamableSubfieldFilter': {'code': 'a', 'newCode': 'd'}
  },

  {
    'operation': 'removeSubfield',
    'recordType': 'source',
    'fieldSpecification': {
      'tag': '041',
      'subfieldFilters': [
        {'code': 'a',
          'value': 'zxx'}
      ]
    },
    'deletableSubfieldFilter': {'code': 'a', 'value': 'zxx'}
  },

  {'operation': 'retag',
    'recordType': 'source',
    'fieldSpecification': {'tag': '100'},
    'newTag': '700'},
  {'operation': 'retag',
    'recordType': 'source',
    'fieldSpecification': {'tag': '110'},
    'newTag': '710'},
  {'operation': 'retag',
    'recordType': 'source',
    'fieldSpecification': {'tag': '111'},
    'newTag': '711'},
  {'operation': 'retag',
    'recordType': 'source',
    'fieldSpecification': {'tag': '130'},
    'newTag': '730'},


  {'operation': 'removeField',
    'comment': 'this should be done after field merge and before copy',
    'recordType': 'source',
    'fieldSpecification': {
      'tag': '240'
    },
    'requireBaseField': {
      'tagPattern': '^(130|240)$'
    }},

  {'operation': 'removeField',
    'recordType': 'source',
    'fieldSpecification': {
      'tagPattern': '^(?:648|650|651|655)$',
      'subfieldFilters': [
        {'code': '2',
          'valuePattern': '^(allars|cilla|musa|ysa)$'}
      ]
    }},

  {'operation': 'removeField',
    'recordType': 'source',
    'fieldSpecification': {
      'tag': '830',
      'subfieldFilters': [{'missingCode': 'x'}]
    }}

];


describe('source preprocessor tests: ', () => {
  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'reducers', 'preprocessSource'],
    recurse: false,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: false,
      reader: READERS.JSON
    }
  });

  function callback({getFixture,
    config = defaultConfig}) {
    const base = new MarcRecord(getFixture('base.json'), {subfieldValues: false});
    const source = new MarcRecord(getFixture('source.json'), {subfieldValues: false});
    const expectedRecord = getFixture('merged.json');
    const expectedModifiedSourceRecord = getFixture('modifiedSource.json');
    const marcReducers = generateReducers(config);
    const [mergedRecord, modifiedSourceRecord] = marcReducers(base, source);
    expect(mergedRecord.toObject()).to.eql(expectedRecord);
    expect(modifiedSourceRecord.toObject()).to.eql(expectedModifiedSourceRecord);

    function generateReducers(config) {
      return createReducer(config);
    }
  }
});
