
const DETECT_REGEXP = /(intl|IntlUtils)\s*\.\s*(get\s*\(\s*["'`]([\w\.-]+)["'`][\s\S]*?\)\s*\.\s*(defaultMessage|d)\s*\(\s*[`"']([\s\S]+?)[`"']|getHTML*\s*\(\s*["'`]([\w\.-]+)["'`][\s\S]*?\)\s*\.\s*(defaultMessage|d)\s*\(\s*(["'`<][\s\S]+?["'`>]))[\s*,]*\)/gm;

const NO_DEFAULT_REGEXP = /intl\s*\.\s*get(HTML)*\s*\(\s*["'`]([\w\.-]+)["'`]['"\w\.,{}:\s-]*\)\s*(?!\s*\.\s*(d|defaultMessage)\s*\(\s*[<'"`\s\\]+)/gm;

const COMMENT_REGEXP = /(\/\/.*)|(\/\*[\s\S]*?\*\/)/gm;

module.exports = {
  DETECT_REGEXP,
  COMMENT_REGEXP,
  NO_DEFAULT_REGEXP
};