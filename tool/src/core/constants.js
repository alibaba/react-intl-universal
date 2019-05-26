
const DETECT_REGEXP = /(intl|IntlUtils)\s*\.\s*(get\s*\(\s*["'`]([\w\.-]+)["'`][\s\S]*?\)\s*\.\s*(defaultMessage|d)\s*\(\s*[`"']([\s\S]+?)[`"']|getHTML*\s*\(\s*["'`]([\w\.-]+)["'`][\s\S]*?\)\s*\.\s*(defaultMessage|d)\s*\(\s*(<[\s\S]+?>))[\s*,]*\)/gm;

const COMMENT_REGEXP = /(\/\/.*)|(\/\*[\s\S]*?\*\/)/gm;

module.exports = {
  DETECT_REGEXP,
  COMMENT_REGEXP,
};