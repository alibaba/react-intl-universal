#!/usr/bin/env node

/*
 * Purpose:
 * Initialize or reuse the registry-backed report directory and report record
 * for one repository's UI inspection run.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertValidUiInspectionReport,
  computeReportShellSha256,
} from './lib/ui-inspection-report-contract.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(SCRIPT_DIR, '../references/ui-inspection-report-wireframe.html');
const REGISTRY_LOCK_FILENAME = '.ui-inspection-registry.lock';

/** Prints command-line usage information. */
function printHelp() {
  process.stdout.write(`Usage:
  node init-ui-inspection-report.mjs \\
    --registry-root PATH \\
    --task-id ID \\
    --repository PATH \\
    [creation options]

The first invocation for a task and repository also requires:
  --run-dir PATH
  --run-id ID
  --authorization inspect-only|fix-local|release-verify
  --target-url URL
  --target-locale LOCALE[,LOCALE...]
  --viewport-width NUMBER
  --viewport-height NUMBER
  --primary-inspector-id ID

Optional creation metadata:
  --branch NAME
  --baseline-commit COMMIT
  --device-scale-factor NUMBER
  --browser-zoom NUMBER
  --screen-class TEXT
  --report-language LOCALE
  --help
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

/** Parses a value as a positive number or returns a fallback. */
function positiveNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be a positive number.`);
  return parsed;
}

/** Normalizes the configured target locales into a unique list. */
function targetLocales(value) {
  const locales = value.split(',').map((locale) => locale.trim());
  if (locales.some((locale) => !locale)) {
    throw new Error('--target-locale must be a comma-separated list of non-empty locales.');
  }
  if (new Set(locales).size !== locales.length) {
    throw new Error('--target-locale must not contain duplicate locales.');
  }
  return locales;
}

/** Normalizes a target URL for task-run matching. */
function canonicalTargetUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('--target-url must be an absolute canonical application URL.');
  }
  if ([...url.searchParams.keys()].some((key) => key === '_codexVerify' || /(preview|deployment|build|release|cdnversion)/i.test(key))) {
    throw new Error('--target-url must not contain Preview or build identity parameters.');
  }
  return value;
}

/** Checks whether a path is inside a parent directory. */
function isPathWithin(rootDirectory, candidatePath) {
  const relativePath = path.relative(rootDirectory, candidatePath);
  return relativePath === '' || (
    relativePath !== '..'
    && !relativePath.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativePath)
  );
}

/** Checks whether a filesystem path exists. */
async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Finds report JSON files below a directory. */
async function reportJsonPathsBeneath(registryRoot) {
  const reportPaths = [];

  /** Recursively visits directories while collecting report JSON files. */
  async function walk(directory) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    entries.sort((left, right) => {
      if (left.name < right.name) return -1;
      if (left.name > right.name) return 1;
      return 0;
    });
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile() && entry.name === 'report.json') {
        reportPaths.push(entryPath);
      }
    }
  }

  await walk(registryRoot);
  return reportPaths;
}

/** Returns the standard artifact paths for an inspection run. */
function runPaths(reportJsonPath, report) {
  const runDirectory = path.dirname(reportJsonPath);
  const resolveRunPath = (field, fallback) => {
    const recordedPath = report.run?.[field];
    return path.resolve(runDirectory, typeof recordedPath === 'string' && recordedPath ? recordedPath : fallback);
  };
  return {
    runDirectory,
    reportJsonPath,
    reportHtmlPath: resolveRunPath('reportHtmlPath', 'report.html'),
    inspectionLogPath: resolveRunPath('inspectionLogPath', 'inspection-log.md'),
    screenshotDirectory: resolveRunPath('screenshotDirectory', 'screenshots'),
    artifactDirectory: resolveRunPath('artifactDirectory', 'artifacts'),
  };
}

