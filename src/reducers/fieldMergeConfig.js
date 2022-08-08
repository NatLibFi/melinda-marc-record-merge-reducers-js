/*
 * Inits the conguration object.
 * Sets the data types right etc so we avoid sanity checks in the code.
 */

export function initFieldMergeConfig(initData = {}) {
  const config = {
    ignoreIndicator1: initData.ignoreIndicator1 || false,
    ignoreIndicator2: initData.ignoreIndicator2 || false,
    // skipAddTags: list of tags, that prevent adding. If empty, hard-coded defaults/educated guesses are used.
    skipAddTags: initData.skipAddTags && Array.isArray(initData.skipAddTags) ? initData.skipAddTags : [],
    // skipMergeTags: list of tags, that prevent merge. If empty, hard-coded defaults/education guesses will be used
    skipMergeTags: initData.skipMergeTags && Array.isArray(initData.skipMergeTags) ? initData.skipMergeTags : []
  };
  return config;
}
