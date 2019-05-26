/**
 * Default config
 */
const { DETECT_REGEXP, COMMENT_REGEXP } = require('./constants');

module.exports = {
  common: {
    path: './src',
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    ignore: [
      // 'node_modules',
      // 'build',
      'doc',
      '.*',
      '**/*.test.*',
      '*.config.*',
      // 'mock.js',
      // 'mockdata',
    ],
  },
  detect: {
    ignoreRegexp: [
      COMMENT_REGEXP,
      DETECT_REGEXP,
    ],
  },
}
