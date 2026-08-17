#!/usr/bin/env node

/*
 * Purpose:
 * Validate one structured UI inspection report and print its derived summary
 * or the exact schema and semantic contract failures.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { validateUiInspectionReport } from './lib/ui-inspection-report-contract.mjs';

/** Parses command-line arguments into script options. */
function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    if (['json', 'no-assets'].includes(key)) {
      args[key] = true;
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
  if (!args['report-json']) {
    throw new Error('Usage: validate-ui-inspection-report.mjs --report-json <path> [--repository <path>] [--no-assets] [--json]');
  }
  const reportPath = path.resolve(args['report-json']);
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  const result = await validateUiInspectionReport(report, {
    reportPath,
    repositoryPath: path.resolve(args.repository || report.run.repository || '.'),
    verifyAssets: !args['no-assets'],
  });
  if (args.json) {
    process.stdout.write(`${JSON.stringify({ ok: result.errors.length === 0, ...result }, null, 2)}\n`);
  } else if (result.errors.length) {
    for (const error of result.errors) process.stderr.write(`${error.code} ${error.path}: ${error.message}\n`);
  } else {
    process.stdout.write(`UI inspection report is valid.\nReview digest: ${result.derived.reviewableContentSha256}\n`);
  }
  if (result.errors.length) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
