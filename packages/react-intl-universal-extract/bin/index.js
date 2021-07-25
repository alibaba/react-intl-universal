#!/usr/bin/env node

'use strict';
const program = require('commander');
const script = require('../src/index.js');

const runScript = (cmd, options) => {
  const result = script[cmd](options);
  if (cmd === 'extract') {
    const count = (result && result.length) || 0;
    console.log(`${count} messages extracted.`);
  }
};

function parseCmd(argv) {
  program
    .option('--cmd [required]', '[extract]')
    .option('--source-path [optional]', 'The source code directory. Example: "./src"')
    .option('--output-path [optional]', 'The output path for extracted messages. Example: "./src/locales"')
    .option('--verbose [optional]', 'Show detail message')
    .parse(argv);
  return program;
}

function execute() {
  const cmd = process.argv[3];
  const options = parseCmd(process.argv);
  switch (cmd) {
    case 'extract':
      runScript(cmd, options);
      break;
    default:
      console.log(`Unkown cmd ${cmd}.`);
  }
}

execute();