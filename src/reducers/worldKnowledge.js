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

export function normalizeEditionStatement(tag, subfieldCode, originalValue) {
  if (tag !== '250' && subfieldCode !== 'a') {
    return originalValue;
  }

  const value = originalValue;
  // NB! originalValue should already be lowercased, stripped on initial '[' chars and postpunctuation.

  // As normalization tries to translate things info Finnish, use this for similarity check only!
  if (value.match(/^[1-9][0-9]*(?:\.|:a|nd|rd|st|th) (?:ed\.?|edition|p\.?|painos|uppl\.?|upplagan)[.\]]*$/ui)) {
    const nth = value.replace(/[^0-9].*$/u, '');
    return `${nth}. painos`;
  }

  if (value.match(/^(?:First|Första|Ensimmäinen) (?:ed\.?|edition|p\.?|painos|uppl\.?|upplagan)[.\]]*$/ui)) {
    return `1. painos`;
  }

  if (value.match(/^(?:Andra|Second|Toinen) (?:ed\.?|edition|p\.?|painos|uppl\.?|upplagan)[.\]]*$/ui)) {
    return `2. painos`;
  }

  if (value.match(/^(?:Kolmas|Third|Tredje) (?:ed\.?|edition|p\.?|painos|uppl\.?|upplagan)[.\]]*$/ui)) {
    return `3. painos`;
  }

  if (value.match(/^(?:Fourth|Fjärde|Neljäs) (?:ed\.?|edition|p\.?|painos|uppl\.?|upplagan)[.\]]*$/ui)) {
    return `4. painos`;
  }

  return originalValue;
}
