/*
 * Inits the conguration object.
 * Sets the data types right etc so we avoid sanity checks in the code.
 */

export function initFieldMergeConfig(initData = {}) {
  const config = {
    // doNotCopyIfFieldPresent functionality should be removed eventually... (do it via configs)

    // doNotCopyIfFieldPresent prevenets copying of repeatable fields.
    // Non-repe
    doNotCopyIfFieldPresent: initData.doNotCopyIfFieldPresent, // string for regexp (mod), no validation here :(


    // Indicators are typically meaningful when comparing mergability of two fields. Override that here.
    // By default, base's indicator value is retained.
    ignoreIndicator1: initData.ignoreIndicator1 || false,
    ignoreIndicator2: initData.ignoreIndicator2 || false,
    // When fields are merged despite of difference in indicator value, typically base field's value is kept.
    // However, source's value might be used if indicator value preference is defined (per tag):
    indicator1PreferredValues: initData.indicator1PreferredValues && typeof initData.indicator1PreferredValues === 'object' ? initData.indicator1PreferredValues : false,
    indicator2PreferredValues: initData.indicator2PreferredValues && typeof initData.indicator2PreferredValues === 'object' ? initData.indicator2PreferredValues : false,

    operations: initData.operations ? initData.operations : [],

    // skipMergeTags: list of tags, that prevent merge. If empty, hard-coded defaults/education guesses will be used
    // NB! Should these be one regexp instead? NB! These should be set in config.json...
    skipMergeTags: initData.skipMergeTags && Array.isArray(initData.skipMergeTags) ? initData.skipMergeTags : [],

    // If undefined, defaults swaps (040$a -> 040$d) are performed.
    // To disable defaults use initData.swapSubfieldCodes = []
    // Note that order matters, and rules can feed each other.
    swapSubfieldCodes: initData.swapSubfieldCodes ? initData.swapSubfieldCodes : undefined,

    tagPattern: initData.tagPattern && initData.tagPattern instanceof RegExp ? initData.tagPattern : /^(?:0[1-9][0-9]|[1-9][0-9][0-9]|CAT|LOW|SID)$/u
  };
  return config;
}
