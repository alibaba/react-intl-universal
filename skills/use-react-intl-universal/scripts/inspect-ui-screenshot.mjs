#!/usr/bin/env node

/*
 * Purpose:
 * Inspect a saved UI screenshot and emit the immutable image metadata required
 * before the asset can be admitted as report evidence.
 */

import path from 'node:path';

import { inspectImageFile } from './lib/ui-inspection-report-contract.mjs';

/** Prints command-line usage information. */
function printHelp() {
  process.stdout.write(`Usage:
  node inspect-ui-screenshot.mjs --file PATH [--report-root PATH]

Inspect the saved PNG or JPEG bytes and print immutable asset metadata as JSON.
`);
}

/** Parses command-line arguments into script options. */
function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    if (key === 'help') {
      args.help = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

/** Runs this script's command-line workflow. */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.file) throw new Error('Usage: inspect-ui-screenshot.mjs --file <path> [--report-root <path>]');
  const absolute = path.resolve(args.file);
  const reportRoot = path.resolve(args['report-root'] || path.dirname(absolute));
  const relative = path.relative(reportRoot, absolute).replaceAll(path.sep, '/');
  if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error(`Screenshot must be inside report root: ${reportRoot}`);
  }
  const inspected = await inspectImageFile(absolute);
  process.stdout.write(`${JSON.stringify({ path: relative, ...inspected }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
