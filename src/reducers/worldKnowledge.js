export function valueCarriesMeaning(tag, subfieldCode, value) {
  if (tag === '260' || tag === '264') {
    // We drop these, instead of normalizing, as KV does not put this information in place...
    if (subfieldCode === 'a') {
      if (value.match(/^[^a-z]*(?:Kustannuspaikka tuntematon|S\.l)[^a-z]*$/ui)) {
        return false;
      }
    }
    if (subfieldCode === 'b') {
      if (value.match(/^[^a-z]*(?:Kustantaja tuntematon|S\.n)[^a-z]*$/ui)) {
        return false;
      }
    }
    return true;
  }
  return true;
}
