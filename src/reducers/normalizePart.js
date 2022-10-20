import {nvdebug} from './utils';

export function subfieldContainsPartData(tag, subfieldCode) {
  if (tag === '490' && subfieldCode === 'v') {
    return true;
  }
  if (tag === '773' && subfieldCode === 'w') {
    return true;
  }
  return false;
}

function splitPartData(value) {
  const splitPoint = value.lastIndexOf(' ');
  if (splitPoint === -1) {
    return [undefined, value];
  }
  const lhs = value.substr(0, splitPoint);
  const rhs = value.substr(splitPoint + 1);
  return [lhs, rhs];
}

function normalizePartType(originalValue) {
  if (originalValue === undefined) {
    return undefined;
  }
  const value = originalValue.toLowerCase();
  // Return Finnish singular nominative. Best-ish for debug purposes...
  if (['osa', 'part', 'teil'].includes(value)) {
    return 'osa';
  }
  if (['p.', 'page', 'pages', 'pp.', 's.', 'sidor', 'sivu', 'sivut'].includes(value)) {
    return 'sivu';
  }
  return value;
}

const romanNumbers = {'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5', 'VI': '6', 'X': '10'};

function normalizePartNumber(value) {
  // Should we handle all Roman numbers or some range of them?
  // There's probably a library for our purposes..
  if (value in romanNumbers) {
    const arabicValue = romanNumbers[value];
    nvdebug(` MAP ${value} to ${arabicValue}`);
    return arabicValue;
  }
  return value.toLowerCase();
}

function splitAndNormalizePartData(value) {
  // This is just a stub. Does not handle eg. "Levy 2, raita 15"
  const [lhs, rhs] = splitPartData(value);
  nvdebug(`  LHS: '${lhs}'`);
  nvdebug(`  RHS: '${rhs}'`);
  const partType = normalizePartType(lhs);
  const partNumber = normalizePartNumber(rhs);
  return [partType, partNumber];
}

export function partsAgree(value1, value2, tag, subfieldCode) {
  if (!subfieldContainsPartData(tag, subfieldCode)) {
    return false;
  }
  const [partType1, partNumber1] = splitAndNormalizePartData(value1);
  const [partType2, partNumber2] = splitAndNormalizePartData(value2);
  if (partNumber1 !== partNumber2) {
    return false;
  }
  if (partType1 === undefined || partType2 === undefined || partType1 === partType2) {
    return true;
  }

  return false;
}

export function normalizePartData(value, subfieldCode, tag) {
  // This is for normalizing values for equality comparison only!
  if (!subfieldContainsPartData(tag, subfieldCode)) {
    return value;
  }

  const [partType, partNumber] = splitAndNormalizePartData(value);
  if (partType === undefined) {
    return partNumber;
  }
  return `${partType} ${partNumber}`;
}
