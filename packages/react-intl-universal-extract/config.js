module.exports = {

  /**
   * default config
   */
  common: {
    path: './src',
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    ignore: [
      'node_modules',
      'dist',
      'build',
      'doc',
      '.*',
      '**/*.test.*',
      '*.config.*',
    ],
  },
  /**
   * command config
   */
  extract: {
    sourcePath: './src', 
  }
}
