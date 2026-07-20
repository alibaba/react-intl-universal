#!/usr/bin/env node

'use strict';
const program = require('commander');
const { extractWithResult } = require('../src/extract');

const runScript = (cmd, options) => {
  if (cmd === 'extract') {
    const result = extractWithResult(options);
    if (result.ok) {
      console.log(`${result.messages.length} messages extracted.`);
    }
    return result;
  }
  return null;
};

function parseCmd(argv) {
  program
    .option('--cmd [required]', '[extract]')
    .option('--source-path [optional]', 'The source code directory. Example: "./src"')
    .option('--output-path [optional]', 'The output path for extracted messages. Example: "./src/locales"')
    .option('--verbose [optional]', 'Show detail message')
    .parse(argv);
  return {
    cmd: program.cmd,
    sourcePath: program.sourcePath,
    outputPath: program.outputPath,
    verbose: program.verbose,
  };
}

function execute(argv = process.argv) {
  const parsed = parseCmd(argv);
  const cmd = parsed.cmd;
  const options = {};
  ['sourcePath', 'outputPath', 'verbose'].forEach((name) => {
    if (parsed[name] !== undefined) {
      options[name] = parsed[name];
    }
  });

  switch (cmd) {
    case 'extract': {
      const result = runScript(cmd, options);
      process.exitCode = result.ok ? 0 : 1;
      return process.exitCode;
    }
    default:
      console.error(`Unknown command ${cmd || '<missing>'}.`);
      process.exitCode = 1;
      return process.exitCode;
  }
}

if (require.main === module) {
  execute();
}

module.exports = {
  execute,
  parseCmd,
  runScript,
};