/** Finds the reusable report run for the same task and repository. */
async function findExistingTaskRun(registryRoot, taskId, repository) {
  for (const reportJsonPath of await reportJsonPathsBeneath(registryRoot)) {
    let candidate;
    try {
      candidate = JSON.parse(await fs.readFile(reportJsonPath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) continue;
      throw error;
    }
    if (
      candidate?.run?.taskId === taskId
      && typeof candidate.run.repository === 'string'
      && path.resolve(candidate.run.repository) === repository
    ) {
      return runPaths(reportJsonPath, candidate);
    }
  }
  return null;
}

/** Runs an operation while holding the inspection registry lock. */
async function withRegistryLock(registryRoot, operation) {
  await fs.mkdir(registryRoot, { recursive: true });
  const lockPath = path.join(registryRoot, REGISTRY_LOCK_FILENAME);
  const deadline = Date.now() + 10_000;
  let lockHandle;
  while (!lockHandle) {
    try {
      lockHandle = await fs.open(lockPath, 'wx');
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for the UI-inspection registry lock at ${lockPath}.`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  try {
    return await operation();
  } finally {
    try {
      await lockHandle.close();
    } finally {
      await fs.rm(lockPath, { force: true });
    }
  }
}

/** Runs this script's command-line workflow. */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  for (const key of ['registry-root', 'task-id', 'repository']) {
    if (!args[key]) throw new Error(`Missing --${key}.`);
  }
  const registryRoot = path.resolve(args['registry-root']);
  const repository = path.resolve(args.repository);
  const existingRun = await findExistingTaskRun(registryRoot, args['task-id'], repository);
  if (existingRun) {
    process.stdout.write(`${JSON.stringify({ reused: true, registryRoot, ...existingRun }, null, 2)}\n`);
    return;
  }

  const creationRequired = [
    'run-dir',
    'run-id',
    'authorization',
    'target-url',
    'target-locale',
    'viewport-width',
    'viewport-height',
    'primary-inspector-id',
  ];
  for (const key of creationRequired) if (!args[key]) throw new Error(`Missing --${key}.`);
  if (!['inspect-only', 'fix-local', 'release-verify'].includes(args.authorization)) {
    throw new Error('--authorization must be inspect-only, fix-local, or release-verify.');
  }
  const runDirectory = path.resolve(args['run-dir']);
  if (!isPathWithin(registryRoot, runDirectory)) {
    throw new Error('--run-dir must be inside --registry-root so future invocations can find it.');
  }
  const locales = targetLocales(args['target-locale']);
  const targetUrl = canonicalTargetUrl(args['target-url']);
  const viewport = {
    width: Math.round(positiveNumber(args['viewport-width'], '--viewport-width')),
    height: Math.round(positiveNumber(args['viewport-height'], '--viewport-height')),
    deviceScaleFactor: positiveNumber(args['device-scale-factor'] || '1', '--device-scale-factor'),
    browserZoom: positiveNumber(args['browser-zoom'] || '1', '--browser-zoom'),
    screenClass: args['screen-class'] || 'desktop viewport',
  };

  const result = await withRegistryLock(registryRoot, async () => {
    const registeredRun = await findExistingTaskRun(registryRoot, args['task-id'], repository);
    if (registeredRun) return { reused: true, registryRoot, ...registeredRun };

    const reportJsonPath = path.join(runDirectory, 'report.json');
    const reportHtmlPath = path.join(runDirectory, 'report.html');
    const inspectionLogPath = path.join(runDirectory, 'inspection-log.md');
    const screenshotDirectory = path.join(runDirectory, 'screenshots');
    const artifactDirectory = path.join(runDirectory, 'artifacts');
    if (await pathExists(reportJsonPath)) {
      throw new Error(`Run already exists at ${reportJsonPath}, but it belongs to a different task or repository.`);
    }
    await fs.mkdir(screenshotDirectory, { recursive: true });
    await fs.mkdir(artifactDirectory, { recursive: true });
    await fs.copyFile(TEMPLATE_PATH, reportHtmlPath);
    const reportShellSha256 = computeReportShellSha256(await fs.readFile(reportHtmlPath, 'utf8'));
    const now = new Date().toISOString();
    const report = {
      revision: 1,
      run: {
        id: args['run-id'],
        taskId: args['task-id'],
        repository,
        ...(args.branch ? { branch: args.branch } : {}),
        ...(args['baseline-commit'] ? { baselineCommit: args['baseline-commit'] } : {}),
        startedAt: now,
        updatedAt: now,
        status: 'in-progress',
        authorization: args.authorization,
        primaryInspectorId: args['primary-inspector-id'],
        reportDisplayLanguage: args['report-language'] || 'en-US',
        inspectionLogPath: 'inspection-log.md',
        reportHtmlPath: 'report.html',
        screenshotDirectory: 'screenshots',
        artifactDirectory: 'artifacts',
        reportShellSha256,
        environmentNotes: [viewport.screenClass],
      },
      targets: locales.map((locale, index) => ({
        id: `TARGET-${String(index + 1).padStart(3, '0')}`,
        url: targetUrl,
        locale,
        viewport: { ...viewport },
      })),
      deployments: [],
      validations: [],
      coverage: [],
      captures: [],
      evidenceBindings: [],
      findings: [],
      observations: [],
      reviews: { codeRisk: [] },
    };
    await fs.writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
    await fs.writeFile(inspectionLogPath, `# UI Inspection Log\n\n- Run: \`${report.run.id}\`\n- Started: ${now}\n- Canonical app entry: ${targetUrl}\n- Target locales: ${locales.map((locale) => `\`${locale}\``).join(', ')}\n- Viewport: \`${viewport.width}x${viewport.height}\` CSS px, DPR ${viewport.deviceScaleFactor}, zoom ${viewport.browserZoom}\n- Authorization: \`${report.run.authorization}\`\n\n## Events\n\n`);
    await assertValidUiInspectionReport(report, { reportPath: reportJsonPath, verifyAssets: true });
    return {
      reused: false,
      registryRoot,
      runDirectory,
      reportJsonPath,
      reportHtmlPath,
      inspectionLogPath,
      screenshotDirectory,
      artifactDirectory,
    };
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
