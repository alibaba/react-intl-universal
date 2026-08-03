#!/usr/bin/env node

/*
 * Purpose:
 * Exercise the UI inspection structure, semantic contract, evidence integrity,
 * renderer, initializer, and command-line helpers with isolated fixtures.
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import zlib from 'node:zlib';

import {
  collectGitDiffEvidence,
  computeReportShellSha256,
  computeReviewableContentSha256,
  deriveReportSummary,
  inspectImageFile,
  validateUiInspectionReport,
} from './lib/ui-inspection-report-contract.mjs';
import { limitInlineDiff } from './lib/ui-inspection-report-presentation.mjs';

const execFile = promisify(execFileCallback);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(SCRIPT_DIR, '../references/ui-inspection-report-wireframe.html');
const RENDERER_PATH = path.resolve(SCRIPT_DIR, 'render-ui-inspection-report.mjs');
const INITIALIZER_PATH = path.resolve(SCRIPT_DIR, 'init-ui-inspection-report.mjs');
const SCREENSHOT_INSPECTOR_PATH = path.resolve(SCRIPT_DIR, 'inspect-ui-screenshot.mjs');
const COLLECT_FIX_PATH = path.resolve(SCRIPT_DIR, 'collect-ui-fix-evidence.mjs');
const VALIDATION_RUNNER_PATH = path.resolve(SCRIPT_DIR, 'run-ui-inspection-validation.mjs');
let gitFixture;
let laterGitFixture;

/** Computes a CRC-32 checksum for PNG data. */
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Builds a PNG chunk with its length and checksum. */
function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBuffer.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return result;
}

/** Creates a minimal PNG fixture with the requested dimensions. */
function createPng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const row = Buffer.alloc(1 + width * 4);
  row[0] = 0;
  for (let pixel = 0; pixel < width; pixel += 1) Buffer.from(rgba).copy(row, 1 + pixel * 4);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const PIXEL_GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
};

