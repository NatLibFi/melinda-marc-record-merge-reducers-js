/*
 * Inits the conguration object.
 * Sets the data types right etc so we avoid sanity checks in the code.
 */

export function initFieldMergeConfig(initData = {}) {
  const config = {
    // Indicators are typically meaningful when comparing mergability of two fields. Override that here:
    ignoreIndicator1: initData.ignoreIndicator1 || false,
    ignoreIndicator2: initData.ignoreIndicator2 || false,
    // When fields are merged despite of difference in indicator value, typically base field's value is kept.
    // However, source's value might be used if indicator value preference is defined (per tag):
    indicator2PreferredValues: initData.indicator2PreferredValues && Array.isArray(initData.indicator2PreferredValues) ? initData.indicator2PreferredValues : [],

    // skipAddTags: list of tags, that prevent adding. If empty, hard-coded defaults/educated guesses are used.
    skipAddTags: initData.skipAddTags && Array.isArray(initData.skipAddTags) ? initData.skipAddTags : [],
    // skipMergeTags: list of tags, that prevent merge. If empty, hard-coded defaults/education guesses will be used
    skipMergeTags: initData.skipMergeTags && Array.isArray(initData.skipMergeTags) ? initData.skipMergeTags : [],

    tagPattern: initData.tagPattern && initData.tagPattern instanceof RegExp ? initData.tagPattern : false
  };
  return config;
}
