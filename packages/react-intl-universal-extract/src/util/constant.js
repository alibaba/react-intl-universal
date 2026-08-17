
const DETECT_REGEXP = /(intl|IntlUtils)\s*\.\s*(get\s*\(\s*["'`]([\w\.-]+)["'`][\s\S]*?\)\s*\.\s*(defaultMessage|d)\s*\(\s*[`"']([\s\S]+?)[`"']|getHTML*\s*\(\s*["'`]([\w\.-]+)["'`][\s\S]*?\)\s*\.\s*(defaultMessage|d)\s*\(\s*(["'`<][\s\S]+?["'`>]))[\s*,]*\)/gm;

const NO_DEFAULT_REGEXP = /intl\s*\.\s*get(HTML)*\s*\(\s*["'`]([\w\.-]+)["'`]['"\w\.,{}:\s-]*\)\s*(?!\s*\.\s*(d|defaultMessage)\s*\(\s*[<'"`\s\\]+)/gm;

const COMMENT_REGEXP = /(\/\/.*)|(\/\*[\s\S]*?\*\/)/gm;

const MESSAGE_ERROR_CODE = {
  NO_DEFAULT_MESSAGE: 'NO_DEFAULT_MESSAGE',
  DEFAULT_MESSAGE_CONFLICT: 'DEFAULT_MESSAGE_CONFLICT',
};

const EXTRACT_ERROR_CODE = {
  SOURCE_SCAN_FAILED: 'SOURCE_SCAN_FAILED',
  MESSAGE_VALIDATION_FAILED: 'MESSAGE_VALIDATION_FAILED',
  OUTPUT_WRITE_FAILED: 'OUTPUT_WRITE_FAILED',
};

module.exports = {
  DETECT_REGEXP,
  COMMENT_REGEXP,
  NO_DEFAULT_REGEXP,
  MESSAGE_ERROR_CODE,
  EXTRACT_ERROR_CODE,
};
