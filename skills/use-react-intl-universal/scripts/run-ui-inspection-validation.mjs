#!/usr/bin/env node

/*
 * Purpose:
 * Execute one inspection validation command and save its timing, exit status,
 * output, and content hash as a structured report artifact.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SCOPES = new Set(['report', 'source', 'locale', 'test', 'build', 'git', 'runtime', 'release']);
const HELP = `Usage:
  node run-ui-inspection-validation.mjs --id ID --scope SCOPE --report-root PATH --artifact PATH --cwd PATH -- COMMAND [ARG ...]

Run one validation command without a shell, save its complete output as a hashed artifact,
and print the report validation record as JSON.
`;

/** Parses command-line arguments into script options. */
function parseArgs(argv) {
  if (argv.includes('--help')) return { help: true, args: {}, command: [] };
  const separator = argv.indexOf('--');
  if (separator < 0 || separator === argv.length - 1) {
    throw new Error('Provide the command after --.');
  }
  const args = {};
  for (let index = 0; index < separator; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument ${token}.`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--') || index + 1 >= separator) throw new Error(`Missing value for --${key}.`);
    args[key] = value;
    index += 1;
  }
  return { args, command: argv.slice(separator + 1) };
}

/** Checks whether a path is inside a parent directory. */
function pathInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/** Quotes a command argument for readable diagnostic output. */
function quote(value) {
  return /^[A-Za-z0-9_./:=@+-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
}

/** Runs a child command and returns its process result. */
async function run(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd, shell: false, env: process.env });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (exitCode, signal) => resolve({
      exitCode: Number.isInteger(exitCode) ? exitCode : 1,
      signal: signal || null,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8'),
    }));
  });
}

/** Runs this script's command-line workflow. */
async function main() {
  const { help, args, command } = parseArgs(process.argv.slice(2));
  if (help) {
    process.stdout.write(HELP);
    return;
  }
  for (const key of ['id', 'scope', 'report-root', 'artifact', 'cwd']) {
    if (!args[key]) throw new Error(`Missing --${key}.`);
  }
  if (!SCOPES.has(args.scope)) throw new Error(`Unsupported validation scope ${args.scope}.`);
  const reportRoot = path.resolve(args['report-root']);
  const cwd = path.resolve(args.cwd);
  const artifactPath = path.resolve(reportRoot, args.artifact);
  if (!pathInside(reportRoot, artifactPath)) throw new Error('--artifact must resolve inside --report-root.');

  const startedAt = new Date().toISOString();
  const result = await run(command, cwd);
  const executedAt = new Date().toISOString();
  const commandText = command.map(quote).join(' ');
  const payload = {
    id: args.id,
    scope: args.scope,
    cwd,
    command: command,
    commandText,
    startedAt,
    executedAt,
    exitCode: result.exitCode,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
  };
  const bytes = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`);
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, bytes);
  const artifact = {
    path: path.relative(reportRoot, artifactPath).split(path.sep).join('/'),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
  const validation = {
    id: args.id,
    scope: args.scope,
    command: commandText,
    result: result.exitCode === 0 ? 'passed' : 'failed',
    executedAt,
    exitCode: result.exitCode,
    artifact,
    notes: result.exitCode === 0 ? 'Command completed successfully; see the hashed raw output artifact.' : 'Command failed; see the hashed raw output artifact.',
  };
  process.stdout.write(`${JSON.stringify({ validation }, null, 2)}\n`);
  process.exitCode = result.exitCode;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