/** Creates a PNG fixture that resembles captured UI content. */
function createUiPng({ fixed }) {
  const width = 720;
  const height = 420;
  const pixels = Buffer.alloc(width * height * 4, 255);
  const fillRect = (x, y, rectWidth, rectHeight, color) => {
    for (let row = Math.max(0, y); row < Math.min(height, y + rectHeight); row += 1) {
      for (let column = Math.max(0, x); column < Math.min(width, x + rectWidth); column += 1) {
        const offset = (row * width + column) * 4;
        pixels[offset] = color[0];
        pixels[offset + 1] = color[1];
        pixels[offset + 2] = color[2];
        pixels[offset + 3] = color[3] ?? 255;
      }
    }
  };
  const drawText = (value, x, y, scale, color, clipRight = width) => {
    let cursor = x;
    for (const character of value.toUpperCase()) {
      if (character === ' ') {
        cursor += scale * 4;
        continue;
      }
      const glyph = PIXEL_GLYPHS[character];
      if (!glyph) continue;
      glyph.forEach((row, rowIndex) => {
        [...row].forEach((cell, columnIndex) => {
          const glyphX = cursor + columnIndex * scale;
          if (cell === '1' && glyphX < clipRight) fillRect(glyphX, y + rowIndex * scale, Math.min(scale, clipRight - glyphX), scale, color);
        });
      });
      cursor += scale * 6;
    }
  };
  const borderRect = (x, y, rectWidth, rectHeight, color) => {
    fillRect(x, y, rectWidth, 1, color);
    fillRect(x, y + rectHeight - 1, rectWidth, 1, color);
    fillRect(x, y, 1, rectHeight, color);
    fillRect(x + rectWidth - 1, y, 1, rectHeight, color);
  };

  fillRect(0, 0, width, height, [247, 249, 252, 255]);
  fillRect(0, 0, width, 54, [28, 35, 49, 255]);
  drawText('SETTINGS', 24, 17, 3, [255, 255, 255, 255]);
  fillRect(0, 54, 164, height - 54, [238, 242, 247, 255]);
  drawText('GENERAL', 24, 91, 3, [51, 61, 78, 255]);
  fillRect(12, 82, 4, 34, [43, 105, 235, 255]);
  drawText('GENERAL SETTINGS', 202, 82, 4, [34, 42, 55, 255]);
  drawText('PROFILE NAME', 202, 145, 2, [82, 92, 110, 255]);
  borderRect(202, 168, 410, 42, [190, 199, 211, 255]);
  drawText('ALICE', 218, 182, 2, [92, 102, 119, 255]);
  drawText('EMAIL', 202, 232, 2, [82, 92, 110, 255]);
  borderRect(202, 255, 410, 42, [190, 199, 211, 255]);
  drawText('ALICE', 218, 269, 2, [92, 102, 119, 255]);
  fillRect(0, 324, width, 1, [218, 224, 232, 255]);
  fillRect(202, 346, 90, 44, [43, 105, 235, 255]);
  drawText('SAVE', 214, 357, 3, [255, 255, 255, 255], fixed ? 290 : 272);
  borderRect(316, 346, 126, 44, [154, 165, 181, 255]);
  drawText('CANCEL', 328, 357, 3, [60, 70, 86, 255]);

  const rows = [];
  for (let row = 0; row < height; row += 1) {
    rows.push(Buffer.from([0]), pixels.subarray(row * width * 4, (row + 1) * width * 4));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Creates a deep JSON-compatible clone of a value. */
function clone(value) {
  return structuredClone(value);
}

/** Computes a SHA-256 digest for binary fixture content. */
function hashBytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Writes a fixture artifact and returns its report-relative integrity metadata. */
async function writeArtifact(reportRoot, relativePath, value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  const absolutePath = path.join(reportRoot, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, bytes);
  return { path: relativePath.replaceAll(path.sep, '/'), sha256: hashBytes(bytes) };
}

/** Returns a complete set of passing verification checks. */
function allChecks() {
  return {
    correctState: true,
    correctLocale: true,
    ready: true,
    noForeignOverlay: true,
    formatValid: true,
    noCorruption: true,
    targetVisible: true,
    contextSufficient: true,
    savedPixelsOpened: true,
  };
}

/** Returns verification checks for a specific evidence role. */
function evidenceChecks() {
  return {
    targetVisible: true,
    claimMatches: true,
    annotationAccurate: true,
    contextSufficient: true,
    localeCorrect: true,
    stateCorrect: true,
  };
}

/** Recomputes the fixture's frozen final-review digest and artifact record. */
async function refreshFinalReview(report, reportRoot) {
  delete report.reviews.finalReport;
  const contentSha256 = computeReviewableContentSha256(report);
  const reviewSessionId = 'REPORT-SESSION-001';
  const review = {
    id: 'REVIEW-REPORT-001',
    contentSha256,
    reportRevision: report.revision,
    reviewerId: 'independent-report-reader',
    reviewerType: 'subagent',
    reviewSessionId,
    reviewedAt: '2026-01-01T00:00:13Z',
    verdict: 'approved',
    findingReviews: report.findings.map((finding) => ({
      findingId: finding.id,
      verdict: 'approved',
      understandable: true,
      riskAssessable: true,
      notes: 'The claim, screenshots, acceptance checks, and risk evidence are understandable and consistent.',
    })),
    coverageAssessable: true,
    artifactUsable: true,
    notes: 'Independent reader approved the current report revision.',
  };
  const artifact = await writeArtifact(reportRoot, 'artifacts/reviews/final-report.json', review);
  report.reviews.finalReport = { ...review, artifact };
}

/** Creates the temporary fixture data used by the test. */
async function createFixture(root, name, sourceGitFixture = gitFixture) {
  if (!sourceGitFixture) throw new Error('Git fixture has not been initialized.');
  const { repository, baseCommit, fixCommit, diffSha256 } = sourceGitFixture;
  const reportRoot = path.join(root, name);
  const screenshotRoot = path.join(reportRoot, 'screenshots');
  const reportHtmlPath = path.join(reportRoot, 'report.html');
  await fs.mkdir(screenshotRoot, { recursive: true });
  await fs.copyFile(TEMPLATE_PATH, reportHtmlPath);
  const reportShellSha256 = computeReportShellSha256(await fs.readFile(reportHtmlPath, 'utf8'));
  const beforePath = path.join(screenshotRoot, 'before.png');
  const afterPath = path.join(screenshotRoot, 'after.png');
  await fs.writeFile(beforePath, createUiPng({ fixed: false }));
  await fs.writeFile(afterPath, createUiPng({ fixed: true }));
  const beforeAsset = await inspectImageFile(beforePath);
  const afterAsset = await inspectImageFile(afterPath);
  const viewport = { width: 720, height: 420, deviceScaleFactor: 1, browserZoom: 1, screenClass: 'desktop contract fixture' };
  const stateSnapshot = {
    key: 'route=/settings;tab=general;modal=none;filters=none;data=fixture;scroll=0,0',
    route: '/settings',
    activeSurfaces: ['General tab'],
    filters: [],
    dataState: 'fixture row visible',
    scroll: { x: 0, y: 0, container: 'document' },
  };
  const { stdout: diffBytes } = await execFile(
    'git',
    ['diff', '--binary', '--full-index', `${baseCommit}..${fixCommit}`],
    { cwd: repository, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 },
  );
  const diffArtifact = await writeArtifact(reportRoot, 'artifacts/diffs/baseline-to-final.diff', diffBytes);
  const coverageArtifact = await writeArtifact(reportRoot, 'artifacts/coverage/inventory.json', {
    generatedAt: '2026-01-01T00:00:01Z',
    sourceRefs: ['src/routes.tsx'],
    methodology: 'Static route-source scan followed by runtime confirmation of the rendered root.',
    roots: [{
      id: 'COVERAGE-001',
      targetId: 'TARGET-001',
      label: 'Settings / General',
      kind: 'route',
      url: 'https://example.test/settings',
      rendererKey: 'route:settings/general',
      sourceRefs: ['src/routes.tsx:1'],
    }],
    exclusions: [],
  });
  const baselineDeploymentArtifact = await writeArtifact(reportRoot, 'artifacts/deployments/baseline.json', {
    id: 'DEPLOY-BASELINE',
    provider: 'fixture-preview',
    status: 'published',
    previewUrl: 'https://example.test/settings?preview=baseline',
    buildCommit: baseCommit,
    publishedAt: '2026-01-01T00:00:01Z',
    command: 'fixture publish baseline',
    resultSummary: `Published ${baseCommit}`,
    rawOutput: `fixture publish completed for ${baseCommit}`,
  });
  const fixDeploymentArtifact = await writeArtifact(reportRoot, 'artifacts/deployments/fix.json', {
    id: 'DEPLOY-FIX',
    provider: 'fixture-preview',
    status: 'published',
    previewUrl: 'https://example.test/settings?preview=fix',
    buildCommit: fixCommit,
    publishedAt: '2026-01-01T00:00:08Z',
    command: 'fixture publish fix',
    resultSummary: `Published ${fixCommit}`,
    rawOutput: `fixture publish completed for ${fixCommit}`,
  });
  const validationSpecs = [
    ['VAL-TEST', 'test', ['npm', 'test', '--', 'settings'], 'npm test -- settings', 'Focused test passed.'],
    ['VAL-GIT', 'git', ['git', 'diff', '--check'], 'git diff --check', 'Diff check passed.'],
    ['VAL-RELEASE', 'release', ['verify', 'build', 'commit'], 'verify build commit', `Preview uses ${fixCommit}.`],
    ['VAL-REPORT', 'report', ['node', 'ui-inspection-report-self-test.mjs'], 'node ui-inspection-report-self-test.mjs', 'Report contract and interaction tests passed.'],
  ];
  const validations = [];
  for (const [id, scope, command, commandText, notes] of validationSpecs) {
    const artifact = await writeArtifact(reportRoot, `artifacts/validations/${id}.json`, {
      id,
      scope,
      command,
      commandText,
      executedAt: '2026-01-01T00:00:11Z',
      exitCode: 0,
      stdout: notes,
      stderr: '',
    });
    validations.push({
      id,
      scope,
      command: commandText,
      result: 'passed',
      executedAt: '2026-01-01T00:00:11Z',
      exitCode: 0,
      artifact,
      notes,
    });
  }
  const evidenceReviewSessionId = 'EVIDENCE-SESSION-001';
  const evidenceReviewRows = [
    {
      id: 'EVIDENCE-COVERAGE', captureId: 'CAPTURE-BEFORE', assetSha256: beforeAsset.sha256,
      reviewedAt: '2026-01-01T00:00:03Z', verdict: 'supports', observedText: 'Settings', checks: evidenceChecks(),
      rationale: 'The saved pixels show the intended route and state.',
    },
    {
      id: 'EVIDENCE-ISSUE', captureId: 'CAPTURE-BEFORE', assetSha256: beforeAsset.sha256,
      reviewedAt: '2026-01-01T00:00:03Z', verdict: 'supports', observedText: 'Sav', checks: evidenceChecks(),
      rationale: 'The annotation encloses the clipped label and matches the claim.',
    },
    {
      id: 'EVIDENCE-AFTER', captureId: 'CAPTURE-AFTER', assetSha256: afterAsset.sha256,
      reviewedAt: '2026-01-01T00:00:10Z', verdict: 'supports', observedText: 'Save / Cancel', checks: evidenceChecks(),
      rationale: 'The final image proves the claim in the same state and viewport.',
    },
    {
      id: 'EVIDENCE-REGRESSION', captureId: 'CAPTURE-AFTER', assetSha256: afterAsset.sha256,
      reviewedAt: '2026-01-01T00:00:10Z', verdict: 'supports', observedText: 'Cancel', checks: evidenceChecks(),
      rationale: 'The separate claim and annotation show the neighboring control and preserved action-row capacity.',
    },
  ];
  const evidenceReviewArtifact = await writeArtifact(reportRoot, 'artifacts/reviews/evidence.json', {
    reviewerId: 'independent-evidence-reader',
    reviewerType: 'subagent',
    reviewSessionId: evidenceReviewSessionId,
    reviews: evidenceReviewRows,
  });
  const codeReviewSessionId = 'CODE-SESSION-001';
  const codeReviewRecord = {
    id: 'REVIEW-CODE-001',
    scope: 'release',
    findingIds: ['I18N-001'],
    baseCommit,
    fixCommit,
    diffSha256,
    reviewerId: 'independent-code-reviewer',
    reviewerType: 'subagent',
    reviewSessionId: codeReviewSessionId,
    reviewedAt: '2026-01-01T00:00:11Z',
    verdict: 'approved',
    findings: [],
    notes: 'The diff is display-only, leaf-scoped, and covered by focused checks.',
  };
  const codeReviewArtifact = await writeArtifact(reportRoot, 'artifacts/reviews/code-risk.json', codeReviewRecord);
  const report = {
    revision: 1,
    run: {
      id: 'fixture-run',
      taskId: `fixture-task-${name}`,
      repository,
      branch: 'feat/intl',
      baselineCommit: baseCommit,
      finalCommit: fixCommit,
      startedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:12Z',
      status: 'complete-candidate',
      authorization: 'release-verify',
      primaryInspectorId: 'primary-inspector',
      reportDisplayLanguage: 'en-US',
      inspectionLogPath: 'inspection-log.md',
      reportHtmlPath: 'report.html',
      screenshotDirectory: 'screenshots',
      artifactDirectory: 'artifacts',
      reportShellSha256,
      environmentNotes: ['14-inch desktop Chrome fixture'],
    },
    targets: [{ id: 'TARGET-001', url: 'https://example.test/settings', locale: 'en_US', viewport }],
    deployments: [
      {
        id: 'DEPLOY-BASELINE',
        stage: 'baseline',
        provider: 'fixture-preview',
        status: 'published',
        previewUrl: 'https://example.test/settings?preview=baseline',
        buildCommit: baseCommit,
        publishedAt: '2026-01-01T00:00:01Z',
        evidence: { command: 'fixture publish baseline', resultSummary: `Published ${baseCommit}`, artifact: baselineDeploymentArtifact },
      },
      {
        id: 'DEPLOY-FIX',
        stage: 'fix',
        provider: 'fixture-preview',
        status: 'published',
        previewUrl: 'https://example.test/settings?preview=fix',
        buildCommit: fixCommit,
        publishedAt: '2026-01-01T00:00:08Z',
        evidence: { command: 'fixture publish fix', resultSummary: `Published ${fixCommit}`, artifact: fixDeploymentArtifact },
      },
    ],
    validations,
    coverageInventory: {
      generatedAt: '2026-01-01T00:00:01Z',
      sourceRefs: ['src/routes.tsx'],
      methodology: 'Static route-source scan followed by runtime confirmation of the rendered root.',
      rootCoverageIds: ['COVERAGE-001'],
      discoveredRootCount: 1,
      scopedRootCount: 1,
      excludedRootCount: 0,
      excludedRoots: [],
      artifact: coverageArtifact,
      notes: 'The fixture route source exposes one inspectable root.',
    },
    coverage: [
      {
        id: 'COVERAGE-001',
        targetId: 'TARGET-001',
        label: 'Settings / General',
        kind: 'route',
        url: 'https://example.test/settings',
        stateKey: stateSnapshot.key,
        action: 'Open Settings and inspect the General tab.',
        rendererKey: 'route:settings/general',
        sourceRefs: ['src/routes.tsx:1'],
        status: 'covered',
        evidenceBindingIds: ['EVIDENCE-COVERAGE'],
      },
    ],
    captures: [
      {
        id: 'CAPTURE-BEFORE',
        path: 'screenshots/before.png',
        ...beforeAsset,
        captureKind: 'full-viewport',
        captureScaleFactor: 1,
        capturedAt: '2026-01-01T00:00:02Z',
        targetId: 'TARGET-001',
        url: 'https://example.test/settings?preview=baseline',
        locale: 'en_US',
        viewport,
        stateSnapshot,
        page: 'Settings / General baseline',
        action: 'Open the route and wait for the settings form.',
        readinessSignals: ['General settings form is visible'],
        intendedUse: 'finding',
        deploymentId: 'DEPLOY-BASELINE',
        admission: {
          status: 'admitted',
          reviewedBy: 'primary-capture-reviewer',
          reviewedAt: '2026-01-01T00:00:02.500Z',
          reviewAssetSha256: beforeAsset.sha256,
          checks: allChecks(),
          rejectionReasons: [],
          notes: 'Saved pixels were opened and passed every admission check.',
        },
      },
      {
        id: 'CAPTURE-AFTER',
        path: 'screenshots/after.png',
        ...afterAsset,
        captureKind: 'full-viewport',
        captureScaleFactor: 1,
        capturedAt: '2026-01-01T00:00:09Z',
        targetId: 'TARGET-001',
        url: 'https://example.test/settings?preview=fix',
        locale: 'en_US',
        viewport,
        stateSnapshot,
        page: 'Settings / General final Preview',
        action: 'Open the same state on the fix deployment.',
        readinessSignals: ['General settings form is visible'],
        intendedUse: 'verification',
        deploymentId: 'DEPLOY-FIX',
        admission: {
          status: 'admitted',
          reviewedBy: 'primary-capture-reviewer',
          reviewedAt: '2026-01-01T00:00:09.500Z',
          reviewAssetSha256: afterAsset.sha256,
          checks: allChecks(),
          rejectionReasons: [],
          notes: 'Saved final pixels were opened and passed every admission check.',
        },
      },
    ],
    evidenceBindings: [
      {
        id: 'EVIDENCE-COVERAGE',
        ownerType: 'coverage',
        ownerId: 'COVERAGE-001',
        captureId: 'CAPTURE-BEFORE',
        role: 'coverage',
        claim: 'The Settings General route is loaded and inspectable.',
        observed: 'The route and form are visible.',
        annotation: { boxes: [{ x: 22, y: 13, width: 69, height: 82, label: 'Settings form' }] },
        review: {
          reviewerId: 'independent-evidence-reader',
          reviewerType: 'subagent',
          reviewSessionId: evidenceReviewSessionId,
          artifact: evidenceReviewArtifact,
          reviewedAt: '2026-01-01T00:00:03Z',
          assetSha256: beforeAsset.sha256,
          verdict: 'supports',
          observedText: 'Settings',
          checks: evidenceChecks(),
          rationale: 'The saved pixels show the intended route and state.',
        },
      },
      {
        id: 'EVIDENCE-ISSUE',
        ownerType: 'finding',
        ownerId: 'I18N-001',
        captureId: 'CAPTURE-BEFORE',
        role: 'issue-detail',
        claim: 'The English Save label is clipped.',
        observed: 'The final character is visibly cut off inside the button.',
        annotation: { boxes: [{ x: 27.5, y: 81.5, width: 14, height: 13, label: 'Save label clips at the right edge' }] },
        review: {
          reviewerId: 'independent-evidence-reader',
          reviewerType: 'subagent',
          reviewSessionId: evidenceReviewSessionId,
          artifact: evidenceReviewArtifact,
          reviewedAt: '2026-01-01T00:00:03Z',
          assetSha256: beforeAsset.sha256,
          verdict: 'supports',
          observedText: 'Sav',
          checks: evidenceChecks(),
          rationale: 'The annotation encloses the clipped label and matches the claim.',
        },
      },
      {
        id: 'EVIDENCE-AFTER',
        ownerType: 'finding',
        ownerId: 'I18N-001',
        captureId: 'CAPTURE-AFTER',
        role: 'verification-detail',
        claim: 'The complete Save label is visible and neighboring controls remain present.',
        observed: 'Save is fully visible and the adjacent Cancel control remains unchanged.',
        annotation: { boxes: [{ x: 27.5, y: 81.5, width: 34.5, height: 13, label: 'Save and Cancel remain intact' }] },
        review: {
          reviewerId: 'independent-evidence-reader',
          reviewerType: 'subagent',
          reviewSessionId: evidenceReviewSessionId,
          artifact: evidenceReviewArtifact,
          reviewedAt: '2026-01-01T00:00:10Z',
          assetSha256: afterAsset.sha256,
          verdict: 'supports',
          observedText: 'Save / Cancel',
          checks: evidenceChecks(),
          rationale: 'The final image proves the claim in the same state and viewport.',
        },
      },
      {
        id: 'EVIDENCE-REGRESSION',
        ownerType: 'finding',
        ownerId: 'I18N-001',
        captureId: 'CAPTURE-AFTER',
        role: 'regression-check',
        claim: 'The neighboring Cancel control remains visible and the action row retains its original capacity.',
        observed: 'Cancel remains visible next to Save and neither control overlaps or disappears.',
        annotation: { boxes: [{ x: 43.5, y: 81.5, width: 18.5, height: 13, label: 'Cancel and action-row capacity remain intact' }] },
        review: {
          reviewerId: 'independent-evidence-reader',
          reviewerType: 'subagent',
          reviewSessionId: evidenceReviewSessionId,
          artifact: evidenceReviewArtifact,
          reviewedAt: '2026-01-01T00:00:10Z',
          assetSha256: afterAsset.sha256,
          verdict: 'supports',
          observedText: 'Cancel',
          checks: evidenceChecks(),
          rationale: 'The separate claim and annotation show the neighboring control and preserved action-row capacity.',
        },
      },
    ],
    findings: [
      {
        id: 'I18N-001',
        severity: 'low',
        category: 'truncation',
        targetId: 'TARGET-001',
        url: 'https://example.test/settings',
        stateKey: stateSnapshot.key,
        title: 'Save label is clipped in English',
        reproductionSteps: ['Open Settings.', 'Keep the English locale active.', 'Inspect the Save button.'],
        expected: 'The complete Save label is readable.',
        actual: 'The final character is clipped.',
        sourceAttribution: {
          origin: 'frontend-source',
          owner: 'current repository',
          rationale: 'Source search found the leaf button label and local width in the same component.',
          searchedTerms: ['Save'],
          matches: [{ filePath: 'src/SettingsButton.tsx', line: 1, reason: 'Leaf button label and local style.' }],
          userCreatedDataAssessment: 'unlikely',
        },
        acceptanceChecks: [
          {
            id: 'ACCEPT-VISUAL',
            statement: 'Save is fully visible and Cancel remains present in the same state.',
            kind: 'visual',
            status: 'passed',
            evidenceBindingIds: ['EVIDENCE-AFTER', 'EVIDENCE-REGRESSION'],
            validationIds: [],
            notes: 'Final full-viewport evidence covers the complete visual claim.',
          },
          {
            id: 'ACCEPT-CODE',
            statement: 'Focused tests and diff validation pass.',
            kind: 'code',
            status: 'passed',
            evidenceBindingIds: [],
            validationIds: ['VAL-TEST', 'VAL-GIT'],
            notes: 'Both deterministic checks passed.',
          },
          {
            id: 'ACCEPT-RELEASE',
            statement: 'The inspected Preview uses the fix commit.',
            kind: 'release',
            status: 'passed',
            evidenceBindingIds: [],
            validationIds: ['VAL-RELEASE'],
            notes: 'Deployment build commit matches the fix commit.',
          },
        ],
        evidenceBindingIds: ['EVIDENCE-ISSUE', 'EVIDENCE-AFTER', 'EVIDENCE-REGRESSION'],
        remediation: {
          disposition: 'fixed-locally',
          recommendation: 'Adjust only the leaf button copy container.',
          validationIds: ['VAL-TEST', 'VAL-GIT', 'VAL-RELEASE'],
          fixAssessment: {
            baseCommit,
            fixCommit,
            diffSha256,
            diffArtifact,
            changedFiles: [{ path: 'src/SettingsButton.tsx', changeKind: 'leaf-ui-copy' }],
            affectedSurfaces: ['Settings / General Save button'],
            riskFactors: ['leaf-copy-only'],
            derivedRiskFloor: 'low',
            claimedRisk: 'low',
            rationale: 'The change is confined to one display-only leaf component.',
            regressionCheckIds: ['ACCEPT-VISUAL', 'VAL-TEST'],
          },
          commit: { hash: fixCommit, pushedAt: '2026-01-01T00:00:07Z' },
        },
        verification: {
          result: 'passed',
          deploymentId: 'DEPLOY-FIX',
          verifiedAt: '2026-01-01T00:00:11Z',
          verifiedAtCommit: fixCommit,
          notes: 'Final Preview and neighboring control checks passed.',
        },
        lifecycleEvents: [
          { at: '2026-01-01T00:00:04Z', type: 'finding-admitted', notes: 'Issue evidence passed independent review.' },
          { at: '2026-01-01T00:00:05Z', type: 'fix-planned', notes: 'Leaf-only fix selected.' },
          { at: '2026-01-01T00:00:06Z', type: 'fixed-locally', notes: 'Local change and checks completed.' },
          { at: '2026-01-01T00:00:07Z', type: 'committed', commit: fixCommit, notes: 'Fix commit pushed.' },
          { at: '2026-01-01T00:00:08Z', type: 'published', deploymentId: 'DEPLOY-FIX', notes: 'Exact commit published.' },
          { at: '2026-01-01T00:00:11Z', type: 'verified', deploymentId: 'DEPLOY-FIX', notes: 'All acceptance checks passed.' },
        ],
      },
    ],
    observations: [],
    releaseAssessment: {
      baseCommit,
      fixCommit,
      diffSha256,
      diffArtifact,
      findingIds: ['I18N-001'],
      changedFiles: [{ path: 'src/SettingsButton.tsx', changeKind: 'leaf-ui-copy' }],
      affectedSurfaces: ['Settings / General Save button'],
      riskFactors: ['leaf-copy-only'],
      derivedRiskFloor: 'low',
      claimedRisk: 'low',
      rationale: 'The complete baseline-to-final release contains the one leaf-scoped display fix.',
      regressionCheckIds: ['ACCEPT-VISUAL', 'VAL-TEST'],
      validationIds: ['VAL-TEST', 'VAL-GIT', 'VAL-RELEASE'],
    },
    reviews: {
      codeRisk: [
        { ...codeReviewRecord, artifact: codeReviewArtifact },
      ],
    },
  };
  await refreshFinalReview(report, reportRoot);
  const reportPath = path.join(reportRoot, 'report.json');
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return { reportRoot, reportPath, reportHtmlPath, report, beforePath, afterPath };
}

/** Duplicates a finding while reusing its recorded Git diff evidence. */
async function duplicateFindingWithSharedDiff(fixture) {
  const { report, reportRoot } = fixture;
  const original = report.findings[0];
  const duplicate = clone(original);
  duplicate.id = 'I18N-002';
  duplicate.title = 'Shared release diff also covers the secondary Save label finding';
  const bindingIdMap = new Map();
  for (const bindingId of original.evidenceBindingIds) {
    const binding = clone(report.evidenceBindings.find((item) => item.id === bindingId));
    binding.id = `${binding.id}-SECOND`;
    binding.ownerId = duplicate.id;
    bindingIdMap.set(bindingId, binding.id);
    report.evidenceBindings.push(binding);
  }
  duplicate.evidenceBindingIds = duplicate.evidenceBindingIds.map((id) => bindingIdMap.get(id));
  const acceptanceIdMap = new Map();
  duplicate.acceptanceChecks = duplicate.acceptanceChecks.map((check) => {
    const id = `${check.id}-SECOND`;
    acceptanceIdMap.set(check.id, id);
    return {
      ...check,
      id,
      evidenceBindingIds: check.evidenceBindingIds.map((bindingId) => bindingIdMap.get(bindingId)),
    };
  });
  duplicate.remediation.fixAssessment.regressionCheckIds = duplicate.remediation.fixAssessment.regressionCheckIds
    .map((id) => acceptanceIdMap.get(id) || id);
  report.findings.push(duplicate);
  report.releaseAssessment.findingIds.push(duplicate.id);

  const evidenceReview = report.evidenceBindings[0].review;
  const evidenceReviewArtifact = await writeArtifact(reportRoot, evidenceReview.artifact.path, {
    reviewerId: evidenceReview.reviewerId,
    reviewerType: evidenceReview.reviewerType,
    reviewSessionId: evidenceReview.reviewSessionId,
    reviews: report.evidenceBindings.map((binding) => ({
      id: binding.id,
      captureId: binding.captureId,
      assetSha256: binding.review.assetSha256,
      reviewedAt: binding.review.reviewedAt,
      verdict: binding.review.verdict,
      observedText: binding.review.observedText || '',
      checks: binding.review.checks,
      rationale: binding.review.rationale,
    })),
  });
  for (const binding of report.evidenceBindings) binding.review.artifact = evidenceReviewArtifact;

  const codeReview = report.reviews.codeRisk[0];
  codeReview.findingIds.push(duplicate.id);
  const { artifact: previousCodeReviewArtifact, ...codeReviewPayload } = codeReview;
  codeReview.artifact = await writeArtifact(reportRoot, previousCodeReviewArtifact.path, codeReviewPayload);
  await refreshFinalReview(report, reportRoot);
}

/** Runs report validation with fixture paths and optional overrides. */
async function validateFixture(fixture, report = fixture.report, options = {}) {
  return validateUiInspectionReport(report, {
    reportPath: fixture.reportPath,
    repositoryPath: report.run.repository,
    verifyAssets: options.verifyAssets !== false,
  });
}

/** Adds a deployment-resource proof artifact to one fixture capture. */
async function attachDeploymentIdentityProof(fixture, report, captureId, {
  requestedUrl,
  observedResourceUrl,
} = {}) {
  const capture = report.captures.find((item) => item.id === captureId);
  const deployment = report.deployments.find((item) => item.id === capture.deploymentId);
  const proof = {
    method: 'loaded-resource-url',
    requestedUrl: requestedUrl || deployment.previewUrl,
    observedResourceUrl: observedResourceUrl || `https://cdn.example.test/releases/app-${new URL(deployment.previewUrl).searchParams.get('preview')}/index.js`,
  };
  proof.artifact = await writeArtifact(
    fixture.reportRoot,
    `artifacts/deployments/${capture.id}-identity.json`,
    {
      captureId: capture.id,
      deploymentId: capture.deploymentId,
      method: proof.method,
      requestedUrl: proof.requestedUrl,
      currentUrl: capture.url,
      observedResourceUrl: proof.observedResourceUrl,
    },
  );
  capture.deploymentIdentityProof = proof;
  return proof;
}

/** Adds a runtime publication manifest artifact to one fixture capture. */
async function attachRuntimePublicationManifest(fixture, report, captureId, {
  identityValue,
  releaseVersion = 'daily/fixture',
} = {}) {
  const capture = report.captures.find((item) => item.id === captureId);
  const deployment = report.deployments.find((item) => item.id === capture.deploymentId);
  const previewUrl = new URL(deployment.previewUrl);
  const [identityKey, expectedIdentityValue] = [...previewUrl.searchParams.entries()]
    .find(([key]) => /(preview|deployment|build|release|cdnversion)/i.test(key));
  const proof = {
    method: 'runtime-publication-manifest',
    requestedUrl: deployment.previewUrl,
    runtimeIdentity: {
      identityEntries: [{ key: identityKey, value: identityValue || expectedIdentityValue }],
      releaseVersion,
      resourceUrls: ['https://cdn.example.test/releases/runtime/index.js'],
    },
  };
  proof.artifact = await writeArtifact(
    fixture.reportRoot,
    `artifacts/deployments/${capture.id}-runtime-identity.json`,
    {
      captureId: capture.id,
      deploymentId: capture.deploymentId,
      method: proof.method,
      requestedUrl: proof.requestedUrl,
      currentUrl: capture.url,
      runtimeIdentity: proof.runtimeIdentity,
    },
  );
  capture.deploymentIdentityProof = proof;
  return proof;
}

/** Creates a two-commit repository used to verify recorded fix diffs. */
async function createGitFixture(root) {
  const repository = path.join(root, 'repository');
  await fs.mkdir(path.join(repository, 'src'), { recursive: true });
  await execFile('git', ['init'], { cwd: repository });
  await execFile('git', ['config', 'user.email', 'ui-inspection@example.test'], { cwd: repository });
  await execFile('git', ['config', 'user.name', 'UI Inspection Test'], { cwd: repository });
  await fs.writeFile(path.join(repository, 'src/SettingsButton.tsx'), "export const settingsButtonLabel = 'Sav';\n");
  await fs.writeFile(path.join(repository, 'src/routes.tsx'), "export const routes = [{ path: '/settings', label: 'Settings' }];\n");
  await execFile('git', ['add', 'src/SettingsButton.tsx', 'src/routes.tsx'], { cwd: repository });
  await execFile('git', ['commit', '-m', 'baseline'], { cwd: repository });
  const { stdout: baseStdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: repository });
  await fs.writeFile(path.join(repository, 'src/SettingsButton.tsx'), "export const settingsButtonLabel = 'Save';\n");
  await execFile('git', ['add', 'src/SettingsButton.tsx'], { cwd: repository });
  await execFile('git', ['commit', '-m', 'fix'], { cwd: repository });
  const { stdout: fixStdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: repository });
  const evidence = await collectGitDiffEvidence(repository, baseStdout.trim(), fixStdout.trim());
  return { repository, ...evidence };
}

