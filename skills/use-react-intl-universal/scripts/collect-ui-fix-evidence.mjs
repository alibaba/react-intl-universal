#!/usr/bin/env node

/*
 * Purpose:
 * Collect immutable Git diff evidence and derive the minimum fix-risk level
 * for one UI inspection finding or the complete release under review.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

import { collectGitDiffEvidence, deriveRiskFloor } from './lib/ui-inspection-report-contract.mjs';

const execFile = promisify(execFileCallback);
const HELP = `Usage:
  node collect-ui-fix-evidence.mjs --repository PATH --base COMMIT --fix COMMIT --report-root PATH --diff-artifact PATH [--scope finding|release] [--finding-ids ID,ID]

Save the exact Git diff bytes and print a conservative fix or release assessment skeleton.
`;

/** Parses command-line arguments into script options. */
function parseArgs(argv) {
  if (argv.includes('--help')) return { help: true };
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

/** Classifies a changed path and assigns its conservative risk factor. */
function classifyPath(filePath) {
  const normalized = filePath.toLowerCase();
  const basename = path.posix.basename(normalized);
  if (/(^|\/)(yarn\.lock|package-lock\.json|pnpm-lock\.yaml)$/.test(normalized)) return { changeKind: 'dependency', riskFactor: 'lockfile-change' };
  if (/(^|\/)package\.json$/.test(normalized)) return { changeKind: 'dependency', riskFactor: 'dependency-change' };
  if (/(^|\/)(vite|webpack|rollup|rspack|babel|tsconfig)[^/]*\.(js|cjs|mjs|ts|json)$/.test(normalized)) {
    return { changeKind: 'build-config', riskFactor: 'build-config-change' };
  }
  if (/\.(css|less|scss|sass)$/.test(normalized) && /global|tailwind|reset|theme/.test(basename)) {
    return { changeKind: 'global-css', riskFactor: 'global-style' };
  }
  if (/\.(css|less|scss|sass)$/.test(normalized)) return { changeKind: 'local-layout', riskFactor: 'local-layout' };
  if (/(^|\/)locales?\//.test(normalized) && /\.json$/.test(normalized)) return { changeKind: 'locale-copy', riskFactor: 'multi-consumer-message' };
  if (/(^|\/)(core\/constants|constants)(\/|\.)/.test(normalized)) return { changeKind: 'shared-display-map', riskFactor: 'shared-display-copy' };
  if (/(^|\/)(shared|common|components\/base)(\/|$)/.test(normalized)) return { changeKind: 'shared-component', riskFactor: 'shared-component' };
  return { changeKind: 'other', riskFactor: 'unknown-blast-radius' };
}

/** Runs this script's command-line workflow. */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  if (!args.repository || !args.base || !args.fix || !args['report-root'] || !args['diff-artifact']) {
    throw new Error('Usage: collect-ui-fix-evidence.mjs --repository <path> --base <commit> --fix <commit> --report-root <run-folder> --diff-artifact <report-relative-path> [--scope finding|release] [--finding-ids I18N-001,I18N-002]');
  }
  const repository = path.resolve(args.repository);
  const reportRoot = path.resolve(args['report-root']);
  const diffRelative = path.posix.normalize(args['diff-artifact'].replaceAll('\\', '/'));
  if (path.posix.isAbsolute(diffRelative) || diffRelative === '..' || diffRelative.startsWith('../')) {
    throw new Error('--diff-artifact must be a report-relative path inside --report-root.');
  }
  const diffPath = path.resolve(reportRoot, diffRelative);
  const diffPathRelative = path.relative(reportRoot, diffPath);
  if (diffPathRelative === '..' || diffPathRelative.startsWith(`..${path.sep}`) || path.isAbsolute(diffPathRelative)) {
    throw new Error('--diff-artifact resolves outside --report-root.');
  }
  const evidence = await collectGitDiffEvidence(repository, args.base, args.fix);
  const { stdout: diffBytes } = await execFile(
    'git',
    ['diff', '--binary', '--full-index', `${evidence.baseCommit}..${evidence.fixCommit}`],
    { cwd: repository, encoding: 'buffer', maxBuffer: 100 * 1024 * 1024 },
  );
  const savedDiffSha256 = crypto.createHash('sha256').update(diffBytes).digest('hex');
  if (savedDiffSha256 !== evidence.diffSha256) throw new Error('Collected diff bytes changed between Git evidence reads.');
  await fs.mkdir(path.dirname(diffPath), { recursive: true });
  await fs.writeFile(diffPath, diffBytes);
  const changedFiles = evidence.changedFiles.map((filePath) => ({ path: filePath, ...classifyPath(filePath) }));
  const riskFactors = [...new Set(changedFiles.map((item) => item.riskFactor))];
  const assessment = {
    baseCommit: evidence.baseCommit,
    fixCommit: evidence.fixCommit,
    diffSha256: evidence.diffSha256,
    diffArtifact: { path: diffRelative, sha256: evidence.diffSha256 },
    changedFiles: changedFiles.map(({ path: filePath, changeKind }) => ({ path: filePath, changeKind })),
    affectedSurfaces: ['REPLACE_WITH_REVIEWED_SURFACES'],
    riskFactors,
    derivedRiskFloor: 'high',
    claimedRisk: 'high',
    rationale: 'Replace generated defaults after reviewing the actual diff. Unknown files intentionally keep risk high.',
    regressionCheckIds: ['REPLACE_WITH_ACCEPTANCE_OR_VALIDATION_ID'],
  };
  assessment.derivedRiskFloor = deriveRiskFloor(assessment);
  assessment.claimedRisk = assessment.derivedRiskFloor;
  const scope = args.scope || 'finding';
  if (!['finding', 'release'].includes(scope)) throw new Error('--scope must be finding or release.');
  if (scope === 'release') {
    const findingIds = (args['finding-ids'] || '').split(',').map((item) => item.trim()).filter(Boolean);
    if (!findingIds.length) throw new Error('--scope release requires --finding-ids.');
    assessment.findingIds = findingIds;
    assessment.validationIds = ['REPLACE_WITH_PASSING_VALIDATION_ID'];
  }
  process.stdout.write(`${JSON.stringify({ assessment, notes: [
    'This is a conservative skeleton, not an approval.',
    `The exact git diff bytes were saved at ${diffRelative}.`,
    'Review every changed file and narrow changeKind/riskFactors only when the diff proves a smaller blast radius.',
    'Independent code-risk review is still required.',
  ] }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
