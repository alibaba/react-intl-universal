
const DETECT_REGEXP = /(intl|IntlUtils)\s*\.\s*(get\s*\(\s*["'`]([\s\S]+?)["'`][\s\S]*?\)\s*|getHTML\s*\(\s*["'`]([\s\S]+?)["'`][\s\S]*?\))/gm;

const COMMENT_REGEXP = /(\/\/.*)|(\/\*[\s\S]*?\*\/)/gm;

module.exports = {
  DETECT_REGEXP,
  COMMENT_REGEXP
};