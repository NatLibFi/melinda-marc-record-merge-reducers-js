import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {
  fieldHasSubfield,
  fieldToString
} from './utils.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');





const controlSubfieldsContainingIdentifier = ['w', '0', '1'];