/** Creates a repository whose fix patch exceeds inline-report limits. */
async function createLargeDiffGitFixture(root) {
  const repository = path.join(root, 'large-diff-repository');
  await fs.mkdir(path.join(repository, 'src'), { recursive: true });
  await execFile('git', ['init'], { cwd: repository });
  await execFile('git', ['config', 'user.email', 'ui-inspection@example.test'], { cwd: repository });
  await execFile('git', ['config', 'user.name', 'UI Inspection Test'], { cwd: repository });
  await fs.writeFile(path.join(repository, 'src/SettingsButton.tsx'), "export const settingsButtonLabel = 'Sav';\n");
  await fs.writeFile(path.join(repository, 'src/routes.tsx'), "export const routes = [{ path: '/settings', label: 'Settings' }];\n");
  await execFile('git', ['add', 'src/SettingsButton.tsx', 'src/routes.tsx'], { cwd: repository });
  await execFile('git', ['commit', '-m', 'baseline'], { cwd: repository });
  const { stdout: baseStdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: repository });
  const generatedLines = Array.from({ length: 1800 }, (_, index) => (
    `export const generatedLabel${String(index).padStart(4, '0')} = '${'x'.repeat(72)}';`
  ));
  await fs.writeFile(path.join(repository, 'src/SettingsButton.tsx'), [
    "export const settingsButtonLabel = 'Save';",
    ...generatedLines,
    "export const inlineDiffTailMarker = 'MUST_NOT_BE_INLINE';",
    '',
  ].join('\n'));
  await execFile('git', ['add', 'src/SettingsButton.tsx'], { cwd: repository });
  await execFile('git', ['commit', '-m', 'large fix'], { cwd: repository });
  const { stdout: fixStdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: repository });
  const evidence = await collectGitDiffEvidence(repository, baseStdout.trim(), fixStdout.trim());
  return { repository, ...evidence };
}

