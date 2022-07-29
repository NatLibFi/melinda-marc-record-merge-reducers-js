/*
 * Inits the conguration object.
 * Sets the data types right etc so we avoid sanity checks in the code.
 */

export function initFieldMergeConfig(initData = {}) {
  const config = {
    // skipAddTags: list of tags, that prevent adding. If empty, hard-coded defaults/educated guesses are used.
    skipAddTags: initData.skipAddTags && initData.skipAddTags.isArray() ? initData.skipAddTags : [],
    // skipMergeTags: list of tags, that prevent merge. If empty, hard-coded defaults/education guesses will be used
    skipMergeTags: initData.skipMergeTags && initData.skipMergeTags.isArray() ? initData.skipMergeTags : []
  };
  return config;
}