/** Adds a later deployment and evidence set to exercise release ordering. */
async function extendFixtureToLaterRelease(fixture) {
  if (!laterGitFixture) {
    const repository = gitFixture.repository;
    await fs.writeFile(path.join(repository, 'src/SettingsHint.tsx'), "export const settingsHint = 'Changes are saved immediately.';\n");
    await execFile('git', ['add', 'src/SettingsHint.tsx'], { cwd: repository });
    await execFile('git', ['commit', '-m', 'refine settings copy'], { cwd: repository });
    const { stdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: repository });
    laterGitFixture = await collectGitDiffEvidence(repository, gitFixture.baseCommit, stdout.trim());
  }
  const report = clone(fixture.report);
  const finalCommit = laterGitFixture.fixCommit;
  const { stdout: diffBytes } = await execFile(
    'git',
    ['diff', '--binary', '--full-index', `${gitFixture.baseCommit}..${finalCommit}`],
    { cwd: gitFixture.repository, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 },
  );
  const releaseDiffArtifact = await writeArtifact(
    fixture.reportRoot,
    'artifacts/diffs/baseline-to-later-final.diff',
    diffBytes,
  );
  report.run.finalCommit = finalCommit;
  const fixDeployment = report.deployments.find((item) => item.stage === 'fix');
  fixDeployment.buildCommit = finalCommit;
  fixDeployment.previewUrl = 'https://example.test/settings?preview=fix-later';
  fixDeployment.evidence.resultSummary = `Published ${finalCommit}`;
  fixDeployment.evidence.artifact = await writeArtifact(
    fixture.reportRoot,
    fixDeployment.evidence.artifact.path,
    {
      id: fixDeployment.id,
      provider: fixDeployment.provider,
      status: fixDeployment.status,
      previewUrl: fixDeployment.previewUrl,
      buildCommit: fixDeployment.buildCommit,
      publishedAt: fixDeployment.publishedAt,
      command: fixDeployment.evidence.command,
      resultSummary: fixDeployment.evidence.resultSummary,
      rawOutput: `fixture publish completed for ${finalCommit}`,
    },
  );
  const finalCapture = report.captures.find((item) => item.id === 'CAPTURE-AFTER');
  finalCapture.url = fixDeployment.previewUrl;
  report.findings[0].verification.verifiedAtCommit = finalCommit;
  report.releaseAssessment = {
    baseCommit: gitFixture.baseCommit,
    fixCommit: finalCommit,
    diffSha256: laterGitFixture.diffSha256,
    diffArtifact: releaseDiffArtifact,
    findingIds: ['I18N-001'],
    changedFiles: [
      { path: 'src/SettingsButton.tsx', changeKind: 'leaf-ui-copy' },
      { path: 'src/SettingsHint.tsx', changeKind: 'leaf-ui-copy' },
    ],
    affectedSurfaces: ['Settings / General Save button and adjacent hint'],
    riskFactors: ['leaf-copy-only'],
    derivedRiskFloor: 'low',
    claimedRisk: 'low',
    rationale: 'The later release retains the original fix and adds one leaf-only settings hint.',
    regressionCheckIds: ['ACCEPT-VISUAL', 'VAL-TEST'],
    validationIds: ['VAL-TEST', 'VAL-GIT', 'VAL-RELEASE'],
  };
  const findingReview = report.reviews.codeRisk[0];
  findingReview.scope = 'finding';
  findingReview.findingIds = ['I18N-001'];
  const findingReviewPayload = { ...findingReview };
  delete findingReviewPayload.artifact;
  findingReview.artifact = await writeArtifact(
    fixture.reportRoot,
    'artifacts/reviews/code-risk-finding.json',
    findingReviewPayload,
  );
  const releaseReviewPayload = {
    id: 'REVIEW-CODE-RELEASE-002',
    scope: 'release',
    findingIds: ['I18N-001'],
    baseCommit: gitFixture.baseCommit,
    fixCommit: finalCommit,
    diffSha256: laterGitFixture.diffSha256,
    reviewerId: 'independent-release-code-reviewer',
    reviewerType: 'subagent',
    reviewSessionId: 'CODE-SESSION-002',
    reviewedAt: '2026-01-01T00:00:11Z',
    verdict: 'approved',
    findings: [],
    notes: 'The complete later release remains leaf-scoped and preserves the original control behavior.',
  };
  const releaseReviewArtifact = await writeArtifact(
    fixture.reportRoot,
    'artifacts/reviews/code-risk-release.json',
    releaseReviewPayload,
  );
  report.reviews.codeRisk.push({ ...releaseReviewPayload, artifact: releaseReviewArtifact });
  await refreshFinalReview(report, fixture.reportRoot);
  return report;
}

/** Asserts that validation produced the expected error code. */
function expectCode(result, code) {
  assert(result.errors.some((error) => error.code === code), `Expected ${code}; received ${JSON.stringify(result.errors, null, 2)}`);
}

test('UI inspection report contract and renderer', async (suite) => {
  const requestedRoot = process.env.UI_INSPECTION_TEST_ROOT;
  const root = requestedRoot
    ? path.resolve(requestedRoot)
    : await fs.mkdtemp(path.join(os.tmpdir(), 'ui-inspection-report-'));
  await fs.mkdir(root, { recursive: true });
  if (!requestedRoot) suite.after(async () => fs.rm(root, { recursive: true, force: true }));
  if (requestedRoot) process.stderr.write(`# UI inspection test artifacts: ${root}\n`);
  gitFixture = await createGitFixture(root);

  await suite.test('limits large inline diffs while preserving a complete small diff', () => {
    const small = limitInlineDiff('diff --git a/a b/a\n+fixed\n');
    assert.equal(small.truncated, false);
    assert.match(small.content, /\+fixed/);
    const large = limitInlineDiff(`diff --git a/a b/a\n${'+x\n'.repeat(20)}`, { maxBytes: 40, maxLines: 8 });
    assert.equal(large.truncated, true);
    assert(Buffer.byteLength(large.content, 'utf8') <= 40);
    assert(large.content.split('\n').length <= 8);
  });

  await suite.test('accepts a fully evidenced completed report', async () => {
    const fixture = await createFixture(root, 'valid');
    const result = await validateFixture(fixture);
    assert.deepEqual(result.errors, []);
    assert.equal(result.derived.summary.issues.found, 1);
    assert.equal(result.derived.summary.issues.fixed, 1);
    assert.equal(result.derived.summary.issues.needAttention, 0);
  });

  await suite.test('keeps verified medium-risk fixes out of the unresolved-finding metric', async () => {
    const fixture = await createFixture(root, 'medium-risk-summary');
    fixture.report.findings[0].remediation.fixAssessment.riskFactors = ['local-layout'];
    fixture.report.findings[0].remediation.fixAssessment.changedFiles[0].changeKind = 'local-layout';
    fixture.report.findings[0].remediation.fixAssessment.derivedRiskFloor = 'medium';
    fixture.report.findings[0].remediation.fixAssessment.claimedRisk = 'medium';
    fixture.report.releaseAssessment.riskFactors = ['local-layout'];
    fixture.report.releaseAssessment.changedFiles[0].changeKind = 'local-layout';
    fixture.report.releaseAssessment.derivedRiskFloor = 'medium';
    fixture.report.releaseAssessment.claimedRisk = 'medium';
    const summary = deriveReportSummary(fixture.report);
    assert.equal(summary.issues.needAttention, 0);
    assert.equal(summary.release.needsAttention, true);
    assert.equal(summary.attention.total, 1);
  });

  await suite.test('renders two-column finding previews and preserves natural-pixel lightbox interactions', async () => {
    const fixture = await createFixture(root, 'render');
    await attachDeploymentIdentityProof(fixture, fixture.report, 'CAPTURE-AFTER');
    await refreshFinalReview(fixture.report, fixture.reportRoot);
    await fs.writeFile(fixture.reportPath, `${JSON.stringify(fixture.report, null, 2)}\n`);
    await execFile(process.execPath, [RENDERER_PATH, '--report-json', fixture.reportPath, '--output', fixture.reportHtmlPath]);
    const html = await fs.readFile(fixture.reportHtmlPath, 'utf8');
    assert.match(html, /id="finding-overview"/);
    assert.match(html, /id="lightbox"/);
    assert.match(html, /\.real-shot\s*\{[\s\S]*?max-width:\s*none/);
    assert.match(html, /\.annotated-stage\.with-image\s*\{[\s\S]*?width:\s*max-content/);
    assert.match(html, /\.finding-evidence-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(html, /\.finding-evidence-grid \.real-shot\s*\{[\s\S]*?width:\s*100%/);
    assert.match(html, /\.lightbox-stage \.real-shot\s*\{[\s\S]*?width:\s*auto/);
    assert.match(html, /data-evidence-side="before"/);
    assert.match(html, /data-evidence-side="after"/);
    assert.match(html, /Final Preview evidence · Original-function regression evidence/);
    const acceptanceTable = html.match(/<table class="table table-sm acceptance-table">[\s\S]*?<\/table>/)?.[0] || '';
    assert.match(acceptanceTable, /EVIDENCE-REGRESSION \(Original-function regression evidence\)/);
    assert.doesNotMatch(acceptanceTable, /regression-check/);
    assert.match(html, /class="fix-diff" open/);
    assert.match(html, /Fix code diff/);
    assert.match(html, /diff --git/);
    assert.doesNotMatch(html, /localStorage|storageKey|persistFeedback|hydrateFeedback/);
    assert.equal((html.match(/data-finding-evidence-capture="CAPTURE-AFTER"/g) || []).length, 1, 'final and regression claims should share one rendered screenshot when they use the same capture');
    const beforeGroup = html.match(/data-finding-evidence-capture="CAPTURE-BEFORE"[\s\S]*?<\/article>/)?.[0] || '';
    const afterGroup = html.match(/data-finding-evidence-capture="CAPTURE-AFTER"[\s\S]*?<\/article>/)?.[0] || '';
    assert.match(beforeGroup, /class="redbox/, 'before screenshots must retain binding-specific HTML annotations');
    assert.match(afterGroup, /class="redbox/, 'after screenshots must retain binding-specific HTML annotations');
    assert.match(html, /Claim this image must prove/);
    assert.match(html, /raw publish evidence/);
    assert.match(html, /readable release diff/);
    assert.match(html, /Current release verification/);
    assert.match(html, /raw review/);
    assert.match(html, /raw output/);
    assert.match(html, /SPA deployment proof/);
    assert.match(html, /raw identity proof/);
    assert.doesNotMatch(html, /mock-shot|data-template-sample/);
    await execFile(process.execPath, [RENDERER_PATH, '--report-json', fixture.reportPath, '--output', fixture.reportHtmlPath]);
  });

  await suite.test('limits and de-duplicates repeated large inline diffs while retaining raw links', async () => {
    const largeGitFixture = await createLargeDiffGitFixture(root);
    const fixture = await createFixture(root, 'render-large-shared-diff', largeGitFixture);
    await duplicateFindingWithSharedDiff(fixture);
    await fs.writeFile(fixture.reportPath, `${JSON.stringify(fixture.report, null, 2)}\n`);
    await execFile(process.execPath, [RENDERER_PATH, '--report-json', fixture.reportPath, '--output', fixture.reportHtmlPath]);
    const html = await fs.readFile(fixture.reportHtmlPath, 'utf8');
    assert.match(html, /Inline preview limited to 800 lines \/ 65536 bytes/);
    assert.match(html, /Inline preview omitted because this large validated diff is already shown under/);
    assert.equal((html.match(/<pre><code>diff --git/g) || []).length, 1);
    assert.equal((html.match(/>open raw diff<\/a>/g) || []).length, 2);
    assert.doesNotMatch(html, /MUST_NOT_BE_INLINE/);
  });

  await suite.test('rejects unknown report fields', async () => {
    const fixture = await createFixture(root, 'unknown-field');
    const report = clone(fixture.report);
    report.unexpected = true;
    const result = await validateFixture(fixture, report, { verifyAssets: false });
    expectCode(result, 'schema');
    assert(result.errors.some((error) => /Unknown property/.test(error.message)));
  });

  await suite.test('rejects validation artifacts without raw argv and canonical command text', async () => {
    const fixture = await createFixture(root, 'validation-command-shape');
    const report = clone(fixture.report);
    const validation = report.validations.find((item) => item.id === 'VAL-TEST');
    validation.artifact = await writeArtifact(fixture.reportRoot, validation.artifact.path, {
      id: validation.id,
      scope: validation.scope,
      command: validation.command,
      executedAt: validation.executedAt,
      exitCode: validation.exitCode,
      stdout: 'Focused test passed.',
      stderr: '',
    });
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'artifact-content-mismatch');
    assert(result.errors.some((error) => /raw argument array/.test(error.message)));
    assert(result.errors.some((error) => /commandText/.test(error.message)));
  });

  await suite.test('rejects coverage evidence bound as finding issue evidence', async () => {
    const fixture = await createFixture(root, 'wrong-role');
    const report = clone(fixture.report);
    report.evidenceBindings.find((item) => item.id === 'EVIDENCE-ISSUE').role = 'coverage';
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'binding-role-owner-mismatch');
    expectCode(result, 'finding-without-supported-issue');
  });

  await suite.test('rejects a finding admitted before its baseline evidence review', async () => {
    const fixture = await createFixture(root, 'premature-finding-admission');
    const report = clone(fixture.report);
    report.findings[0].lifecycleEvents.find((event) => event.type === 'finding-admitted').at = '2026-01-01T00:00:02.750Z';
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'finding-admitted-before-evidence-review');
  });

  await suite.test('preserves the original admission review when issue annotations are re-reviewed later', async () => {
    const fixture = await createFixture(root, 'issue-annotation-rereview');
    const report = clone(fixture.report);
    const binding = report.evidenceBindings.find((item) => item.id === 'EVIDENCE-ISSUE');
    binding.admissionReview = clone(binding.review);
    binding.annotation.boxes = [{ x: 38, y: 78, width: 18, height: 14, label: 'Corrected issue annotation' }];
    binding.review = {
      ...binding.review,
      reviewerId: 'independent-evidence-rereviewer',
      reviewSessionId: 'EVIDENCE-SESSION-REREVIEW-001',
      reviewedAt: '2026-01-01T00:00:10Z',
      observedText: 'The corrected box targets the clipped Save label.',
      rationale: 'A later report QA pass confirmed the corrected annotation against the same immutable pixels.',
    };
    binding.review.artifact = await writeArtifact(fixture.reportRoot, 'artifacts/reviews/evidence-rereview.json', {
      reviewerId: binding.review.reviewerId,
      reviewerType: binding.review.reviewerType,
      reviewSessionId: binding.review.reviewSessionId,
      reviews: [{
        id: binding.id,
        captureId: binding.captureId,
        assetSha256: binding.review.assetSha256,
        reviewedAt: binding.review.reviewedAt,
        verdict: binding.review.verdict,
        observedText: binding.review.observedText,
        checks: binding.review.checks,
        rationale: binding.review.rationale,
      }],
    });
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    assert.deepEqual(result.errors, []);
  });

  await suite.test('rejects a fixed finding without an explicit fix-planned transition', async () => {
    const fixture = await createFixture(root, 'missing-fix-planned');
    const report = clone(fixture.report);
    report.findings[0].lifecycleEvents = report.findings[0].lifecycleEvents.filter((event) => event.type !== 'fix-planned');
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'missing-lifecycle-event');
  });

  await suite.test('rejects wrong locale and state evidence', async () => {
    const fixture = await createFixture(root, 'wrong-state');
    const report = clone(fixture.report);
    report.captures[1].locale = 'zh_CN';
    report.captures[1].stateSnapshot.key = 'different-state';
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'capture-locale-mismatch');
    expectCode(result, 'binding-state-mismatch');
    expectCode(result, 'before-after-not-comparable');
  });

  await suite.test('rejects ordinary regression evidence from another target', async () => {
    const fixture = await createFixture(root, 'regression-wrong-target');
    const report = clone(fixture.report);
    const alternateTarget = clone(report.targets[0]);
    alternateTarget.id = 'TARGET-ALT';
    alternateTarget.locale = 'zh_CN';
    report.targets.push(alternateTarget);
    const regressionCapture = clone(report.captures.find((item) => item.id === 'CAPTURE-AFTER'));
    regressionCapture.id = 'CAPTURE-REGRESSION-ALT';
    regressionCapture.targetId = alternateTarget.id;
    regressionCapture.locale = alternateTarget.locale;
    report.captures.push(regressionCapture);
    report.evidenceBindings.find((item) => item.id === 'EVIDENCE-REGRESSION').captureId = regressionCapture.id;
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report, { verifyAssets: false });
    expectCode(result, 'binding-target-mismatch');
  });

  await suite.test('rejects ordinary regression evidence from another finding state', async () => {
    const fixture = await createFixture(root, 'regression-wrong-state');
    const report = clone(fixture.report);
    const regressionCapture = clone(report.captures.find((item) => item.id === 'CAPTURE-AFTER'));
    regressionCapture.id = 'CAPTURE-REGRESSION-ALT-STATE';
    regressionCapture.stateSnapshot = {
      ...regressionCapture.stateSnapshot,
      key: 'route=/settings;tab=advanced;modal=none;filters=none;data=fixture;scroll=0,0',
      activeSurfaces: ['Advanced tab'],
    };
    report.captures.push(regressionCapture);
    report.evidenceBindings.find((item) => item.id === 'EVIDENCE-REGRESSION').captureId = regressionCapture.id;
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report, { verifyAssets: false });
    expectCode(result, 'binding-state-mismatch');
  });

  await suite.test('allows alternate target and state only for dedicated cross-locale regression acceptance', async () => {
    const fixture = await createFixture(root, 'cross-locale-alternate-state');
    const report = clone(fixture.report);
    const finding = report.findings[0];
    const alternateTarget = {
      ...clone(report.targets[0]),
      id: 'TARGET-ZH-CROSS-LOCALE',
      locale: 'zh_CN',
    };
    report.targets.push(alternateTarget);
    const regressionCapture = clone(report.captures.find((item) => item.id === 'CAPTURE-AFTER'));
    regressionCapture.id = 'CAPTURE-CROSS-LOCALE';
    regressionCapture.targetId = alternateTarget.id;
    regressionCapture.locale = alternateTarget.locale;
    regressionCapture.stateSnapshot = {
      ...regressionCapture.stateSnapshot,
      key: 'route=/settings;tab=advanced;modal=none;filters=none;data=fixture-zh;scroll=0,0',
      activeSurfaces: ['Advanced tab'],
      dataState: 'Chinese fixture row visible',
    };
    report.captures.push(regressionCapture);
    report.evidenceBindings.find((item) => item.id === 'EVIDENCE-REGRESSION').captureId = regressionCapture.id;
    finding.acceptanceChecks.find((check) => check.id === 'ACCEPT-VISUAL').evidenceBindingIds = ['EVIDENCE-AFTER'];
    finding.acceptanceChecks.push({
      id: 'ACCEPT-CROSS-LOCALE',
      statement: 'The alternate locale and representative state remain intact.',
      kind: 'cross-locale',
      status: 'passed',
      evidenceBindingIds: ['EVIDENCE-REGRESSION'],
      validationIds: [],
      notes: 'Dedicated alternate-locale regression evidence covers this acceptance only.',
    });
    finding.remediation.fixAssessment.regressionCheckIds = ['ACCEPT-CROSS-LOCALE', 'VAL-TEST'];
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report, { verifyAssets: false });
    assert.deepEqual(result.errors, []);
  });

  await suite.test('rejects every failed-verification evidence binding from another deployment', async () => {
    const fixture = await createFixture(root, 'failed-verification-wrong-deployment');
    const report = clone(fixture.report);
    const finding = report.findings[0];
    const failedBinding = clone(report.evidenceBindings.find((item) => item.id === 'EVIDENCE-AFTER'));
    failedBinding.id = 'EVIDENCE-FAILED';
    failedBinding.role = 'failed-verification';
    failedBinding.captureId = 'CAPTURE-BEFORE';
    failedBinding.review.assetSha256 = report.captures.find((item) => item.id === 'CAPTURE-BEFORE').sha256;
    failedBinding.review.verdict = 'uncertain';
    report.evidenceBindings.push(failedBinding);
    finding.evidenceBindingIds.push(failedBinding.id);
    finding.verification = {
      result: 'failed',
      deploymentId: 'DEPLOY-FIX',
      verifiedAt: '2026-01-01T00:00:12Z',
      verifiedAtCommit: finding.remediation.fixAssessment.fixCommit,
      notes: 'The attempted fix did not resolve the issue.',
    };
    finding.lifecycleEvents.push({
      type: 'verification-failed',
      at: '2026-01-01T00:00:12Z',
      deploymentId: 'DEPLOY-FIX',
      notes: 'The attempted fix did not resolve the issue.',
    });
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report, { verifyAssets: false });
    expectCode(result, 'failed-evidence-deployment-mismatch');
  });

  await suite.test('rejects changed state details even when the state key is reused', async () => {
    const fixture = await createFixture(root, 'wrong-state-details');
    const report = clone(fixture.report);
    report.captures[1].stateSnapshot = {
      ...report.captures[1].stateSnapshot,
      dataState: 'different representative row',
    };
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'before-after-not-comparable');
  });

  await suite.test('rejects saved pixels changed after review', async () => {
    const fixture = await createFixture(root, 'asset-mutation');
    await fs.writeFile(fixture.afterPath, createPng(120, 80, [10, 10, 10, 255]));
    const result = await validateFixture(fixture);
    expectCode(result, 'capture-asset-mismatch');
  });

  await suite.test('rejects zero-area and out-of-bounds annotations', async () => {
    const fixture = await createFixture(root, 'annotation');
    const report = clone(fixture.report);
    const box = report.evidenceBindings.find((item) => item.id === 'EVIDENCE-ISSUE').annotation.boxes[0];
    box.width = 0;
    box.x = 99;
    const result = await validateFixture(fixture, report, { verifyAssets: false });
    expectCode(result, 'schema');
  });

  await suite.test('rejects final acceptance backed only by before evidence', async () => {
    const fixture = await createFixture(root, 'acceptance-before');
    const report = clone(fixture.report);
    report.findings[0].acceptanceChecks[0].evidenceBindingIds = ['EVIDENCE-ISSUE'];
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'acceptance-uses-before-evidence');
  });

  await suite.test('rejects Preview, fix, and final commit disagreement', async () => {
    const fixture = await createFixture(root, 'commit-mismatch');
    const report = clone(fixture.report);
    report.deployments[1].buildCommit = report.run.baselineCommit;
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'verification-deployment-commit');
  });

  await suite.test('requires a full baseline-to-final release assessment', async () => {
    const fixture = await createFixture(root, 'missing-release-assessment');
    const report = clone(fixture.report);
    delete report.releaseAssessment;
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report, { verifyAssets: false });
    expectCode(result, 'missing-release-assessment');
  });

  await suite.test('requires every verified finding to name the current final commit', async () => {
    const fixture = await createFixture(root, 'stale-finding-verification-commit');
    const report = clone(fixture.report);
    report.findings[0].verification.verifiedAtCommit = report.run.baselineCommit;
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report, { verifyAssets: false });
    expectCode(result, 'verification-commit-mismatch');
  });

  await suite.test('preserves the original finding fix while reverifying it on a later final release', async () => {
    const fixture = await createFixture(root, 'later-release');
    const report = await extendFixtureToLaterRelease(fixture);
    const result = await validateFixture(fixture, report);
    assert.deepEqual(result.errors, []);
    assert.notEqual(report.findings[0].remediation.fixAssessment.fixCommit, report.run.finalCommit);
    assert.equal(report.findings[0].verification.verifiedAtCommit, report.run.finalCommit);
    assert.equal(report.releaseAssessment.fixCommit, report.run.finalCommit);
  });

  await suite.test('blocks complete candidates with a current failed validation', async () => {
    const fixture = await createFixture(root, 'failed-current-validation');
    const report = clone(fixture.report);
    const validation = report.validations.find((item) => item.id === 'VAL-TEST');
    validation.result = 'failed';
    validation.exitCode = 1;
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report, { verifyAssets: false });
    expectCode(result, 'complete-candidate-has-failed-validation');
    expectCode(result, 'verified-finding-failed-validation');
  });

  await suite.test('allows report validation to run after the report is frozen', async () => {
    const fixture = await createFixture(root, 'report-validation-after-freeze');
    const report = clone(fixture.report);
    const validation = report.validations.find((item) => item.id === 'VAL-REPORT');
    validation.executedAt = '2026-01-01T00:00:13Z';
    validation.artifact = await writeArtifact(fixture.reportRoot, validation.artifact.path, {
      id: validation.id,
      scope: validation.scope,
      command: ['node', 'ui-inspection-report-self-test.mjs'],
      commandText: validation.command,
      executedAt: validation.executedAt,
      exitCode: validation.exitCode,
      stdout: validation.notes,
      stderr: '',
    });
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    assert.deepEqual(result.errors, []);
  });

  await suite.test('rejects product validation that runs after the report is frozen', async () => {
    const fixture = await createFixture(root, 'product-validation-after-freeze');
    const report = clone(fixture.report);
    const validation = report.validations.find((item) => item.id === 'VAL-TEST');
    validation.executedAt = '2026-01-01T00:00:13Z';
    validation.artifact = await writeArtifact(fixture.reportRoot, validation.artifact.path, {
      id: validation.id,
      scope: validation.scope,
      command: ['npm', 'test', '--', 'settings'],
      commandText: validation.command,
      executedAt: validation.executedAt,
      exitCode: validation.exitCode,
      stdout: validation.notes,
      stderr: '',
    });
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'validation-after-report-update');
  });

  await suite.test('rejects a low-risk claim for global CSS', async () => {
    const fixture = await createFixture(root, 'risk-floor');
    const report = clone(fixture.report);
    const assessment = report.findings[0].remediation.fixAssessment;
    assessment.changedFiles = [{ path: 'src/styles/tailwind.css', changeKind: 'global-css' }];
    assessment.riskFactors = ['global-style'];
    assessment.derivedRiskFloor = 'low';
    assessment.claimedRisk = 'low';
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'risk-floor-mismatch');
    expectCode(result, 'risk-understated');
  });

  await suite.test('rejects changed files omitted from the risk assessment', async () => {
    const fixture = await createFixture(root, 'omitted-diff-path');
    const report = clone(fixture.report);
    report.findings[0].remediation.fixAssessment.changedFiles = [
      { path: 'src/Unrelated.tsx', changeKind: 'leaf-ui-copy' },
    ];
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'diff-file-omitted');
  });

  await suite.test('rejects low risk while code review has unresolved P2', async () => {
    const fixture = await createFixture(root, 'risk-review');
    const report = clone(fixture.report);
    report.reviews.codeRisk[0].findings = [{ severity: 'P2', summary: 'Another locale changes unexpectedly.', resolved: false }];
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'low-risk-conflicts-with-review');
  });

  await suite.test('rejects stale human review after report content changes', async () => {
    const fixture = await createFixture(root, 'stale-review');
    const report = clone(fixture.report);
    report.findings[0].title = 'Changed after the independent reader finished';
    const result = await validateFixture(fixture, report);
    expectCode(result, 'stale-final-review');
  });

  await suite.test('rejects a final report reviewer reused from evidence review', async () => {
    const fixture = await createFixture(root, 'reused-final-reviewer');
    const report = clone(fixture.report);
    report.reviews.finalReport.reviewerId = 'independent-evidence-reader';
    const result = await validateFixture(fixture, report);
    expectCode(result, 'non-isolated-final-review');
  });

  await suite.test('rejects claim review performed by the capture admission reviewer', async () => {
    const fixture = await createFixture(root, 'capture-reviewer-reused');
    const report = clone(fixture.report);
    report.evidenceBindings[0].review.reviewerId = report.captures[0].admission.reviewedBy;
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report, { verifyAssets: false });
    expectCode(result, 'non-independent-evidence-review');
  });

  await suite.test('rejects uncertain final visual evidence', async () => {
    const fixture = await createFixture(root, 'uncertain-evidence');
    const report = clone(fixture.report);
    report.evidenceBindings.find((item) => item.id === 'EVIDENCE-AFTER').review.verdict = 'uncertain';
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'verified-without-supported-after');
  });

  await suite.test('rejects complete reports with incomplete coverage', async () => {
    const fixture = await createFixture(root, 'coverage-incomplete');
    const report = clone(fixture.report);
    report.coverage[0].status = 'partial';
    report.coverage[0].reason = 'A safe child modal was not inspected.';
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'complete-candidate-with-incomplete-coverage');
  });

  await suite.test('accepts an independently reviewed partial report without calling it complete', async () => {
    const fixture = await createFixture(root, 'reviewed-partial');
    const report = clone(fixture.report);
    report.run.status = 'partial';
    report.coverage[0].status = 'partial';
    report.coverage[0].reason = 'A separate authenticated child route was not reachable.';
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    assert.deepEqual(result.errors, []);
    assert.equal(result.derived.reportStatus, 'partial');
  });

  await suite.test('rejects remediation that exceeds inspect-only authorization', async () => {
    const fixture = await createFixture(root, 'inspect-only-remediation');
    const report = clone(fixture.report);
    report.run.authorization = 'inspect-only';
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'inspect-only-has-remediation');
  });

  await suite.test('rejects a capture whose URL does not preserve its deployment identity', async () => {
    const fixture = await createFixture(root, 'deployment-url-mismatch');
    const report = clone(fixture.report);
    report.captures.find((item) => item.id === 'CAPTURE-AFTER').url = 'https://example.test/settings?preview=baseline';
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'capture-deployment-url-mismatch');
  });

  await suite.test('accepts SPA captures whose stripped URL has exact request and loaded-resource deployment proof', async () => {
    const fixture = await createFixture(root, 'deployment-runtime-proof');
    const report = clone(fixture.report);
    const capture = report.captures.find((item) => item.id === 'CAPTURE-AFTER');
    capture.url = 'https://example.test/settings';
    await attachDeploymentIdentityProof(fixture, report, capture.id);
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    assert.deepEqual(result.errors, []);
  });

  await suite.test('rejects SPA deployment proof backed by a different Preview resource', async () => {
    const fixture = await createFixture(root, 'deployment-runtime-proof-wrong-resource');
    const report = clone(fixture.report);
    const capture = report.captures.find((item) => item.id === 'CAPTURE-AFTER');
    capture.url = 'https://example.test/settings';
    await attachDeploymentIdentityProof(fixture, report, capture.id, {
      observedResourceUrl: 'https://cdn.example.test/releases/app-baseline/index.js',
    });
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'capture-deployment-proof-resource-mismatch');
    expectCode(result, 'capture-deployment-url-mismatch');
  });

  await suite.test('accepts SPA captures backed by an exact runtime publication manifest', async () => {
    const fixture = await createFixture(root, 'deployment-runtime-manifest');
    const report = clone(fixture.report);
    const capture = report.captures.find((item) => item.id === 'CAPTURE-AFTER');
    capture.url = 'https://example.test/settings';
    await attachRuntimePublicationManifest(fixture, report, capture.id);
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    assert.deepEqual(result.errors, []);
  });

  await suite.test('rejects a runtime publication manifest for another Preview identity', async () => {
    const fixture = await createFixture(root, 'deployment-runtime-manifest-wrong-preview');
    const report = clone(fixture.report);
    const capture = report.captures.find((item) => item.id === 'CAPTURE-AFTER');
    capture.url = 'https://example.test/settings';
    await attachRuntimePublicationManifest(fixture, report, capture.id, { identityValue: 'another-preview' });
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'capture-deployment-proof-runtime-mismatch');
    expectCode(result, 'capture-deployment-url-mismatch');
  });

  await suite.test('rejects rehashed SPA deployment proof whose structured fields disagree', async () => {
    const fixture = await createFixture(root, 'deployment-runtime-proof-artifact-mismatch');
    const report = clone(fixture.report);
    const capture = report.captures.find((item) => item.id === 'CAPTURE-AFTER');
    capture.url = 'https://example.test/settings';
    const proof = await attachDeploymentIdentityProof(fixture, report, capture.id);
    proof.artifact = await writeArtifact(fixture.reportRoot, proof.artifact.path, {
      captureId: capture.id,
      deploymentId: capture.deploymentId,
      method: proof.method,
      requestedUrl: proof.requestedUrl,
      currentUrl: 'https://example.test/another-state',
      observedResourceUrl: proof.observedResourceUrl,
    });
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'artifact-content-mismatch');
  });

  await suite.test('accepts captures on descendant routes under the canonical product entry', async () => {
    const fixture = await createFixture(root, 'target-descendant-route');
    const report = clone(fixture.report);
    report.targets[0].url = 'https://example.test/app';
    report.coverage[0].url = 'https://example.test/app/settings';
    report.findings[0].url = 'https://example.test/app/settings';
    report.captures[0].url = 'https://example.test/app/settings?preview=baseline';
    report.captures[1].url = 'https://example.test/app/settings?preview=fix';
    const inventory = JSON.parse(await fs.readFile(path.join(fixture.reportRoot, report.coverageInventory.artifact.path), 'utf8'));
    inventory.roots[0].url = report.coverage[0].url;
    report.coverageInventory.artifact = await writeArtifact(
      fixture.reportRoot,
      report.coverageInventory.artifact.path,
      inventory,
    );
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    assert.deepEqual(result.errors, []);
  });

  await suite.test('rejects a sibling path that only shares the product entry prefix', async () => {
    const fixture = await createFixture(root, 'target-sibling-prefix');
    const report = clone(fixture.report);
    report.coverage[0].url = 'https://example.test/settings-copy';
    report.captures[0].url = 'https://example.test/settings-copy?preview=baseline';
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'capture-target-url-mismatch');
  });

  await suite.test('keeps evidence bindings exact to their declared product route', async () => {
    const fixture = await createFixture(root, 'binding-exact-route');
    const report = clone(fixture.report);
    report.captures[0].url = 'https://example.test/settings/profile?preview=baseline';
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'binding-product-url-mismatch');
  });

  await suite.test('accepts a baseline deployment that predates the inspection run', async () => {
    const fixture = await createFixture(root, 'baseline-predates-run');
    const report = clone(fixture.report);
    const deployment = report.deployments.find((item) => item.stage === 'baseline');
    deployment.publishedAt = '2025-12-31T23:59:59Z';
    deployment.evidence.artifact = await writeArtifact(fixture.reportRoot, deployment.evidence.artifact.path, {
      id: deployment.id,
      provider: deployment.provider,
      status: deployment.status,
      previewUrl: deployment.previewUrl,
      buildCommit: deployment.buildCommit,
      publishedAt: deployment.publishedAt,
      command: deployment.evidence.command,
      resultSummary: deployment.evidence.resultSummary,
      rawOutput: 'Previously published baseline remains available.',
    });
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    assert.deepEqual(result.errors, []);
  });

  await suite.test('allows deployment entry paths to differ from inspected product routes', async () => {
    const fixture = await createFixture(root, 'deployment-entry-route');
    const report = clone(fixture.report);
    for (const deployment of report.deployments) {
      const preview = new URL(deployment.previewUrl);
      preview.pathname = '/preview-entry';
      deployment.previewUrl = preview.href;
      deployment.evidence.artifact = await writeArtifact(fixture.reportRoot, deployment.evidence.artifact.path, {
        id: deployment.id,
        provider: deployment.provider,
        status: deployment.status,
        previewUrl: deployment.previewUrl,
        buildCommit: deployment.buildCommit,
        publishedAt: deployment.publishedAt,
        command: deployment.evidence.command,
        resultSummary: deployment.evidence.resultSummary,
        rawOutput: `Preview entry resolved for ${deployment.id}.`,
      });
    }
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    assert.deepEqual(result.errors, []);
  });

  await suite.test('accepts independent code review performed before the reviewed commit was pushed', async () => {
    const fixture = await createFixture(root, 'review-before-push');
    const report = clone(fixture.report);
    const review = report.reviews.codeRisk[0];
    review.reviewedAt = '2026-01-01T00:00:06.500Z';
    const { artifact, ...artifactPayload } = review;
    review.artifact = await writeArtifact(fixture.reportRoot, artifact.path, artifactPayload);
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    assert.deepEqual(result.errors, []);
  });

  await suite.test('rejects a duplicate-sampled coverage node that represents itself', async () => {
    const fixture = await createFixture(root, 'self-representative');
    const report = clone(fixture.report);
    report.coverage.push({
      id: 'COVERAGE-002',
      parentId: 'COVERAGE-001',
      targetId: 'TARGET-001',
      label: 'Settings duplicate state',
      kind: 'route',
      url: 'https://example.test/settings',
      stateKey: report.coverage[0].stateKey,
      action: 'Inspect the duplicate state.',
      rendererKey: 'route:settings/general',
      sourceRefs: ['src/routes.tsx:13'],
      status: 'duplicate-sampled',
      representativeId: 'COVERAGE-002',
      equivalenceRationale: 'Intentionally invalid self-reference for this mutation test.',
      evidenceBindingIds: [],
    });
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report, { verifyAssets: false });
    expectCode(result, 'self-representative-coverage');
  });

  await suite.test('rejects duplicate sampling for a route even when renderer metadata matches', async () => {
    const fixture = await createFixture(root, 'sampled-route');
    const report = clone(fixture.report);
    report.coverage.push({
      id: 'COVERAGE-002',
      targetId: 'TARGET-001',
      label: 'Another route instance',
      kind: 'route',
      url: 'https://example.test/settings',
      stateKey: report.coverage[0].stateKey,
      action: 'Open the second route instance.',
      rendererKey: report.coverage[0].rendererKey,
      sourceRefs: ['src/routes.tsx:1'],
      status: 'duplicate-sampled',
      representativeId: 'COVERAGE-001',
      equivalenceRationale: 'The renderer key happens to match.',
      evidenceBindingIds: [],
    });
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report, { verifyAssets: false });
    expectCode(result, 'unsampleable-coverage-kind');
  });

  await suite.test('rejects a supporting artifact changed after it was recorded', async () => {
    const fixture = await createFixture(root, 'artifact-mutation');
    await fs.appendFile(path.join(fixture.reportRoot, 'artifacts/validations/VAL-TEST.json'), '\nmutated\n');
    const result = await validateFixture(fixture);
    expectCode(result, 'artifact-hash-mismatch');
  });

  await suite.test('rejects a rehashed artifact whose structured fields disagree with the report', async () => {
    const fixture = await createFixture(root, 'artifact-field-mismatch');
    const report = clone(fixture.report);
    const validation = report.validations.find((item) => item.id === 'VAL-TEST');
    validation.artifact = await writeArtifact(fixture.reportRoot, validation.artifact.path, {
      id: validation.id,
      scope: validation.scope,
      command: 'npm test -- unrelated-suite',
      executedAt: validation.executedAt,
      exitCode: validation.exitCode,
      stdout: 'VAL-TEST still appears here, but the command is wrong.',
      stderr: '',
    });
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'artifact-content-mismatch');
  });

  await suite.test('rejects an out-of-range frontend source line', async () => {
    const fixture = await createFixture(root, 'source-line-out-of-range');
    const report = clone(fixture.report);
    report.findings[0].sourceAttribution.matches[0].line = 99;
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'source-line-out-of-range');
  });

  await suite.test('rejects a fake PNG header that cannot decode', async () => {
    const fixture = await createFixture(root, 'fake-png');
    const fake = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(fake);
    fake.writeUInt32BE(720, 16);
    fake.writeUInt32BE(420, 20);
    await fs.writeFile(fixture.beforePath, fake);
    const result = await validateFixture(fixture);
    expectCode(result, 'capture-file-error');
  });

  await suite.test('accepts 1x Browser Use pixels while preserving actual DPR 2', async () => {
    const fixture = await createFixture(root, 'browser-use-capture-scale');
    const report = clone(fixture.report);
    report.targets[0].viewport.deviceScaleFactor = 2;
    for (const capture of report.captures) {
      capture.viewport.deviceScaleFactor = 2;
      capture.captureScaleFactor = 1;
    }
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    assert.deepEqual(result.errors, []);
  });

  await suite.test('rejects full-viewport pixels that disagree with CSS viewport and capture scale', async () => {
    const fixture = await createFixture(root, 'viewport-pixel-mismatch');
    const report = clone(fixture.report);
    report.targets[0].viewport.width = 700;
    for (const capture of report.captures) capture.viewport.width = 700;
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'full-viewport-dimension-mismatch');
  });

  await suite.test('rejects a falsified full-viewport capture scale', async () => {
    const fixture = await createFixture(root, 'falsified-capture-scale');
    const report = clone(fixture.report);
    report.captures[0].captureScaleFactor = 2;
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'full-viewport-dimension-mismatch');
  });

  await suite.test('rejects modifications to the copied report shell', async () => {
    const fixture = await createFixture(root, 'shell-mutation');
    const html = await fs.readFile(fixture.reportHtmlPath, 'utf8');
    await fs.writeFile(fixture.reportHtmlPath, html.replace('<body>', '<body data-mutated="true">'));
    const result = await validateFixture(fixture);
    expectCode(result, 'report-shell-mismatch');
  });

  await suite.test('rejects code-risk review that reuses the evidence review session', async () => {
    const fixture = await createFixture(root, 'reused-code-session');
    const report = clone(fixture.report);
    report.reviews.codeRisk[0].reviewSessionId = 'EVIDENCE-SESSION-001';
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report, { verifyAssets: false });
    expectCode(result, 'non-isolated-code-risk-review');
  });

  await suite.test('rejects final review that reuses an earlier review session', async () => {
    const fixture = await createFixture(root, 'reused-final-session');
    const report = clone(fixture.report);
    report.reviews.finalReport.reviewSessionId = 'CODE-SESSION-001';
    const result = await validateFixture(fixture, report, { verifyAssets: false });
    expectCode(result, 'non-isolated-final-review-session');
  });

  await suite.test('rejects approval when coverage or report artifacts are not assessable', async () => {
    const fixture = await createFixture(root, 'unusable-approved-report');
    const report = clone(fixture.report);
    report.reviews.finalReport.coverageAssessable = false;
    const result = await validateFixture(fixture, report);
    expectCode(result, 'approved-report-not-usable');
  });

  await suite.test('rejects final approval without a passing report validation artifact', async () => {
    const fixture = await createFixture(root, 'missing-report-validation');
    const report = clone(fixture.report);
    report.validations = report.validations.filter((item) => item.id !== 'VAL-REPORT');
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'approved-report-without-validation');
  });

  await suite.test('rejects cross-locale acceptance backed only by the primary locale', async () => {
    const fixture = await createFixture(root, 'cross-locale-primary-only');
    const report = clone(fixture.report);
    report.findings[0].acceptanceChecks.push({
      id: 'ACCEPT-CROSS-LOCALE',
      statement: 'A second locale remains intact.',
      kind: 'cross-locale',
      status: 'passed',
      evidenceBindingIds: ['EVIDENCE-REGRESSION'],
      validationIds: [],
      notes: 'This intentionally reuses primary-locale evidence.',
    });
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'cross-locale-without-alternate-target');
  });

  await suite.test('rejects traversal outside the screenshot directory', async () => {
    const fixture = await createFixture(root, 'path-traversal');
    const report = clone(fixture.report);
    report.captures[0].path = '../outside.png';
    await refreshFinalReview(report, fixture.reportRoot);
    const result = await validateFixture(fixture, report);
    expectCode(result, 'unsafe-capture-path');
  });

  await suite.test('initializer exposes help without requiring valued arguments', async () => {
    const { stdout } = await execFile(process.execPath, [INITIALIZER_PATH, '--help']);
    assert.match(stdout, /Usage:/);
    assert.match(stdout, /--registry-root PATH/);
    assert.match(stdout, /--authorization inspect-only\|fix-local\|release-verify/);
  });

  await suite.test('screenshot inspector exposes help without requiring a value', async () => {
    const { stdout } = await execFile(process.execPath, [SCREENSHOT_INSPECTOR_PATH, '--help']);
    assert.match(stdout, /Usage:/);
    assert.match(stdout, /--file PATH/);
  });

  await suite.test('fix evidence collector exposes help without requiring a value', async () => {
    const { stdout } = await execFile(process.execPath, [COLLECT_FIX_PATH, '--help']);
    assert.match(stdout, /Usage:/);
    assert.match(stdout, /--diff-artifact PATH/);
  });

  await suite.test('validation runner exposes help without requiring a command', async () => {
    const { stdout } = await execFile(process.execPath, [VALIDATION_RUNNER_PATH, '--help']);
    assert.match(stdout, /Usage:/);
    assert.match(stdout, /-- COMMAND/);
  });

  await suite.test('report renderer exposes help without requiring valued arguments', async () => {
    const { stdout } = await execFile(process.execPath, [RENDERER_PATH, '--help']);
    assert.match(stdout, /Usage:/);
    assert.match(stdout, /--report-json/);
    assert.match(stdout, /--output/);
  });

  await suite.test('initializer requires an explicit task identity and reuses its existing repository run', async () => {
    const parent = path.join(root, 'initializer-runs');
    const firstRun = path.join(parent, 'run-one');
    const args = [
      INITIALIZER_PATH,
      '--registry-root', parent,
      '--run-dir', firstRun,
      '--run-id', 'RUN-INIT-001',
      '--task-id', 'TASK-INIT-001',
      '--authorization', 'inspect-only',
      '--repository', gitFixture.repository,
      '--target-url', 'https://example.test/settings',
      '--target-locale', 'en_US',
      '--viewport-width', '1512',
      '--viewport-height', '862',
      '--device-scale-factor', '2',
      '--browser-zoom', '1',
      '--screen-class', '14-inch laptop actual Chrome viewport',
      '--primary-inspector-id', 'initializer-primary',
    ];
    const first = JSON.parse((await execFile(process.execPath, args)).stdout);
    assert.equal(first.reused, false);
    const report = JSON.parse(await fs.readFile(path.join(firstRun, 'report.json'), 'utf8'));
    assert.equal(report.run.taskId, 'TASK-INIT-001');
    assert.equal(report.run.authorization, 'inspect-only');
    assert.equal(report.targets[0].viewport.width, 1512);
    assert.equal(report.targets[0].viewport.deviceScaleFactor, 2);
    const secondArgs = [...args];
    secondArgs[secondArgs.indexOf('--run-dir') + 1] = path.join(parent, 'run-two');
    secondArgs[secondArgs.indexOf('--target-locale') + 1] = 'en_US,zh_CN';
    const second = JSON.parse((await execFile(process.execPath, secondArgs)).stdout);
    assert.equal(second.reused, true);
    assert.equal(second.runDirectory, firstRun);
    assert.equal(await fs.stat(path.join(parent, 'run-two')).catch(() => null), null);
  });

  await suite.test('fix evidence collector saves the exact readable Git diff artifact', async () => {
    const reportRoot = path.join(root, 'fix-evidence-collector');
    await fs.mkdir(reportRoot, { recursive: true });
    const { stdout } = await execFile(process.execPath, [
      COLLECT_FIX_PATH,
      '--repository', gitFixture.repository,
      '--base', gitFixture.baseCommit,
      '--fix', gitFixture.fixCommit,
      '--report-root', reportRoot,
      '--diff-artifact', 'artifacts/diffs/finding.diff',
      '--scope', 'release',
      '--finding-ids', 'I18N-001',
    ]);
    const record = JSON.parse(stdout).assessment;
    const bytes = await fs.readFile(path.join(reportRoot, record.diffArtifact.path));
    assert.equal(record.diffArtifact.sha256, hashBytes(bytes));
    assert.equal(record.diffSha256, hashBytes(bytes));
    assert.deepEqual(record.findingIds, ['I18N-001']);
    assert.match(bytes.toString('utf8'), /SettingsButton\.tsx/);
  });

  await suite.test('Git diff evidence is stable across object-ID abbreviation settings', async () => {
    try {
      await execFile('git', ['config', '--local', 'core.abbrev', '7'], { cwd: gitFixture.repository });
      const shortIds = await collectGitDiffEvidence(gitFixture.repository, gitFixture.baseCommit, gitFixture.fixCommit);
      await execFile('git', ['config', '--local', 'core.abbrev', '12'], { cwd: gitFixture.repository });
      const longIds = await collectGitDiffEvidence(gitFixture.repository, gitFixture.baseCommit, gitFixture.fixCommit);
      assert.equal(shortIds.diffSha256, longIds.diffSha256);
      const { stdout } = await execFile(
        'git',
        ['diff', '--binary', '--full-index', `${gitFixture.baseCommit}..${gitFixture.fixCommit}`],
        { cwd: gitFixture.repository, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
      );
      assert.match(stdout, /^index [a-f0-9]{40}\.\.[a-f0-9]{40}/m);
    } finally {
      await execFile('git', ['config', '--local', '--unset', 'core.abbrev'], { cwd: gitFixture.repository }).catch(() => {});
    }
  });

  await suite.test('validation runner preserves raw command output with a hash', async () => {
    const reportRoot = path.join(root, 'validation-runner');
    await fs.mkdir(reportRoot, { recursive: true });
    const { stdout } = await execFile(process.execPath, [
      VALIDATION_RUNNER_PATH,
      '--id', 'VAL-RUNNER',
      '--scope', 'test',
      '--report-root', reportRoot,
      '--artifact', 'artifacts/validations/VAL-RUNNER.json',
      '--cwd', root,
      '--', process.execPath, '-e', "process.stdout.write('focused check passed')",
    ]);
    const record = JSON.parse(stdout).validation;
    const artifactPath = path.join(reportRoot, record.artifact.path);
    const bytes = await fs.readFile(artifactPath);
    const payload = JSON.parse(bytes);
    assert.equal(record.result, 'passed');
    assert.equal(record.exitCode, 0);
    assert.equal(record.artifact.sha256, hashBytes(bytes));
    assert.equal(payload.commandText, record.command);
    assert.ok(Array.isArray(payload.command));
    assert.match(bytes.toString('utf8'), /focused check passed/);
  });
});
