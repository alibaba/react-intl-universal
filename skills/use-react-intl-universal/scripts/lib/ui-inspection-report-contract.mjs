/*
 * Purpose:
 * Validate UI inspection reports and derive their evidence, deployment,
 * status, risk, screenshot, and review invariants from structured data.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

import { validateJsonSchema } from './json-schema-lite.mjs';

const execFile = promisify(execFileCallback);
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SCHEMA_PATH = path.resolve(MODULE_DIR, '../../references/ui-inspection-report.schema.json');
const CONTENT_START = '<!-- UI_INSPECTION_REPORT_CONTENT_START -->';
const CONTENT_END = '<!-- UI_INSPECTION_REPORT_CONTENT_END -->';
const RISK_RANK = { low: 0, medium: 1, high: 2 };
const HIGH_RISK_FACTORS = new Set([
  'shared-component',
  'global-style',
  'dependency-change',
  'lockfile-change',
  'build-config-change',
  'business-logic',
  'request-contract',
  'cross-module',
  'unknown-blast-radius',
]);
const MEDIUM_RISK_FACTORS = new Set([
  'local-layout',
  'table-column-geometry',
  'multi-consumer-message',
  'shared-display-copy',
  'cross-locale-rendering',
]);
const HIGH_RISK_CHANGE_KINDS = new Set([
  'shared-component',
  'global-css',
  'dependency',
  'build-config',
  'business-logic',
  'request-contract',
]);
const MEDIUM_RISK_CHANGE_KINDS = new Set(['local-layout', 'shared-display-map', 'other']);
const ATTENTION_DISPOSITIONS = new Set(['deferred', 'needs-human-confirmation', 'not-fixable-here', 'wont-fix']);
const COVERAGE_REASON_STATUSES = new Set(['partial', 'blocked', 'skipped-risky', 'external-out-of-scope', 'not-reached']);
const COVERAGE_INCOMPLETE_STATUSES = new Set(['pending', 'in-progress', 'partial', 'blocked', 'not-reached']);
const COVERAGE_ACTIVE_STATUSES = new Set(['pending', 'in-progress']);
const COVERAGE_ATTENTION_STATUSES = new Set(['skipped-risky']);
const DUPLICATE_SAMPLE_KINDS = new Set(['control', 'popover', 'state', 'scroll', 'other']);
const FINDING_ISSUE_ROLES = new Set(['issue-context', 'issue-detail']);
const FINDING_VERIFICATION_ROLES = new Set([
  'failed-verification',
  'verification-context',
  'verification-detail',
  'regression-check',
]);
const REVIEW_READY_STATUS = 'complete-candidate';
const REVIEWABLE_RUN_STATUSES = new Set(['complete-candidate', 'partial', 'blocked']);
const LAYOUT_FINDING_CATEGORIES = new Set([
  'truncation',
  'overflow',
  'overlap',
  'misalignment',
  'component-integrity',
  'word-break',
  'form-label-integrity',
  'interaction',
]);
const ROLE_INTENDED_USE = {
  coverage: new Set(['coverage', 'finding', 'verification', 'verification-failed', 'blocker', 'non-i18n']),
  'issue-context': new Set(['finding']),
  'issue-detail': new Set(['finding']),
  'failed-verification': new Set(['verification-failed']),
  'verification-context': new Set(['verification']),
  'verification-detail': new Set(['verification']),
  'regression-check': new Set(['verification']),
  blocker: new Set(['blocker']),
  'non-i18n': new Set(['non-i18n', 'coverage', 'finding', 'verification']),
};
const ACCEPTANCE_VALIDATION_SCOPES = {
  code: new Set(['source', 'locale', 'test', 'build', 'git']),
  runtime: new Set(['runtime']),
  release: new Set(['release']),
};

let cachedSchema;

/** Recursively sorts object keys to produce a canonical value. */
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

/** Computes a SHA-256 digest for the supplied content. */
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Computes the template-shell digest after removing generated report content. */
export function computeReportShellSha256(html) {
  const startIndex = html.indexOf(CONTENT_START);
  const endIndex = html.indexOf(CONTENT_END);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error('Report HTML is missing the required content markers.');
  }
  if (html.indexOf(CONTENT_START, startIndex + CONTENT_START.length) >= 0
    || html.indexOf(CONTENT_END, endIndex + CONTENT_END.length) >= 0) {
    throw new Error('Report HTML must contain exactly one content marker pair.');
  }
  const shell = `${html.slice(0, startIndex)}${CONTENT_START}${CONTENT_END}${html.slice(endIndex + CONTENT_END.length)}`;
  return sha256(shell);
}

/** Creates a deep JSON-compatible clone of a value. */
function clone(value) {
  return structuredClone(value);
}

/** Normalizes a report-relative path without resolving it on disk. */
function normalizeRelativePath(value) {
  return path.posix.normalize(String(value).replaceAll('\\', '/'));
}

/** Checks whether a path is inside a parent directory. */
function pathInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/** Checks whether two viewport definitions are equivalent. */
function sameViewport(left, right) {
  return Boolean(left && right)
    && left.width === right.width
    && left.height === right.height
    && left.deviceScaleFactor === right.deviceScaleFactor
    && left.browserZoom === right.browserZoom;
}

/** Checks whether two captured state snapshots are equivalent. */
function sameStateSnapshot(left, right) {
  if (!left || !right) return false;
  return left.key === right.key
    && left.route === right.route
    && JSON.stringify(left.activeSurfaces) === JSON.stringify(right.activeSurfaces)
    && JSON.stringify(left.filters) === JSON.stringify(right.filters)
    && left.dataState === right.dataState
    && left.scroll.x === right.scroll.x
    && left.scroll.y === right.scroll.y
    && (left.scroll.container || '') === (right.scroll.container || '');
}

/** Normalizes a URL before product-state comparison. */
function comparableUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/$/, '') || '/';
  return url;
}

/** Extracts normalized deployment identity entries from a URL. */
function deploymentIdentityEntries(url) {
  return [...url.searchParams.entries()]
    .filter(([key]) => key !== '_codexVerify' && /(preview|deployment|build|release|cdnversion)/i.test(key))
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => (
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
    ));
}

/** Checks whether a URL path belongs to the inspected application. */
function pathIsWithinApp(appPathname, candidatePathname) {
  if (appPathname === '/') return candidatePathname.startsWith('/');
  return candidatePathname === appPathname || candidatePathname.startsWith(`${appPathname}/`);
}

/** Checks whether two URLs identify the same product application. */
function productAppUrlMatches(targetUrl, captureUrl, navigationUrl = captureUrl) {
  try {
    const target = comparableUrl(targetUrl);
    const capture = comparableUrl(captureUrl);
    const navigation = comparableUrl(navigationUrl);
    if (target.origin !== capture.origin || !pathIsWithinApp(target.pathname, capture.pathname)) return false;
    if (capture.origin !== navigation.origin
      || capture.pathname !== navigation.pathname
      || capture.hash !== navigation.hash) return false;
    for (const [key, value] of target.searchParams) {
      if (key === '_codexVerify' || /(preview|deployment|build|release|cdnversion)/i.test(key)) continue;
      if (navigation.searchParams.get(key) !== value) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Checks whether two URLs identify the same product state. */
function productStateUrlMatches(expectedUrl, captureUrl, navigationUrl = captureUrl) {
  try {
    const expected = comparableUrl(expectedUrl);
    const capture = comparableUrl(captureUrl);
    const navigation = comparableUrl(navigationUrl);
    if (expected.origin !== capture.origin
      || expected.pathname !== capture.pathname
      || expected.hash !== capture.hash) return false;
    if (capture.origin !== navigation.origin
      || capture.pathname !== navigation.pathname
      || capture.hash !== navigation.hash) return false;
    for (const [key, value] of expected.searchParams) {
      if (key === '_codexVerify' || /(preview|deployment|build|release|cdnversion)/i.test(key)) continue;
      if (navigation.searchParams.get(key) !== value) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Checks whether a resource URL preserves deployment identity. */
function resourceUrlCarriesDeploymentIdentity(deploymentUrl, resourceUrl) {
  try {
    const deployment = comparableUrl(deploymentUrl);
    const resource = new URL(resourceUrl);
    const identityValues = deploymentIdentityEntries(deployment).map(([, value]) => value);
    if (!identityValues.length) return false;
    const pathSegments = resource.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
    const queryValues = [...resource.searchParams.values()];
    return identityValues.every((value) => (
      queryValues.includes(value)
      || pathSegments.some((segment) => segment === value || segment.endsWith(`-${value}`))
    ));
  } catch {
    return false;
  }
}

/** Checks whether runtime resources match the publication manifest. */
function runtimePublicationManifestMatches(deployment, proof) {
  try {
    const preview = comparableUrl(deployment.previewUrl);
    const expectedEntries = deploymentIdentityEntries(preview);
    const actualEntries = proof.runtimeIdentity?.identityEntries ?? [];
    const identityMatches = expectedEntries.every(([key, value]) => (
      actualEntries.some((entry) => entry.key === key && entry.value === value)
    ));
    const releaseVersion = proof.runtimeIdentity?.releaseVersion;
    const versionMatches = !deployment.cdnVersion
      || releaseVersion === deployment.cdnVersion
      || releaseVersion?.endsWith(`/${deployment.cdnVersion}`);
    const resourcesValid = proof.runtimeIdentity?.resourceUrls?.length > 0
      && proof.runtimeIdentity.resourceUrls.every((url) => {
        const parsed = new URL(url, preview.origin);
        return ['http:', 'https:'].includes(parsed.protocol);
      });
    return expectedEntries.length > 0 && identityMatches && versionMatches && resourcesValid;
  } catch {
    return false;
  }
}

/** Returns the effective navigation URL recorded for a capture. */
function captureNavigationUrl(capture) {
  return capture.deploymentIdentityProof?.requestedUrl || capture.url;
}

/** Checks whether a URL matches the expected deployment. */
function deploymentUrlMatches(previewUrl, captureUrl) {
  try {
    const preview = comparableUrl(previewUrl);
    const capture = comparableUrl(captureUrl);
    if (preview.origin !== capture.origin) return false;
    const identity = deploymentIdentityEntries(preview);
    if (!identity.length) return false;
    return identity.every(([key, value]) => capture.searchParams.getAll(key).includes(value));
  } catch {
    return false;
  }
}

/** Checks whether every boolean validation flag passes. */
function allBooleanChecksPass(checks) {
  return Boolean(checks) && Object.values(checks).every((value) => value === true);
}

/** Indexes records by ID. */
function idMap(items = []) {
  return new Map(items.map((item) => [item.id, item]));
}

/** Appends a structured validation error to the report result. */
function addError(errors, code, recordPath, message) {
  errors.push({ code, path: recordPath, message });
}

/** Adds validation errors for duplicate record IDs. */
function requireUniqueIds(collections, errors) {
  const global = new Map();
  for (const [name, items] of collections) {
    const local = new Set();
    for (const item of items || []) {
      if (local.has(item.id)) addError(errors, 'duplicate-id', `$.${name}`, `Duplicate ${name} id ${item.id}.`);
      local.add(item.id);
      if (global.has(item.id)) {
        addError(errors, 'duplicate-global-id', `$.${name}`, `ID ${item.id} is already used by ${global.get(item.id)}.`);
      } else {
        global.set(item.id, name);
      }
    }
  }
}

/** Parses a timestamp into milliseconds for ordering checks. */
function parsedTime(value, recordPath, errors) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    addError(errors, 'invalid-time', recordPath, `Invalid timestamp ${JSON.stringify(value)}.`);
    return null;
  }
  return timestamp;
}

/** Returns the lifecycle ordering rank for an evidence role. */
function lifecycleOrder(finding, errors, findingPath) {
  let previous = -Infinity;
  for (const [index, event] of finding.lifecycleEvents.entries()) {
    const current = parsedTime(event.at, `${findingPath}.lifecycleEvents[${index}].at`, errors);
    if (current !== null && current < previous) {
      addError(errors, 'lifecycle-order', `${findingPath}.lifecycleEvents[${index}]`, 'Lifecycle events must be chronological.');
    }
    if (current !== null) previous = current;
  }
}

/** Infers a minimum fix risk from the changed file path. */
function inferredRiskFromPath(filePath) {
  const normalized = filePath.toLowerCase();
  const name = path.posix.basename(normalized);
  if (
    /(^|\/)(package\.json|yarn\.lock|package-lock\.json|pnpm-lock\.yaml)$/.test(normalized)
    || /(^|\/)(vite|webpack|rollup|rspack|babel|tsconfig)[^/]*\.(js|cjs|mjs|ts|json)$/.test(normalized)
  ) return 'high';
  if (/global|tailwind|reset|theme/.test(name) && /\.(css|less|scss|sass)$/.test(name)) return 'high';
  if (/(^|\/)(shared|common|core|components\/base)(\/|$)/.test(normalized)) return 'medium';
  return 'low';
}

/** Derives the minimum allowed fix risk from changed files and behavior flags. */
export function deriveRiskFloor(fixAssessment) {
  if (!fixAssessment) return null;
  let rank = 0;
  for (const factor of fixAssessment.riskFactors || []) {
    if (HIGH_RISK_FACTORS.has(factor)) rank = Math.max(rank, RISK_RANK.high);
    if (MEDIUM_RISK_FACTORS.has(factor)) rank = Math.max(rank, RISK_RANK.medium);
  }
  for (const changedFile of fixAssessment.changedFiles || []) {
    if (HIGH_RISK_CHANGE_KINDS.has(changedFile.changeKind)) rank = Math.max(rank, RISK_RANK.high);
    if (MEDIUM_RISK_CHANGE_KINDS.has(changedFile.changeKind)) rank = Math.max(rank, RISK_RANK.medium);
    rank = Math.max(rank, RISK_RANK[inferredRiskFromPath(changedFile.path)]);
  }
  return ['low', 'medium', 'high'][rank];
}

/** Derives finding status from fix, verification, and human-attention evidence. */
export function deriveFindingStatus(finding) {
  if (finding.remediation.disposition === 'needs-human-confirmation') return 'needsHumanConfirmation';
  if (finding.remediation.disposition === 'not-fixable-here') return 'notFixableInCurrentRepo';
  if (finding.remediation.disposition === 'deferred') return 'deferred';
  if (finding.remediation.disposition === 'wont-fix') return 'wontFix';
  if (finding.verification.result === 'passed') return 'verifiedFixed';
  if (finding.verification.result === 'failed') return 'verificationFailed';
  if (finding.verification.deploymentId) return 'publishedForVerification';
  if (finding.remediation.commit) return 'committed';
  if (finding.remediation.disposition === 'fixed-locally') return 'fixedLocally';
  return 'open';
}

/** Computes a digest of report content that a final reviewer must approve. */
export function computeReviewableContentSha256(report) {
  const reviewable = clone(report);
  if (!reviewable.reviews) reviewable.reviews = { codeRisk: [] };
  delete reviewable.reviews.finalReport;
  return sha256(JSON.stringify(canonicalize(reviewable)));
}

/** Derives report counters from the current finding and observation records. */
export function deriveReportSummary(report) {
  const findings = report.findings || [];
  const findingRows = findings.map((finding) => {
    const status = deriveFindingStatus(finding);
    const risk = finding.remediation.fixAssessment
      ? ['low', 'medium', 'high'][Math.max(
        RISK_RANK[finding.remediation.fixAssessment.derivedRiskFloor],
        RISK_RANK[finding.remediation.fixAssessment.claimedRisk],
      )]
      : null;
    const needsAttention = status !== 'verifiedFixed' || ATTENTION_DISPOSITIONS.has(finding.remediation.disposition);
    return { id: finding.id, status, risk, needsAttention };
  });
  const coverageByStatus = {};
  for (const item of report.coverage || []) coverageByStatus[item.status] = (coverageByStatus[item.status] || 0) + 1;
  const coverageAttentionIds = (report.coverage || [])
    .filter((item) => COVERAGE_ATTENTION_STATUSES.has(item.status))
    .map((item) => item.id);
  const observationAttentionIds = (report.observations || []).map((item) => item.id);
  const findingAttentionIds = findingRows.filter((item) => item.needsAttention).map((item) => item.id);
  const validationAttentionIds = (report.validations || [])
    .filter((item) => item.result === 'failed-pre-existing')
    .map((item) => item.id);
  const releaseRisk = report.releaseAssessment
    ? ['low', 'medium', 'high'][Math.max(
      RISK_RANK[report.releaseAssessment.derivedRiskFloor],
      RISK_RANK[report.releaseAssessment.claimedRisk],
    )]
    : null;
  const releaseNeedsAttention = Boolean(releaseRisk && releaseRisk !== 'low');
  return {
    issues: {
      found: findingRows.length,
      fixed: findingRows.filter((item) => item.status === 'verifiedFixed').length,
      needAttention: findingRows.filter((item) => item.needsAttention).length,
    },
    coverage: {
      total: (report.coverage || []).length,
      byStatus: coverageByStatus,
      needAttention: coverageAttentionIds.length,
    },
    attention: {
      total: findingAttentionIds.length + coverageAttentionIds.length + observationAttentionIds.length
        + validationAttentionIds.length + Number(releaseNeedsAttention),
      findingIds: findingAttentionIds,
      coverageIds: coverageAttentionIds,
      observationIds: observationAttentionIds,
      validationIds: validationAttentionIds,
      release: releaseNeedsAttention,
    },
    release: { risk: releaseRisk, needsAttention: releaseNeedsAttention },
    findings: findingRows,
  };
}

/** Derives the overall report status from findings, blockers, and validations. */
export function deriveReportStatus(report) {
  const finalReview = report.reviews?.finalReport;
  if (finalReview?.verdict === 'approved') {
    if (['partial', 'blocked'].includes(report.run.status)) return report.run.status;
    return deriveReportSummary(report).attention.total ? 'completed-with-attention' : 'completed';
  }
  return report.run.status;
}

/** Loads and parses the current UI inspection report JSON schema. */
export async function loadUiInspectionReportSchema(schemaPath = DEFAULT_SCHEMA_PATH) {
  if (schemaPath === DEFAULT_SCHEMA_PATH && cachedSchema) return cachedSchema;
  const schema = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
  if (schemaPath === DEFAULT_SCHEMA_PATH) cachedSchema = schema;
  return schema;
}

let pngCrcTable;

/** Computes a CRC-32 checksum for PNG data. */
function crc32(buffer) {
  if (!pngCrcTable) {
    pngCrcTable = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      }
      return value >>> 0;
    });
  }
  let value = 0xffffffff;
  for (const byte of buffer) value = pngCrcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

/** Validates PNG structure and returns dimensions plus visual-content metrics. */
function inspectPngBuffer(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buffer.subarray(0, 8).equals(signature)) return null;
  if (buffer.length < 33) throw new Error('PNG is too short to contain a complete image.');
  let offset = 8;
  let header;
  const compressed = [];
  let sawEnd = false;
  let chunkIndex = 0;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    if (crcOffset + 4 > buffer.length) throw new Error('PNG chunk extends beyond the saved file.');
    const type = buffer.toString('ascii', typeStart, dataStart);
    if (crc32(buffer.subarray(typeStart, dataEnd)) !== buffer.readUInt32BE(crcOffset)) {
      throw new Error(`PNG ${type} chunk has an invalid CRC.`);
    }
    if (chunkIndex === 0 && type !== 'IHDR') throw new Error('PNG must start with an IHDR chunk.');
    if (type === 'IHDR') {
      if (header || length !== 13) throw new Error('PNG must contain one 13-byte IHDR chunk.');
      header = {
        pixelWidth: buffer.readUInt32BE(dataStart),
        pixelHeight: buffer.readUInt32BE(dataStart + 4),
        bitDepth: buffer[dataStart + 8],
        colorType: buffer[dataStart + 9],
        compression: buffer[dataStart + 10],
        filter: buffer[dataStart + 11],
        interlace: buffer[dataStart + 12],
      };
    } else if (type === 'IDAT') {
      compressed.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      if (length !== 0) throw new Error('PNG IEND chunk must be empty.');
      sawEnd = true;
      offset = crcOffset + 4;
      break;
    }
    offset = crcOffset + 4;
    chunkIndex += 1;
  }
  if (!header || !header.pixelWidth || !header.pixelHeight || !compressed.length || !sawEnd) {
    throw new Error('PNG is missing required image chunks.');
  }
  if (offset !== buffer.length) throw new Error('PNG contains trailing bytes after IEND.');
  if (header.compression !== 0 || header.filter !== 0 || header.interlace !== 0) {
    throw new Error('PNG uses unsupported compression, filter, or interlace settings.');
  }
  const channelsByColorType = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]);
  const validDepths = {
    0: new Set([1, 2, 4, 8, 16]),
    2: new Set([8, 16]),
    3: new Set([1, 2, 4, 8]),
    4: new Set([8, 16]),
    6: new Set([8, 16]),
  };
  const channels = channelsByColorType.get(header.colorType);
  if (!channels || !validDepths[header.colorType]?.has(header.bitDepth)) {
    throw new Error('PNG color type and bit depth are invalid.');
  }
  const rowBytes = Math.ceil((header.pixelWidth * channels * header.bitDepth) / 8);
  const inflated = inflateSync(Buffer.concat(compressed));
  const expectedInflatedLength = (rowBytes + 1) * header.pixelHeight;
  if (inflated.byteLength !== expectedInflatedLength) {
    throw new Error(`PNG decoded byte length is ${inflated.byteLength}, expected ${expectedInflatedLength}.`);
  }
  return { mimeType: 'image/png', pixelWidth: header.pixelWidth, pixelHeight: header.pixelHeight };
}

/** Detects a supported image format and returns integrity and geometry facts. */
export function inspectImageBuffer(buffer) {
  const png = inspectPngBuffer(buffer);
  if (png) return png;

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    if (buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) {
      throw new Error('JPEG is missing the end-of-image marker.');
    }
    const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      while (buffer[offset] === 0xff) offset += 1;
      const marker = buffer[offset];
      offset += 1;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > buffer.length) break;
      const length = buffer.readUInt16BE(offset);
      if (length < 2 || offset + length > buffer.length) break;
      if (startOfFrameMarkers.has(marker)) {
        return {
          mimeType: 'image/jpeg',
          pixelHeight: buffer.readUInt16BE(offset + 3),
          pixelWidth: buffer.readUInt16BE(offset + 5),
        };
      }
      offset += length;
    }
  }

  throw new Error('Unsupported or undecodable image bytes. Only PNG and JPEG are allowed.');
}

/** Reads an image file and returns its digest, size, geometry, and content facts. */
export async function inspectImageFile(filePath) {
  const buffer = await fs.readFile(filePath);
  return {
    ...inspectImageBuffer(buffer),
    byteLength: buffer.byteLength,
    sha256: sha256(buffer),
  };
}

/** Collects immutable name-status, numstat, and patch evidence for a commit range. */
export async function collectGitDiffEvidence(repositoryPath, baseCommit, fixCommit) {
  const range = `${baseCommit}..${fixCommit}`;
  const [{ stdout: diff }, { stdout: changedFiles }, { stdout: resolvedBase }, { stdout: resolvedFix }] = await Promise.all([
    execFile('git', ['diff', '--binary', '--full-index', range], { cwd: repositoryPath, encoding: 'buffer', maxBuffer: 100 * 1024 * 1024 }),
    execFile('git', ['diff', '--name-only', range], { cwd: repositoryPath, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }),
    execFile('git', ['rev-parse', baseCommit], { cwd: repositoryPath, encoding: 'utf8' }),
    execFile('git', ['rev-parse', fixCommit], { cwd: repositoryPath, encoding: 'utf8' }),
  ]);
  return {
    baseCommit: resolvedBase.trim(),
    fixCommit: resolvedFix.trim(),
    diffSha256: sha256(diff),
    changedFiles: changedFiles.split(/\r?\n/).filter(Boolean),
  };
}

/** Verifies that a finding or observation owns valid evidence bindings. */
function verifyOwnerBindings(owner, ownerType, bindingMap, errors, ownerPath) {
  const expected = new Set(owner.evidenceBindingIds || []);
  for (const bindingId of expected) {
    const binding = bindingMap.get(bindingId);
    if (!binding) {
      addError(errors, 'unknown-binding', `${ownerPath}.evidenceBindingIds`, `${owner.id} references unknown evidence binding ${bindingId}.`);
      continue;
    }
    if (binding.ownerType !== ownerType || binding.ownerId !== owner.id) {
      addError(errors, 'binding-owner-mismatch', `${ownerPath}.evidenceBindingIds`, `${bindingId} belongs to ${binding.ownerType} ${binding.ownerId}, not ${ownerType} ${owner.id}.`);
    }
  }
}

/** Verifies acceptance criteria point to suitable evidence and validation records. */
function verifyAcceptanceChecks(finding, bindingMap, captureMap, validationMap, errors, findingPath) {
  const checkIds = new Set();
  for (const [index, check] of finding.acceptanceChecks.entries()) {
    const checkPath = `${findingPath}.acceptanceChecks[${index}]`;
    if (checkIds.has(check.id)) addError(errors, 'duplicate-acceptance-id', checkPath, `Duplicate acceptance check ${check.id}.`);
    checkIds.add(check.id);
    for (const bindingId of check.evidenceBindingIds) {
      const binding = bindingMap.get(bindingId);
      if (!binding || binding.ownerId !== finding.id || binding.ownerType !== 'finding') {
        addError(errors, 'invalid-acceptance-binding', `${checkPath}.evidenceBindingIds`, `${bindingId} is not evidence owned by ${finding.id}.`);
      }
    }
    for (const validationId of check.validationIds) {
      if (!validationMap.has(validationId)) {
        addError(errors, 'unknown-validation', `${checkPath}.validationIds`, `${validationId} does not exist.`);
      }
    }
    if (check.status === 'passed') {
      if (['visual', 'cross-locale'].includes(check.kind) && !check.evidenceBindingIds.length) {
        addError(errors, 'unsupported-acceptance', checkPath, `Passed ${check.kind} acceptance requires evidence bindings.`);
      }
      if (['visual', 'cross-locale'].includes(check.kind)) {
        for (const bindingId of check.evidenceBindingIds) {
          if (bindingMap.get(bindingId)?.review.verdict !== 'supports') {
            addError(errors, 'acceptance-uses-unsupported-evidence', checkPath, `${bindingId} does not have a supports verdict.`);
          }
        }
      }
      if (finding.verification.result === 'passed' && ['visual', 'cross-locale'].includes(check.kind)) {
        for (const bindingId of check.evidenceBindingIds) {
          const role = bindingMap.get(bindingId)?.role;
          if (!['verification-context', 'verification-detail', 'regression-check'].includes(role)) {
            addError(errors, 'acceptance-uses-before-evidence', checkPath, `${bindingId} has role ${role}; passed final visual acceptance requires final or regression evidence.`);
          }
        }
      }
      if (check.kind === 'cross-locale') {
        const primaryLocale = [...bindingMap.values()]
          .filter((binding) => binding.ownerType === 'finding' && binding.ownerId === finding.id && binding.role === 'issue-detail')
          .map((binding) => captureMap.get(binding.captureId)?.locale)
          .find(Boolean);
        const hasAlternateLocale = check.evidenceBindingIds.some((bindingId) => {
          const binding = bindingMap.get(bindingId);
          const capture = binding ? captureMap.get(binding.captureId) : null;
          return binding?.role === 'regression-check' && capture?.locale && capture.locale !== primaryLocale;
        });
        if (!hasAlternateLocale) {
          addError(errors, 'cross-locale-without-alternate-target', checkPath, 'Passed cross-locale acceptance requires regression-check evidence from an alternate locale target.');
        }
      }
      if (['code', 'runtime', 'release'].includes(check.kind) && !check.validationIds.length) {
        addError(errors, 'unsupported-acceptance', checkPath, `Passed ${check.kind} acceptance requires validation records.`);
      }
      for (const validationId of check.validationIds) {
        const validation = validationMap.get(validationId);
        if (validation?.result !== 'passed') {
          addError(errors, 'failed-acceptance-validation', checkPath, `${validationId} is not a passing validation.`);
        }
        const expectedScopes = ACCEPTANCE_VALIDATION_SCOPES[check.kind];
        if (expectedScopes && validation && !expectedScopes.has(validation.scope)) {
          addError(errors, 'acceptance-validation-scope', checkPath, `${validationId} has scope ${validation.scope}; ${check.kind} acceptance requires ${[...expectedScopes].join(', ')}.`);
        }
      }
    }
  }
  return checkIds;
}

/** Enforces before-fix-after evidence ordering for each finding lifecycle. */
function checkLifecycleRequirements(finding, errors, findingPath) {
  const eventTypes = new Set(finding.lifecycleEvents.map((event) => event.type));
  if (!eventTypes.has('finding-admitted')) addError(errors, 'missing-lifecycle-event', findingPath, 'Finding has no finding-admitted lifecycle event.');
  if (finding.remediation.disposition === 'fixed-locally' && !eventTypes.has('fix-planned')) {
    addError(errors, 'missing-lifecycle-event', findingPath, 'Fixed finding has no fix-planned lifecycle event.');
  }
  if (finding.remediation.disposition === 'fixed-locally' && !eventTypes.has('fixed-locally')) {
    addError(errors, 'missing-lifecycle-event', findingPath, 'Fixed finding has no fixed-locally lifecycle event.');
  }
  if (finding.remediation.commit && !eventTypes.has('committed')) {
    addError(errors, 'missing-lifecycle-event', findingPath, 'Committed finding has no committed lifecycle event.');
  }
  if (finding.verification.deploymentId && !eventTypes.has('published')) {
    addError(errors, 'missing-lifecycle-event', findingPath, 'Published finding has no published lifecycle event.');
  }
  if (finding.verification.result === 'passed' && !eventTypes.has('verified')) {
    addError(errors, 'missing-lifecycle-event', findingPath, 'Verified finding has no verified lifecycle event.');
  }
  if (finding.verification.result === 'failed' && !eventTypes.has('verification-failed')) {
    addError(errors, 'missing-lifecycle-event', findingPath, 'Failed verification has no verification-failed lifecycle event.');
  }
}

/** Checks whether two collections contain the same IDs. */
function sameIdSet(left = [], right = []) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

/** Verifies a code-risk assessment against changed paths and declared behavior. */
function verifyAssessmentRisk({
  assessment,
  codeRiskReviews,
  primaryInspectorId,
  errors,
  assessmentPath,
  findingIds,
  scope,
  requireReview,
}) {
  if (!assessment) return null;
  const calculatedFloor = deriveRiskFloor(assessment);
  if (assessment.derivedRiskFloor !== calculatedFloor) {
    addError(errors, 'risk-floor-mismatch', `${assessmentPath}.derivedRiskFloor`, `Expected derived risk floor ${calculatedFloor}, received ${assessment.derivedRiskFloor}.`);
  }
  if (RISK_RANK[assessment.claimedRisk] < RISK_RANK[calculatedFloor]) {
    addError(errors, 'risk-understated', `${assessmentPath}.claimedRisk`, `Claimed risk ${assessment.claimedRisk} is below the derived floor ${calculatedFloor}.`);
  }
  if (assessment.diffArtifact.sha256 !== assessment.diffSha256) {
    addError(errors, 'diff-artifact-hash-mismatch', `${assessmentPath}.diffArtifact`, 'The readable diff artifact hash must equal diffSha256.');
  }
  const review = codeRiskReviews.find((item) => (
    item.baseCommit === assessment.baseCommit
    && item.fixCommit === assessment.fixCommit
    && item.diffSha256 === assessment.diffSha256
    && (
      (item.scope === scope && sameIdSet(item.findingIds, findingIds))
      || (scope === 'finding' && item.scope === 'release' && item.findingIds.includes(findingIds[0]))
    )
  ));
  if (!review) {
    if (requireReview) addError(errors, 'missing-code-risk-review', assessmentPath, `The ${scope} assessment has no matching independent code-risk review.`);
    return null;
  }
  if (review.reviewerId === primaryInspectorId) {
    addError(errors, 'non-independent-code-risk-review', assessmentPath, `Code-risk review ${review.id} was performed by the primary inspector.`);
  }
  if (review.verdict !== 'approved') {
    addError(errors, 'code-risk-review-not-approved', assessmentPath, `Code-risk review ${review.id} is ${review.verdict}.`);
  }
  const unresolvedHigh = review.findings.filter((item) => !item.resolved && ['P0', 'P1'].includes(item.severity));
  if (unresolvedHigh.length) {
    addError(errors, 'unresolved-code-risk', assessmentPath, `Code-risk review ${review.id} has unresolved P0/P1 findings.`);
  }
  if (assessment.claimedRisk === 'low' && review.findings.some((item) => !item.resolved && item.severity === 'P2')) {
    addError(errors, 'low-risk-conflicts-with-review', assessmentPath, `Low risk conflicts with unresolved P2 findings in ${review.id}.`);
  }
  return review;
}

/** Verifies finding risk ownership, review independence, and required assessments. */
function verifyFindingRisk(finding, codeRiskReviews, primaryInspectorId, errors, findingPath, requireReview) {
  return verifyAssessmentRisk({
    assessment: finding.remediation.fixAssessment,
    codeRiskReviews,
    primaryInspectorId,
    errors,
    assessmentPath: `${findingPath}.remediation.fixAssessment`,
    findingIds: [finding.id],
    scope: 'finding',
    requireReview,
  });
}

/** Collects every structured artifact reference that must be verified on disk. */
function collectSupportingArtifactEntries(report) {
  const entries = [];
  const add = (kind, ownerPath, artifact, record) => {
    if (artifact) entries.push({ kind, ownerPath, artifact, record });
  };
  add('coverage', '$.coverageInventory.artifact', report.coverageInventory?.artifact, report.coverageInventory);
  report.deployments.forEach((item, index) => add(
    'deployment',
    `$.deployments[${index}].evidence.artifact`,
    item.evidence.artifact,
    item,
  ));
  report.captures.forEach((item, index) => add(
    'deployment-identity',
    `$.captures[${index}].deploymentIdentityProof.artifact`,
    item.deploymentIdentityProof?.artifact,
    item,
  ));
  report.validations.forEach((item, index) => add(
    'validation',
    `$.validations[${index}].artifact`,
    item.artifact,
    item,
  ));
  report.evidenceBindings.forEach((item, index) => add(
    'evidence-review',
    `$.evidenceBindings[${index}].review.artifact`,
    item.review.artifact,
    item,
  ));
  report.evidenceBindings.forEach((item, index) => add(
    'evidence-review',
    `$.evidenceBindings[${index}].admissionReview.artifact`,
    item.admissionReview?.artifact,
    item.admissionReview ? { ...item, review: item.admissionReview } : null,
  ));
  report.reviews.codeRisk.forEach((item, index) => add(
    'code-review',
    `$.reviews.codeRisk[${index}].artifact`,
    item.artifact,
    item,
  ));
  if (report.reviews.finalReport) {
    add('final-review', '$.reviews.finalReport.artifact', report.reviews.finalReport.artifact, report.reviews.finalReport);
  }
  report.findings.forEach((finding, index) => add(
    'diff',
    `$.findings[${index}].remediation.fixAssessment.diffArtifact`,
    finding.remediation.fixAssessment?.diffArtifact,
    finding.remediation.fixAssessment,
  ));
  add('diff', '$.releaseAssessment.diffArtifact', report.releaseAssessment?.diffArtifact, report.releaseAssessment);
  return entries;
}

/** Checks whether two values are equivalent after canonicalization. */
function canonicalEqual(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

/** Adds validation errors for missing structured-artifact fields. */
function requireArtifactFields(payload, expected, ownerPath, errors) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    addError(errors, 'artifact-content-mismatch', ownerPath, 'Artifact must contain a JSON object.');
    return;
  }
  for (const [field, value] of Object.entries(expected)) {
    if (!canonicalEqual(payload[field], value)) {
      addError(errors, 'artifact-content-mismatch', ownerPath, `Artifact field ${field} does not exactly match the report record.`);
    }
  }
}

/** Verifies an artifact payload matches its owning report record and digest. */
function verifyStructuredArtifact(entry, payload, report, errors) {
  if (entry.kind === 'coverage') {
    const inventory = entry.record;
    const roots = report.coverage.filter((item) => !item.parentId).map((item) => ({
      id: item.id,
      targetId: item.targetId,
      label: item.label,
      kind: item.kind,
      url: item.url,
      rendererKey: item.rendererKey,
      sourceRefs: item.sourceRefs,
    }));
    requireArtifactFields(payload, {
      generatedAt: inventory.generatedAt,
      sourceRefs: inventory.sourceRefs,
      methodology: inventory.methodology,
      roots,
      exclusions: inventory.excludedRoots,
    }, entry.ownerPath, errors);
    return;
  }
  if (entry.kind === 'deployment') {
    const deployment = entry.record;
    requireArtifactFields(payload, {
      id: deployment.id,
      provider: deployment.provider,
      status: deployment.status,
      previewUrl: deployment.previewUrl,
      buildCommit: deployment.buildCommit,
      publishedAt: deployment.publishedAt,
      command: deployment.evidence.command,
      resultSummary: deployment.evidence.resultSummary,
    }, entry.ownerPath, errors);
    if (typeof payload.rawOutput !== 'string' || !payload.rawOutput.trim()) {
      addError(errors, 'artifact-content-mismatch', entry.ownerPath, 'Deployment artifact requires non-empty rawOutput.');
    }
    return;
  }
  if (entry.kind === 'deployment-identity') {
    const capture = entry.record;
    const proof = capture.deploymentIdentityProof;
    const expected = {
      captureId: capture.id,
      deploymentId: capture.deploymentId,
      method: proof.method,
      requestedUrl: proof.requestedUrl,
      currentUrl: capture.url,
    };
    if (proof.method === 'loaded-resource-url') expected.observedResourceUrl = proof.observedResourceUrl;
    if (proof.method === 'runtime-publication-manifest') expected.runtimeIdentity = proof.runtimeIdentity;
    requireArtifactFields(payload, expected, entry.ownerPath, errors);
    return;
  }
  if (entry.kind === 'validation') {
    const validation = entry.record;
    requireArtifactFields(payload, {
      id: validation.id,
      scope: validation.scope,
      executedAt: validation.executedAt,
      exitCode: validation.exitCode,
    }, entry.ownerPath, errors);
    if (!Array.isArray(payload.command) || payload.command.some((part) => typeof part !== 'string')) {
      addError(errors, 'artifact-content-mismatch', entry.ownerPath, 'Validation artifact command must contain the raw argument array.');
    }
    if (!canonicalEqual(payload.commandText, validation.command)) {
      addError(errors, 'artifact-content-mismatch', entry.ownerPath, 'Artifact commandText does not exactly match the report record.');
    }
    if (typeof payload.stdout !== 'string' || typeof payload.stderr !== 'string') {
      addError(errors, 'artifact-content-mismatch', entry.ownerPath, 'Validation artifact requires stdout and stderr strings.');
    }
    return;
  }
  if (entry.kind === 'evidence-review') {
    const binding = entry.record;
    requireArtifactFields(payload, {
      reviewerId: binding.review.reviewerId,
      reviewerType: binding.review.reviewerType,
      reviewSessionId: binding.review.reviewSessionId,
    }, entry.ownerPath, errors);
    const artifactReview = Array.isArray(payload.reviews)
      ? payload.reviews.find((item) => item.id === binding.id)
      : null;
    if (!artifactReview) {
      addError(errors, 'artifact-content-mismatch', entry.ownerPath, `Evidence artifact has no review for ${binding.id}.`);
      return;
    }
    requireArtifactFields(artifactReview, {
      id: binding.id,
      captureId: binding.captureId,
      assetSha256: binding.review.assetSha256,
      reviewedAt: binding.review.reviewedAt,
      verdict: binding.review.verdict,
      observedText: binding.review.observedText || '',
      checks: binding.review.checks,
      rationale: binding.review.rationale,
    }, entry.ownerPath, errors);
    return;
  }
  if (entry.kind === 'code-review') {
    const review = entry.record;
    requireArtifactFields(payload, {
      id: review.id,
      scope: review.scope,
      findingIds: review.findingIds,
      reviewerId: review.reviewerId,
      reviewerType: review.reviewerType,
      reviewSessionId: review.reviewSessionId,
      baseCommit: review.baseCommit,
      fixCommit: review.fixCommit,
      diffSha256: review.diffSha256,
      reviewedAt: review.reviewedAt,
      verdict: review.verdict,
      findings: review.findings,
      notes: review.notes,
    }, entry.ownerPath, errors);
    return;
  }
  if (entry.kind === 'final-review') {
    const review = entry.record;
    requireArtifactFields(payload, {
      id: review.id,
      contentSha256: review.contentSha256,
      reportRevision: review.reportRevision,
      reviewerId: review.reviewerId,
      reviewerType: review.reviewerType,
      reviewSessionId: review.reviewSessionId,
      reviewedAt: review.reviewedAt,
      verdict: review.verdict,
      findingReviews: review.findingReviews,
      coverageAssessable: review.coverageAssessable,
      artifactUsable: review.artifactUsable,
      notes: review.notes,
    }, entry.ownerPath, errors);
  }
}

/** Verifies referenced artifacts are present, immutable, and structurally consistent. */
async function verifySupportingArtifacts(report, reportPath, errors) {
  const reportDirectory = path.dirname(reportPath);
  let reportDirectoryReal;
  try {
    reportDirectoryReal = await fs.realpath(reportDirectory);
  } catch (error) {
    addError(errors, 'report-directory-error', '$.run.reportHtmlPath', `Report directory is not accessible: ${error.message}`);
    return;
  }
  const artifactRelative = normalizeRelativePath(report.run.artifactDirectory).replace(/\/$/, '');
  if (path.posix.isAbsolute(artifactRelative) || artifactRelative === '..' || artifactRelative.startsWith('../')) {
    addError(errors, 'unsafe-artifact-directory', '$.run.artifactDirectory', 'Artifact directory must be report-relative and cannot escape the report folder.');
    return;
  }
  const artifactDirectory = path.resolve(reportDirectory, artifactRelative);
  if (!pathInside(reportDirectory, artifactDirectory)) {
    addError(errors, 'unsafe-artifact-directory', '$.run.artifactDirectory', 'Artifact directory resolves outside the report folder.');
    return;
  }
  let artifactDirectoryReal;
  try {
    artifactDirectoryReal = await fs.realpath(artifactDirectory);
  } catch (error) {
    addError(errors, 'missing-artifact-directory', '$.run.artifactDirectory', `Artifact directory is not accessible: ${error.message}`);
    return;
  }

  const reportHtmlRelative = normalizeRelativePath(report.run.reportHtmlPath);
  if (path.posix.isAbsolute(reportHtmlRelative) || reportHtmlRelative === '..' || reportHtmlRelative.startsWith('../')) {
    addError(errors, 'unsafe-report-html-path', '$.run.reportHtmlPath', 'Report HTML path must be report-relative.');
  } else {
    try {
      const reportHtmlPath = await fs.realpath(path.resolve(reportDirectory, reportHtmlRelative));
      if (!pathInside(reportDirectoryReal, reportHtmlPath)) {
        addError(errors, 'report-html-symlink-escape', '$.run.reportHtmlPath', 'Report HTML resolves outside the report folder.');
      } else {
        const html = await fs.readFile(reportHtmlPath, 'utf8');
        const actualShellSha256 = computeReportShellSha256(html);
        if (actualShellSha256 !== report.run.reportShellSha256) {
          addError(errors, 'report-shell-mismatch', '$.run.reportShellSha256', `Report shell hash is ${actualShellSha256}, not ${report.run.reportShellSha256}.`);
        }
      }
    } catch (error) {
      addError(errors, 'report-html-error', '$.run.reportHtmlPath', error.message);
    }
  }

  const checked = new Map();
  for (const entry of collectSupportingArtifactEntries(report)) {
    const normalized = normalizeRelativePath(entry.artifact.path);
    if (path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) {
      addError(errors, 'unsafe-artifact-path', entry.ownerPath, 'Artifact path must be report-relative and cannot escape the report folder.');
      continue;
    }
    if (!(normalized === artifactRelative || normalized.startsWith(`${artifactRelative}/`))) {
      addError(errors, 'artifact-outside-directory', entry.ownerPath, `Artifact path must be inside ${report.run.artifactDirectory}.`);
      continue;
    }
    const prior = checked.get(normalized);
    if (prior && prior.sha256 !== entry.artifact.sha256) {
      addError(errors, 'artifact-hash-conflict', entry.ownerPath, `${normalized} is referenced with conflicting hashes.`);
      continue;
    }
    let actual = prior;
    if (!actual) {
      try {
        const real = await fs.realpath(path.resolve(reportDirectory, normalized));
        if (!pathInside(artifactDirectoryReal, real)) {
          addError(errors, 'artifact-symlink-escape', entry.ownerPath, `${normalized} resolves outside the artifact directory.`);
          continue;
        }
        const bytes = await fs.readFile(real);
        actual = { sha256: sha256(bytes), bytes, text: bytes.toString('utf8'), byteLength: bytes.byteLength };
        checked.set(normalized, actual);
      } catch (error) {
        addError(errors, 'artifact-file-error', entry.ownerPath, error.message);
        continue;
      }
    }
    if (!actual.byteLength) addError(errors, 'empty-artifact', entry.ownerPath, `${normalized} is empty.`);
    if (actual.sha256 !== entry.artifact.sha256) {
      addError(errors, 'artifact-hash-mismatch', entry.ownerPath, `${normalized} hash is ${actual.sha256}, not ${entry.artifact.sha256}.`);
    }
    if (entry.kind === 'diff') {
      if (entry.record?.diffSha256 !== actual.sha256) {
        addError(errors, 'diff-artifact-content-mismatch', entry.ownerPath, `${normalized} is not the recorded Git diff bytes.`);
      }
      continue;
    }
    try {
      verifyStructuredArtifact(entry, JSON.parse(actual.text), report, errors);
    } catch (error) {
      addError(errors, 'artifact-json-error', entry.ownerPath, `${normalized} is not valid JSON: ${error.message}`);
    }
  }
}

/** Verifies screenshot files, hashes, geometry, annotations, and deployment identity. */
async function verifyCaptureAssets(report, reportPath, errors) {
  const reportDirectory = path.dirname(reportPath);
  const screenshotRelative = normalizeRelativePath(report.run.screenshotDirectory).replace(/\/$/, '');
  if (path.posix.isAbsolute(screenshotRelative) || screenshotRelative === '..' || screenshotRelative.startsWith('../')) {
    addError(errors, 'unsafe-screenshot-directory', '$.run.screenshotDirectory', 'Screenshot directory must be report-relative and cannot escape the report folder.');
    return;
  }
  const screenshotDirectory = path.resolve(reportDirectory, screenshotRelative);
  if (!pathInside(reportDirectory, screenshotDirectory)) {
    addError(errors, 'unsafe-screenshot-directory', '$.run.screenshotDirectory', 'Screenshot directory resolves outside the report folder.');
    return;
  }
  let screenshotDirectoryReal;
  try {
    screenshotDirectoryReal = await fs.realpath(screenshotDirectory);
  } catch (error) {
    addError(errors, 'missing-screenshot-directory', '$.run.screenshotDirectory', `Screenshot directory is not accessible: ${error.message}`);
    return;
  }

  const seenPaths = new Set();
  const seenDigests = new Map();
  for (const [index, capture] of report.captures.entries()) {
    const capturePath = `$.captures[${index}]`;
    const normalized = normalizeRelativePath(capture.path);
    if (path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) {
      addError(errors, 'unsafe-capture-path', `${capturePath}.path`, 'Capture path must be report-relative and cannot escape the report folder.');
      continue;
    }
    if (!(normalized === screenshotRelative || normalized.startsWith(`${screenshotRelative}/`))) {
      addError(errors, 'capture-outside-screenshot-directory', `${capturePath}.path`, `Capture path must be inside ${report.run.screenshotDirectory}.`);
      continue;
    }
    if (seenPaths.has(normalized)) addError(errors, 'duplicate-capture-path', `${capturePath}.path`, `Duplicate capture path ${normalized}.`);
    seenPaths.add(normalized);

    const absolute = path.resolve(reportDirectory, normalized);
    try {
      const real = await fs.realpath(absolute);
      if (!pathInside(screenshotDirectoryReal, real)) {
        addError(errors, 'capture-symlink-escape', `${capturePath}.path`, 'Capture resolves outside the screenshot directory.');
        continue;
      }
      const actual = await inspectImageFile(real);
      for (const field of ['sha256', 'mimeType', 'byteLength', 'pixelWidth', 'pixelHeight']) {
        if (capture[field] !== actual[field]) {
          addError(errors, 'capture-asset-mismatch', `${capturePath}.${field}`, `Recorded ${field} ${capture[field]} does not match saved pixels ${actual[field]}.`);
        }
      }
      if (capture.captureKind === 'full-viewport') {
        const expectedWidth = Math.round(capture.viewport.width * capture.captureScaleFactor);
        const expectedHeight = Math.round(capture.viewport.height * capture.captureScaleFactor);
        if (actual.pixelWidth !== expectedWidth || actual.pixelHeight !== expectedHeight) {
          addError(
            errors,
            'full-viewport-dimension-mismatch',
            capturePath,
            `Full-viewport pixels are ${actual.pixelWidth}x${actual.pixelHeight}; expected ${expectedWidth}x${expectedHeight} from CSS viewport and capture scale ${capture.captureScaleFactor}. Actual device DPR ${capture.viewport.deviceScaleFactor} remains separate metadata.`,
          );
        }
      }
      const extension = path.extname(normalized).toLowerCase();
      if (actual.mimeType === 'image/png' && extension !== '.png') {
        addError(errors, 'capture-extension-mismatch', `${capturePath}.path`, 'PNG bytes must use a .png extension.');
      }
      if (actual.mimeType === 'image/jpeg' && !['.jpg', '.jpeg'].includes(extension)) {
        addError(errors, 'capture-extension-mismatch', `${capturePath}.path`, 'JPEG bytes must use a .jpg or .jpeg extension.');
      }
      if (seenDigests.has(actual.sha256)) {
        addError(errors, 'duplicate-capture-digest', `${capturePath}.sha256`, `Saved pixels duplicate capture ${seenDigests.get(actual.sha256)}; reuse one capture record instead.`);
      } else {
        seenDigests.set(actual.sha256, capture.id);
      }
    } catch (error) {
      addError(errors, 'capture-file-error', `${capturePath}.path`, error.message);
    }
  }
}

/** Verifies one recorded code-risk assessment against the repository commit range. */
async function verifyGitAssessment(repositoryPath, assessment, assessmentPath, actualByRange, errors) {
  const range = `${assessment.baseCommit}..${assessment.fixCommit}`;
  try {
    let actual = actualByRange.get(range);
    if (!actual) {
      actual = await collectGitDiffEvidence(repositoryPath, assessment.baseCommit, assessment.fixCommit);
      actualByRange.set(range, actual);
    }
    if (actual.baseCommit !== assessment.baseCommit || actual.fixCommit !== assessment.fixCommit) {
      addError(errors, 'git-commit-resolution-mismatch', assessmentPath, `${range} does not resolve to the recorded full commits.`);
    }
    if (actual.diffSha256 !== assessment.diffSha256) {
      addError(errors, 'git-diff-hash-mismatch', assessmentPath, `${range} diff hash is ${actual.diffSha256}, not ${assessment.diffSha256}.`);
    }
    const recordedPaths = assessment.changedFiles.map((item) => item.path);
    if (new Set(recordedPaths).size !== recordedPaths.length) {
      addError(errors, 'duplicate-changed-file', `${assessmentPath}.changedFiles`, 'Changed file records must be unique.');
    }
    const actualPaths = new Set(actual.changedFiles);
    const recordedPathSet = new Set(recordedPaths);
    for (const recordedPath of recordedPathSet) {
      if (!actualPaths.has(recordedPath)) {
        addError(errors, 'changed-file-not-in-diff', `${assessmentPath}.changedFiles`, `${recordedPath} is not changed in ${range}.`);
      }
    }
    const omittedPaths = actual.changedFiles.filter((filePath) => !recordedPathSet.has(filePath));
    if (omittedPaths.length) {
      addError(errors, 'diff-file-omitted', `${assessmentPath}.changedFiles`, `Changed files omitted from risk assessment: ${omittedPaths.join(', ')}.`);
    }
  } catch (error) {
    addError(errors, 'git-evidence-error', assessmentPath, `Cannot verify ${range}: ${error.message}`);
  }
}

/** Verifies a source reference resolves inside the inspected repository. */
async function verifySourceReference(reference, repositoryReal, errors, referencePath, { allowRuntime = true } = {}) {
  if (/^(runtime|dom):/.test(reference)) {
    if (!allowRuntime) addError(errors, 'inventory-runtime-source-ref', referencePath, 'Coverage inventory roots must be backed by repository source files.');
    return;
  }
  const match = /^(.*?)(?::(\d+))?$/.exec(reference);
  const relative = normalizeRelativePath(match?.[1] || '');
  if (!relative || path.posix.isAbsolute(relative) || relative === '..' || relative.startsWith('../')) {
    addError(errors, 'unsafe-source-ref', referencePath, `${reference} is not a safe repository-relative source reference.`);
    return;
  }
  try {
    const sourceReal = await fs.realpath(path.resolve(repositoryReal, relative));
    if (!pathInside(repositoryReal, sourceReal)) {
      addError(errors, 'source-ref-symlink-escape', referencePath, `${reference} resolves outside the repository.`);
      return;
    }
    if (match?.[2]) {
      const content = await fs.readFile(sourceReal, 'utf8');
      const line = Number(match[2]);
      const lineCount = content.split(/\r?\n/).length;
      if (line > lineCount) addError(errors, 'source-line-out-of-range', referencePath, `${reference} exceeds the file's ${lineCount} lines.`);
    }
  } catch (error) {
    addError(errors, 'source-ref-error', referencePath, `${reference} cannot be verified: ${error.message}`);
  }
}

/** Verifies commits, diffs, source references, and review scope against Git. */
async function verifyRepositoryEvidence(report, repositoryPath, errors) {
  let repositoryReal;
  try {
    repositoryReal = await fs.realpath(repositoryPath);
  } catch (error) {
    addError(errors, 'repository-error', '$.run.repository', `Repository is not accessible: ${error.message}`);
    return;
  }
  const actualByRange = new Map();
  for (const [index, finding] of report.findings.entries()) {
    const assessment = finding.remediation.fixAssessment;
    if (!assessment) continue;
    await verifyGitAssessment(repositoryReal, assessment, `$.findings[${index}].remediation.fixAssessment`, actualByRange, errors);
    if (report.run.baselineCommit && report.run.finalCommit) {
      try {
        await execFile('git', ['merge-base', '--is-ancestor', report.run.baselineCommit, assessment.baseCommit], { cwd: repositoryReal });
        await execFile('git', ['merge-base', '--is-ancestor', assessment.fixCommit, report.run.finalCommit], { cwd: repositoryReal });
      } catch {
        addError(errors, 'finding-commit-outside-release', `$.findings[${index}].remediation.fixAssessment`, 'Finding fix commits must be contained in the baseline-to-final release ancestry.');
      }
    }
  }
  if (report.releaseAssessment) {
    await verifyGitAssessment(repositoryReal, report.releaseAssessment, '$.releaseAssessment', actualByRange, errors);
  }
  for (const [findingIndex, finding] of report.findings.entries()) {
    for (const [matchIndex, match] of finding.sourceAttribution.matches.entries()) {
      const reference = `${match.filePath}${match.line ? `:${match.line}` : ''}`;
      await verifySourceReference(reference, repositoryReal, errors, `$.findings[${findingIndex}].sourceAttribution.matches[${matchIndex}]`);
    }
  }
  for (const [coverageIndex, coverage] of report.coverage.entries()) {
    for (const [refIndex, reference] of coverage.sourceRefs.entries()) {
      await verifySourceReference(reference, repositoryReal, errors, `$.coverage[${coverageIndex}].sourceRefs[${refIndex}]`, {
        allowRuntime: Boolean(coverage.parentId),
      });
    }
  }
  for (const [refIndex, reference] of (report.coverageInventory?.sourceRefs || []).entries()) {
    await verifySourceReference(reference, repositoryReal, errors, `$.coverageInventory.sourceRefs[${refIndex}]`, { allowRuntime: false });
  }
}

/** Validates report structure and every cross-record evidence invariant. */
export async function validateUiInspectionReport(report, options = {}) {
  const schema = options.schema || await loadUiInspectionReportSchema(options.schemaPath);
  const structuralErrors = validateJsonSchema(report, schema).map((error) => ({
    code: 'schema',
    path: error.path,
    message: error.message,
  }));
  if (structuralErrors.length) return { errors: structuralErrors, warnings: [], derived: null };

  const errors = [];
  const warnings = [];
  const targetMap = idMap(report.targets);
  const deploymentMap = idMap(report.deployments);
  const validationMap = idMap(report.validations);
  const coverageMap = idMap(report.coverage);
  const captureMap = idMap(report.captures);
  const bindingMap = idMap(report.evidenceBindings);
  const findingMap = idMap(report.findings);
  const observationMap = idMap(report.observations);

  requireUniqueIds([
    ['targets', report.targets],
    ['deployments', report.deployments],
    ['validations', report.validations],
    ['coverage', report.coverage],
    ['captures', report.captures],
    ['evidenceBindings', report.evidenceBindings],
    ['findings', report.findings],
    ['observations', report.observations],
    ['codeRiskReviews', report.reviews.codeRisk],
    ['finalReportReviews', report.reviews.finalReport ? [report.reviews.finalReport] : []],
  ], errors);

  const runStart = parsedTime(report.run.startedAt, '$.run.startedAt', errors);
  const runUpdated = parsedTime(report.run.updatedAt, '$.run.updatedAt', errors);
  if (runStart !== null && runUpdated !== null && runUpdated < runStart) {
    addError(errors, 'run-time-order', '$.run.updatedAt', 'Run updatedAt precedes startedAt.');
  }
  const reviewableRun = REVIEWABLE_RUN_STATUSES.has(report.run.status);
  if (reviewableRun && !report.coverage.length) {
    addError(errors, 'reviewable-run-without-coverage', '$.coverage', 'A reviewable report requires a non-empty coverage inventory.');
  }
  if (reviewableRun && report.run.authorization !== 'inspect-only') {
    for (const field of ['repository', 'branch', 'baselineCommit']) {
      if (!report.run[field]) addError(errors, 'missing-run-provenance', `$.run.${field}`, `Reviewable ${report.run.authorization} runs require ${field}.`);
    }
  }
  const hasLocalFixRecord = report.findings.some((finding) => (
    ['fix-planned', 'fixed-locally'].includes(finding.remediation.disposition)
    || finding.remediation.fixAssessment
    || finding.remediation.commit
    || finding.verification.result !== 'not-run'
  ));
  const hasFixDeployment = report.deployments.some((item) => item.stage === 'fix');
  if (report.run.authorization === 'inspect-only' && (hasLocalFixRecord || hasFixDeployment || report.run.finalCommit)) {
    addError(errors, 'inspect-only-has-remediation', '$.run.authorization', 'inspect-only reports cannot contain local fixes, fix commits, fix deployments, verification, or finalCommit.');
  }
  if (report.run.authorization === 'fix-local' && (
    hasFixDeployment
    || report.run.finalCommit
    || report.findings.some((finding) => finding.remediation.commit || finding.verification.deploymentId)
  )) {
    addError(errors, 'fix-local-has-publish-evidence', '$.run.authorization', 'fix-local reports cannot contain pushed commits, fix deployments, deployment verification, or finalCommit.');
  }

  for (const [index, deployment] of report.deployments.entries()) {
    const deploymentPath = `$.deployments[${index}]`;
    const publishedAt = parsedTime(deployment.publishedAt, `${deploymentPath}.publishedAt`, errors);
    if (deployment.stage === 'fix' && runStart !== null && publishedAt !== null && publishedAt < runStart) {
      addError(errors, 'fix-deployment-before-run', deploymentPath, `${deployment.id} predates the inspection run.`);
    }
    if (runUpdated !== null && publishedAt !== null && publishedAt > runUpdated) {
      addError(errors, 'deployment-after-report-update', deploymentPath, `${deployment.id} is newer than run.updatedAt.`);
    }
    if (deployment.stage === 'baseline' && report.run.baselineCommit && deployment.status === 'published' && deployment.buildCommit !== report.run.baselineCommit) {
      addError(errors, 'baseline-deployment-commit', deploymentPath, `${deployment.id} does not use run.baselineCommit.`);
    }
  }
  if (reviewableRun && report.run.authorization === 'release-verify') {
    const baselineDeployment = report.deployments.find((item) => item.stage === 'baseline'
      && item.status === 'published'
      && item.buildCommit === report.run.baselineCommit);
    if (!baselineDeployment) {
      addError(errors, 'missing-baseline-deployment', '$.deployments', 'A release-verify report requires a published baseline deployment for run.baselineCommit.');
    }
  }
  const hasReleaseDiff = Boolean(
    report.run.baselineCommit
    && report.run.finalCommit
    && report.run.baselineCommit !== report.run.finalCommit
  );
  if (reviewableRun && hasReleaseDiff && !report.releaseAssessment) {
    addError(errors, 'missing-release-assessment', '$.releaseAssessment', 'A changed baseline-to-final release requires a run-level release assessment.');
  }
  if (report.releaseAssessment) {
    const assessment = report.releaseAssessment;
    if (assessment.baseCommit !== report.run.baselineCommit || assessment.fixCommit !== report.run.finalCommit) {
      addError(errors, 'release-assessment-range-mismatch', '$.releaseAssessment', 'Release assessment must cover exactly run.baselineCommit..run.finalCommit.');
    }
    if (new Set(assessment.findingIds).size !== assessment.findingIds.length) {
      addError(errors, 'duplicate-release-finding', '$.releaseAssessment.findingIds', 'Release assessment finding IDs must be unique.');
    }
    for (const findingId of assessment.findingIds) {
      if (!findingMap.has(findingId)) addError(errors, 'unknown-release-finding', '$.releaseAssessment.findingIds', `${findingId} does not exist.`);
    }
    const fixedFindingIds = report.findings
      .filter((finding) => finding.remediation.fixAssessment)
      .map((finding) => finding.id);
    if (!sameIdSet(assessment.findingIds, fixedFindingIds)) {
      addError(errors, 'release-finding-set-mismatch', '$.releaseAssessment.findingIds', 'Release assessment findingIds must exactly cover every finding with a code fix in this run.');
    }
    for (const validationId of assessment.validationIds) {
      const validation = validationMap.get(validationId);
      if (!validation) {
        addError(errors, 'unknown-validation', '$.releaseAssessment.validationIds', `${validationId} does not exist.`);
      } else if (validation.result !== 'passed') {
        addError(errors, 'release-assessment-failed-validation', '$.releaseAssessment.validationIds', `${validationId} is not passing.`);
      }
    }
    for (const regressionId of assessment.regressionCheckIds) {
      if (!validationMap.has(regressionId)
        && !report.findings.some((finding) => finding.acceptanceChecks.some((check) => check.id === regressionId))) {
        addError(errors, 'unknown-release-regression-check', '$.releaseAssessment.regressionCheckIds', `${regressionId} is neither a validation nor finding acceptance check.`);
      }
    }
    verifyAssessmentRisk({
      assessment,
      codeRiskReviews: report.reviews.codeRisk,
      primaryInspectorId: report.run.primaryInspectorId,
      errors,
      assessmentPath: '$.releaseAssessment',
      findingIds: assessment.findingIds,
      scope: 'release',
      requireReview: reviewableRun,
    });
  }

  const allEvidenceReviews = report.evidenceBindings.flatMap((item) => [item.review, item.admissionReview].filter(Boolean));
  const evidenceReviewerIds = new Set(allEvidenceReviews.map((item) => item.reviewerId));
  const evidenceReviewSessionIds = new Set(allEvidenceReviews.map((item) => item.reviewSessionId));
  for (const [index, review] of report.reviews.codeRisk.entries()) {
    const reviewPath = `$.reviews.codeRisk[${index}]`;
    const reviewedAt = parsedTime(review.reviewedAt, `${reviewPath}.reviewedAt`, errors);
    if (review.reviewerId === report.run.primaryInspectorId) {
      addError(errors, 'non-independent-code-risk-review', `${reviewPath}.reviewerId`, 'The primary inspector cannot perform code-risk review.');
    }
    if (evidenceReviewerIds.has(review.reviewerId) || evidenceReviewSessionIds.has(review.reviewSessionId)) {
      addError(errors, 'non-isolated-code-risk-review', reviewPath, 'Code-risk review must use a reviewer and review session distinct from screenshot evidence review.');
    }
    if (runUpdated !== null && reviewedAt !== null && reviewedAt > runUpdated) {
      addError(errors, 'code-review-after-report-update', reviewPath, `${review.id} is newer than run.updatedAt.`);
    }
    if (new Set(review.findingIds).size !== review.findingIds.length) {
      addError(errors, 'duplicate-code-review-finding', `${reviewPath}.findingIds`, 'Code-risk review finding IDs must be unique.');
    }
    if (review.scope === 'finding' && review.findingIds.length !== 1) {
      addError(errors, 'finding-review-scope-mismatch', reviewPath, 'A finding-scoped code-risk review must name exactly one finding.');
    }
    if (review.scope === 'release' && !review.findingIds.length) {
      addError(errors, 'release-review-without-finding', reviewPath, 'A release-scoped code-risk review must name the findings represented by the release diff.');
    }
    for (const findingId of review.findingIds) {
      if (!findingMap.has(findingId)) addError(errors, 'review-of-unknown-finding', `${reviewPath}.findingIds`, `${findingId} does not exist.`);
    }
  }

  for (const [index, validation] of report.validations.entries()) {
    const validationPath = `$.validations[${index}]`;
    if (validation.result === 'not-run') {
      if (validation.executedAt !== undefined || validation.exitCode !== undefined || validation.artifact !== undefined) {
        addError(errors, 'not-run-has-execution-evidence', validationPath, 'not-run validation cannot contain execution time, exit code, or output artifact.');
      }
      continue;
    }
    if (!validation.executedAt || validation.exitCode === undefined || !validation.artifact) {
      addError(errors, 'executed-validation-without-artifact', validationPath, 'Executed validation requires executedAt, exitCode, and a hashed output artifact.');
      continue;
    }
    const executedAt = parsedTime(validation.executedAt, `${validationPath}.executedAt`, errors);
    if (runStart !== null && executedAt !== null && executedAt < runStart) {
      addError(errors, 'validation-before-run', validationPath, `${validation.id} predates the inspection run.`);
    }
    // A report-scope validation checks the already-frozen report, so it is
    // expected to execute after run.updatedAt. Product, code, and release
    // validations still need to predate the frozen report state.
    if (validation.scope !== 'report' && runUpdated !== null && executedAt !== null && executedAt > runUpdated) {
      addError(errors, 'validation-after-report-update', validationPath, `${validation.id} is newer than run.updatedAt.`);
    }
    if (validation.result === 'passed' && validation.exitCode !== 0) {
      addError(errors, 'passed-validation-nonzero-exit', validationPath, `${validation.id} is passed with exit code ${validation.exitCode}.`);
    }
    if (['failed', 'failed-pre-existing'].includes(validation.result) && validation.exitCode === 0) {
      addError(errors, 'failed-validation-zero-exit', validationPath, `${validation.id} is ${validation.result} with exit code 0.`);
    }
  }
  if (report.run.status === REVIEW_READY_STATUS && report.validations.some((item) => item.result === 'failed')) {
    addError(errors, 'complete-candidate-has-failed-validation', '$.validations', 'A complete candidate cannot contain a current failed validation.');
  }

  if (reviewableRun && !report.coverageInventory) {
    addError(errors, 'reviewable-run-without-inventory', '$.coverageInventory', 'A reviewable report requires a source-backed coverage inventory artifact.');
  }
  if (report.coverageInventory) {
    const inventory = report.coverageInventory;
    const inventoryAt = parsedTime(inventory.generatedAt, '$.coverageInventory.generatedAt', errors);
    if (runStart !== null && inventoryAt !== null && inventoryAt < runStart) {
      addError(errors, 'inventory-before-run', '$.coverageInventory.generatedAt', 'Coverage inventory predates the run.');
    }
    if (runUpdated !== null && inventoryAt !== null && inventoryAt > runUpdated) {
      addError(errors, 'inventory-after-report-update', '$.coverageInventory.generatedAt', 'Coverage inventory is newer than run.updatedAt.');
    }
    if (inventory.discoveredRootCount !== inventory.scopedRootCount + inventory.excludedRootCount) {
      addError(errors, 'coverage-inventory-count-mismatch', '$.coverageInventory', 'discoveredRootCount must equal scopedRootCount plus excludedRootCount.');
    }
    if (inventory.excludedRootCount !== inventory.excludedRoots.length) {
      addError(errors, 'coverage-exclusion-count-mismatch', '$.coverageInventory.excludedRoots', 'excludedRootCount must equal excludedRoots.length.');
    }
    const rootIds = report.coverage.filter((item) => !item.parentId).map((item) => item.id);
    if (new Set(inventory.rootCoverageIds).size !== inventory.rootCoverageIds.length) {
      addError(errors, 'duplicate-root-coverage-id', '$.coverageInventory.rootCoverageIds', 'Root coverage IDs must be unique.');
    }
    if (rootIds.length !== inventory.scopedRootCount
      || rootIds.some((id) => !inventory.rootCoverageIds.includes(id))
      || inventory.rootCoverageIds.some((id) => !rootIds.includes(id))) {
      addError(errors, 'coverage-inventory-root-mismatch', '$.coverageInventory.rootCoverageIds', 'rootCoverageIds must exactly match the report coverage roots and scopedRootCount.');
    }
  }

  for (const [index, coverage] of report.coverage.entries()) {
    const coveragePath = `$.coverage[${index}]`;
    if (!targetMap.has(coverage.targetId)) addError(errors, 'unknown-target', `${coveragePath}.targetId`, `${coverage.targetId} does not exist.`);
    if (coverage.parentId && !coverageMap.has(coverage.parentId)) addError(errors, 'unknown-parent', `${coveragePath}.parentId`, `${coverage.parentId} does not exist.`);
    if (!coverage.sourceRefs.length) {
      addError(errors, 'coverage-without-source-ref', `${coveragePath}.sourceRefs`, 'Every coverage node requires a source or runtime-discovery reference.');
    }
    if (COVERAGE_REASON_STATUSES.has(coverage.status) && !coverage.reason) {
      addError(errors, 'coverage-reason-required', coveragePath, `${coverage.status} coverage requires a reason.`);
    }
    if (coverage.status === 'duplicate-sampled') {
      const representative = coverageMap.get(coverage.representativeId);
      if (!coverage.representativeId || !representative) {
        addError(errors, 'coverage-representative-required', coveragePath, 'duplicate-sampled coverage requires an existing representativeId.');
      } else {
        if (coverage.representativeId === coverage.id) {
          addError(errors, 'self-representative-coverage', coveragePath, 'A duplicate-sampled node cannot represent itself.');
        }
        if (representative.status !== 'covered') {
          addError(errors, 'uncovered-coverage-representative', coveragePath, `${coverage.representativeId} must be covered.`);
        }
        if (!DUPLICATE_SAMPLE_KINDS.has(coverage.kind)) {
          addError(errors, 'unsampleable-coverage-kind', coveragePath, `${coverage.kind} coverage must be inspected directly and cannot be duplicate-sampled.`);
        }
        if (!coverage.equivalenceRationale) {
          addError(errors, 'coverage-equivalence-required', coveragePath, 'duplicate-sampled coverage requires an equivalenceRationale.');
        }
        if (representative.targetId !== coverage.targetId
          || representative.kind !== coverage.kind
          || representative.parentId !== coverage.parentId
          || representative.url !== coverage.url
          || representative.rendererKey !== coverage.rendererKey) {
          addError(errors, 'incompatible-coverage-representative', coveragePath, 'Representative coverage must use the same target, kind, parent, URL, and rendererKey.');
        }
      }
    }
    verifyOwnerBindings(coverage, 'coverage', bindingMap, errors, coveragePath);
    if (coverage.status === 'covered') {
      const supportsCoverage = coverage.evidenceBindingIds.some((bindingId) => {
        const binding = bindingMap.get(bindingId);
        return binding?.role === 'coverage' && binding.review.verdict === 'supports';
      });
      if (!supportsCoverage) addError(errors, 'covered-without-evidence', coveragePath, 'Covered state requires a supported coverage binding.');
    }
  }

  for (const parent of report.coverage) {
    const children = report.coverage.filter((item) => item.parentId === parent.id);
    if (parent.status === 'covered' && children.some((child) => COVERAGE_INCOMPLETE_STATUSES.has(child.status))) {
      addError(errors, 'covered-parent-has-incomplete-child', '$.coverage', `${parent.id} is covered while a child remains incomplete.`);
    }
    const seen = new Set([parent.id]);
    let current = parent;
    while (current.parentId) {
      if (seen.has(current.parentId)) {
        addError(errors, 'coverage-cycle', '$.coverage', `Coverage parent cycle includes ${parent.id}.`);
        break;
      }
      seen.add(current.parentId);
      current = coverageMap.get(current.parentId);
      if (!current) break;
    }
  }

  for (const [index, capture] of report.captures.entries()) {
    const capturePath = `$.captures[${index}]`;
    const navigationUrl = captureNavigationUrl(capture);
    const target = targetMap.get(capture.targetId);
    if (!target) {
      addError(errors, 'unknown-target', `${capturePath}.targetId`, `${capture.targetId} does not exist.`);
    } else {
      if (capture.locale !== target.locale) addError(errors, 'capture-locale-mismatch', `${capturePath}.locale`, `Capture locale differs from target ${target.id}.`);
      if (!sameViewport(capture.viewport, target.viewport)) addError(errors, 'capture-viewport-mismatch', `${capturePath}.viewport`, `Capture viewport differs from target ${target.id}.`);
      if (!productAppUrlMatches(target.url, capture.url, navigationUrl)) {
        addError(errors, 'capture-target-url-mismatch', `${capturePath}.url`, `Capture URL is outside the canonical product entry for ${target.id}.`);
      }
    }
    const capturedAt = parsedTime(capture.capturedAt, `${capturePath}.capturedAt`, errors);
    if (runStart !== null && capturedAt !== null && capturedAt < runStart) {
      addError(errors, 'capture-before-run', capturePath, `${capture.id} predates the inspection run.`);
    }
    if (runUpdated !== null && capturedAt !== null && capturedAt > runUpdated) {
      addError(errors, 'capture-after-report-update', capturePath, `${capture.id} is newer than run.updatedAt.`);
    }
    if (capture.deploymentId) {
      const deployment = deploymentMap.get(capture.deploymentId);
      if (!deployment) {
        addError(errors, 'unknown-deployment', `${capturePath}.deploymentId`, `${capture.deploymentId} does not exist.`);
      } else {
        const publishedAt = parsedTime(deployment.publishedAt, `$.deployments.${deployment.id}.publishedAt`, errors);
        if (capturedAt !== null && publishedAt !== null && capturedAt < publishedAt) {
          addError(errors, 'capture-before-deployment', capturePath, `${capture.id} predates deployment ${deployment.id}.`);
        }
        const proof = capture.deploymentIdentityProof;
        const directIdentity = deploymentUrlMatches(deployment.previewUrl, capture.url);
        const proofLocationMatches = proof
          ? productStateUrlMatches(capture.url, capture.url, proof.requestedUrl)
          : false;
        const proofRequestMatches = proof
          ? deploymentUrlMatches(deployment.previewUrl, proof.requestedUrl)
          : false;
        const proofIdentityMatches = proof?.method === 'loaded-resource-url'
          ? resourceUrlCarriesDeploymentIdentity(deployment.previewUrl, proof.observedResourceUrl)
          : proof?.method === 'runtime-publication-manifest'
            ? runtimePublicationManifestMatches(deployment, proof)
            : false;
        if (proof && !proofLocationMatches) {
          addError(errors, 'capture-deployment-proof-route-mismatch', `${capturePath}.deploymentIdentityProof.requestedUrl`, `${capture.id} requested URL does not represent the captured route and state.`);
        }
        if (proof && !proofRequestMatches) {
          addError(errors, 'capture-deployment-proof-request-mismatch', `${capturePath}.deploymentIdentityProof.requestedUrl`, `${capture.id} requested URL does not preserve the deployment identity from ${deployment.id}.`);
        }
        if (proof?.method === 'loaded-resource-url' && !proofIdentityMatches) {
          addError(errors, 'capture-deployment-proof-resource-mismatch', `${capturePath}.deploymentIdentityProof.observedResourceUrl`, `${capture.id} loaded resource does not carry the deployment identity from ${deployment.id}.`);
        }
        if (proof?.method === 'runtime-publication-manifest' && !proofIdentityMatches) {
          addError(errors, 'capture-deployment-proof-runtime-mismatch', `${capturePath}.deploymentIdentityProof.runtimeIdentity`, `${capture.id} runtime publication manifest does not match deployment ${deployment.id}.`);
        }
        if (!directIdentity && !(proofLocationMatches && proofRequestMatches && proofIdentityMatches)) {
          addError(errors, 'capture-deployment-url-mismatch', `${capturePath}.url`, `${capture.id} must preserve Preview identity in the current URL or provide valid requested-URL and loaded-resource proof for ${deployment.id}.`);
        }
      }
    } else if (capture.deploymentIdentityProof) {
      addError(errors, 'capture-deployment-proof-without-deployment', `${capturePath}.deploymentIdentityProof`, 'Deployment identity proof requires a deploymentId.');
    }
    if (['verification', 'verification-failed'].includes(capture.intendedUse) && !capture.deploymentId) {
      addError(errors, 'verification-capture-without-deployment', capturePath, 'Verification captures require a deploymentId.');
    }
    const admission = capture.admission;
    if (admission.status === 'admitted') {
      if (!admission.reviewedBy || !admission.reviewedAt || !admission.reviewAssetSha256 || !admission.checks) {
        addError(errors, 'incomplete-admission', `${capturePath}.admission`, 'Admitted capture requires reviewer, time, asset hash, and checks.');
      }
      if (admission.reviewAssetSha256 !== capture.sha256) addError(errors, 'admission-hash-mismatch', `${capturePath}.admission.reviewAssetSha256`, 'Pixel review hash differs from capture hash.');
      if (!allBooleanChecksPass(admission.checks)) addError(errors, 'failed-admission-check', `${capturePath}.admission.checks`, 'All admission checks must pass for admitted captures.');
      if (admission.rejectionReasons.length) addError(errors, 'admitted-with-rejection', `${capturePath}.admission.rejectionReasons`, 'Admitted capture cannot have rejection reasons.');
      const reviewedAt = parsedTime(admission.reviewedAt, `${capturePath}.admission.reviewedAt`, errors);
      if (capturedAt !== null && reviewedAt !== null && reviewedAt < capturedAt) {
        addError(errors, 'capture-review-before-capture', `${capturePath}.admission.reviewedAt`, 'Pixel review predates the capture.');
      }
      if (runUpdated !== null && reviewedAt !== null && reviewedAt > runUpdated) {
        addError(errors, 'capture-review-after-report-update', `${capturePath}.admission.reviewedAt`, 'Pixel review is newer than run.updatedAt.');
      }
    }
    if (admission.status === 'rejected' && !admission.rejectionReasons.length) {
      addError(errors, 'rejected-without-reason', `${capturePath}.admission.rejectionReasons`, 'Rejected capture requires at least one reason.');
    }
    if (admission.status === 'pending' && REVIEWABLE_RUN_STATUSES.has(report.run.status)) {
      addError(errors, 'pending-capture-in-reviewable-run', capturePath, 'Complete-candidate or human-reviewed reports cannot contain pending captures.');
    }
  }

  const evidenceSessionOwners = new Map();
  for (const [index, binding] of report.evidenceBindings.entries()) {
    const bindingPath = `$.evidenceBindings[${index}]`;
    const capture = captureMap.get(binding.captureId);
    if (!capture) {
      addError(errors, 'unknown-capture', `${bindingPath}.captureId`, `${binding.captureId} does not exist.`);
      continue;
    }
    if (capture.admission.status !== 'admitted') addError(errors, 'binding-uses-unadmitted-capture', bindingPath, `${binding.captureId} is ${capture.admission.status}.`);
    if (binding.review.reviewerId === report.run.primaryInspectorId) {
      addError(errors, 'non-independent-evidence-review', `${bindingPath}.review.reviewerId`, 'The primary inspector cannot perform claim-level screenshot evidence review.');
    }
    if (binding.review.reviewerId === capture.admission.reviewedBy) {
      addError(errors, 'non-independent-evidence-review', `${bindingPath}.review.reviewerId`, 'Claim-level screenshot evidence review must differ from capture admission review.');
    }
    const sessionOwner = evidenceSessionOwners.get(binding.review.reviewSessionId);
    const currentOwner = `${binding.review.reviewerType}:${binding.review.reviewerId}`;
    if (sessionOwner && sessionOwner !== currentOwner) {
      addError(errors, 'inconsistent-evidence-review-session', `${bindingPath}.review.reviewSessionId`, `Review session ${binding.review.reviewSessionId} is attributed to both ${sessionOwner} and ${currentOwner}.`);
    } else {
      evidenceSessionOwners.set(binding.review.reviewSessionId, currentOwner);
    }
    if (binding.review.assetSha256 !== capture.sha256) addError(errors, 'binding-review-hash-mismatch', `${bindingPath}.review.assetSha256`, 'Evidence review hash differs from capture hash.');
    const evidenceReviewedAt = parsedTime(binding.review.reviewedAt, `${bindingPath}.review.reviewedAt`, errors);
    const captureTime = parsedTime(capture.capturedAt, `$.captures.${capture.id}.capturedAt`, errors);
    if (evidenceReviewedAt !== null && captureTime !== null && evidenceReviewedAt < captureTime) {
      addError(errors, 'evidence-review-before-capture', `${bindingPath}.review.reviewedAt`, 'Evidence review predates the capture.');
    }
    if (runUpdated !== null && evidenceReviewedAt !== null && evidenceReviewedAt > runUpdated) {
      addError(errors, 'evidence-review-after-report-update', `${bindingPath}.review.reviewedAt`, 'Evidence review is newer than run.updatedAt.');
    }
    if (binding.review.verdict === 'supports' && !allBooleanChecksPass(binding.review.checks)) {
      addError(errors, 'supported-binding-failed-check', `${bindingPath}.review.checks`, 'A supports verdict requires all evidence checks to pass.');
    }
    if (binding.ownerType !== 'coverage' && binding.review.reviewerId === report.run.primaryInspectorId) {
      addError(errors, 'non-independent-evidence-review', `${bindingPath}.review.reviewerId`, 'Finding and observation evidence cannot be reviewed by the primary inspector.');
    }
    if (binding.ownerType !== 'coverage' && binding.review.reviewerId === capture.admission.reviewedBy) {
      addError(errors, 'non-independent-evidence-review', `${bindingPath}.review.reviewerId`, 'Finding and observation evidence must be reviewed by someone other than the capture reviewer.');
    }
    if (binding.admissionReview) {
      const admissionReviewPath = `${bindingPath}.admissionReview`;
      if (binding.role !== 'issue-detail') {
        addError(errors, 'admission-review-role-mismatch', admissionReviewPath, 'Only issue-detail bindings may preserve a distinct admission review.');
      }
      if (binding.admissionReview.reviewerId === report.run.primaryInspectorId
        || binding.admissionReview.reviewerId === capture.admission.reviewedBy) {
        addError(errors, 'non-independent-admission-review', `${admissionReviewPath}.reviewerId`, 'Admission review must differ from the primary inspector and capture reviewer.');
      }
      const admissionSessionOwner = evidenceSessionOwners.get(binding.admissionReview.reviewSessionId);
      const admissionOwner = `${binding.admissionReview.reviewerType}:${binding.admissionReview.reviewerId}`;
      if (admissionSessionOwner && admissionSessionOwner !== admissionOwner) {
        addError(errors, 'inconsistent-evidence-review-session', `${admissionReviewPath}.reviewSessionId`, `Review session ${binding.admissionReview.reviewSessionId} is attributed to both ${admissionSessionOwner} and ${admissionOwner}.`);
      } else {
        evidenceSessionOwners.set(binding.admissionReview.reviewSessionId, admissionOwner);
      }
      if (binding.admissionReview.assetSha256 !== capture.sha256) {
        addError(errors, 'binding-review-hash-mismatch', `${admissionReviewPath}.assetSha256`, 'Admission review hash differs from capture hash.');
      }
      const admissionReviewedAt = parsedTime(binding.admissionReview.reviewedAt, `${admissionReviewPath}.reviewedAt`, errors);
      if (admissionReviewedAt !== null && captureTime !== null && admissionReviewedAt < captureTime) {
        addError(errors, 'evidence-review-before-capture', `${admissionReviewPath}.reviewedAt`, 'Admission review predates the capture.');
      }
      if (runUpdated !== null && admissionReviewedAt !== null && admissionReviewedAt > runUpdated) {
        addError(errors, 'evidence-review-after-report-update', `${admissionReviewPath}.reviewedAt`, 'Admission review is newer than run.updatedAt.');
      }
      if (admissionReviewedAt !== null && evidenceReviewedAt !== null && admissionReviewedAt > evidenceReviewedAt) {
        addError(errors, 'admission-review-after-current-review', admissionReviewPath, 'Admission review cannot be newer than the current binding review.');
      }
      if (binding.admissionReview.verdict !== 'supports' || !allBooleanChecksPass(binding.admissionReview.checks)) {
        addError(errors, 'invalid-admission-review', admissionReviewPath, 'Admission review must support the original issue evidence with every check passing.');
      }
    }
    if (!ROLE_INTENDED_USE[binding.role]?.has(capture.intendedUse)) {
      addError(errors, 'binding-capture-purpose-mismatch', bindingPath, `${binding.role} cannot use a capture intended for ${capture.intendedUse}.`);
    }
    for (const [boxIndex, box] of binding.annotation.boxes.entries()) {
      if (box.x + box.width > 100 || box.y + box.height > 100) {
        addError(errors, 'annotation-out-of-bounds', `${bindingPath}.annotation.boxes[${boxIndex}]`, 'Annotation extends beyond the image.');
      }
    }
    const owner = binding.ownerType === 'finding'
      ? findingMap.get(binding.ownerId)
      : binding.ownerType === 'coverage'
        ? coverageMap.get(binding.ownerId)
        : observationMap.get(binding.ownerId);
    if (!owner) {
      addError(errors, 'unknown-binding-owner', `${bindingPath}.ownerId`, `${binding.ownerType} ${binding.ownerId} does not exist.`);
    } else {
      if (!owner.evidenceBindingIds.includes(binding.id)) addError(errors, 'owner-missing-binding', bindingPath, `${owner.id} does not list ${binding.id}.`);
      if (!productStateUrlMatches(owner.url, capture.url, captureNavigationUrl(capture))) {
        addError(errors, 'binding-product-url-mismatch', bindingPath, `${binding.id} capture does not match ${owner.id}'s product URL and hash route.`);
      }
      const acceptanceChecksUsingBinding = binding.ownerType === 'finding'
        ? owner.acceptanceChecks.filter((check) => check.evidenceBindingIds.includes(binding.id))
        : [];
      const crossLocaleAcceptanceEvidence = binding.role === 'regression-check'
        && acceptanceChecksUsingBinding.length > 0
        && acceptanceChecksUsingBinding.every((check) => check.kind === 'cross-locale');
      if (!crossLocaleAcceptanceEvidence && owner.targetId !== capture.targetId) {
        addError(errors, 'binding-target-mismatch', bindingPath, `${binding.id} capture target differs from ${owner.id}.`);
      }
      if (!crossLocaleAcceptanceEvidence && owner.stateKey !== capture.stateSnapshot.key) {
        addError(errors, 'binding-state-mismatch', bindingPath, `${binding.id} capture state differs from ${owner.id}.`);
      }
      if (binding.role === 'failed-verification'
        && binding.ownerType === 'finding'
        && capture.deploymentId !== owner.verification.deploymentId) {
        addError(errors, 'failed-evidence-deployment-mismatch', bindingPath, `${binding.id} is not tied to ${owner.id}'s attempted verification deployment.`);
      }
    }
    if (FINDING_ISSUE_ROLES.has(binding.role)) {
      const deployment = capture.deploymentId ? deploymentMap.get(capture.deploymentId) : null;
      if (!deployment || deployment.stage !== 'baseline' || deployment.status !== 'published'
        || deployment.buildCommit !== report.run.baselineCommit) {
        addError(errors, 'issue-evidence-not-baseline', bindingPath, 'Finding issue evidence must come from the published baseline deployment.');
      }
    }
    if (['verification-context', 'verification-detail', 'regression-check'].includes(binding.role)) {
      const deployment = capture.deploymentId ? deploymentMap.get(capture.deploymentId) : null;
      if (!deployment || deployment.stage !== 'fix' || deployment.status !== 'published'
        || deployment.buildCommit !== report.run.finalCommit) {
        addError(errors, 'final-evidence-not-current-release', bindingPath, 'Final and regression evidence must come from the current final deployment.');
      }
    }
    const roleValid = binding.ownerType === 'coverage'
      ? binding.role === 'coverage'
      : binding.ownerType === 'observation'
        ? ['blocker', 'non-i18n'].includes(binding.role)
        : FINDING_ISSUE_ROLES.has(binding.role) || FINDING_VERIFICATION_ROLES.has(binding.role);
    if (!roleValid) addError(errors, 'binding-role-owner-mismatch', `${bindingPath}.role`, `${binding.role} is not valid for ${binding.ownerType}.`);
  }

  for (const [index, finding] of report.findings.entries()) {
    const findingPath = `$.findings[${index}]`;
    if (!/^I18N-\d+$/.test(finding.id)) addError(errors, 'finding-id-format', `${findingPath}.id`, 'Finding IDs must use I18N-nnn format.');
    if (!targetMap.has(finding.targetId)) addError(errors, 'unknown-target', `${findingPath}.targetId`, `${finding.targetId} does not exist.`);
    if (finding.sourceAttribution.origin === 'api-user-created-data') {
      addError(errors, 'user-data-as-finding', `${findingPath}.sourceAttribution.origin`, 'User-created API data must be a non-i18n observation, not an i18n finding.');
    }
    if (finding.sourceAttribution.userCreatedDataAssessment === 'likely') {
      addError(errors, 'likely-user-data-as-finding', `${findingPath}.sourceAttribution.userCreatedDataAssessment`, 'Likely user-created data must be a non-i18n observation, not an i18n finding.');
    }
    if (['frontend-source', 'frontend-locale-data', 'frontend-locale-fallback'].includes(finding.sourceAttribution.origin)
      && !finding.sourceAttribution.matches.length) {
      addError(errors, 'frontend-attribution-without-source-match', `${findingPath}.sourceAttribution.matches`, 'Frontend attribution requires at least one concrete source match.');
    }
    if (finding.sourceAttribution.origin === 'unknown' && finding.remediation.disposition !== 'needs-human-confirmation') {
      addError(errors, 'unknown-origin-without-human-confirmation', findingPath, 'Unknown source ownership must remain needs-human-confirmation.');
    }
    if (['api-system-copy', 'external-module'].includes(finding.sourceAttribution.origin)
      && finding.remediation.disposition === 'fixed-locally') {
      addError(errors, 'external-origin-fixed-locally', findingPath, 'Backend or external-module copy cannot be represented as a local frontend fix; attribute the actual frontend display mapping or keep the owner external.');
    }
    verifyOwnerBindings(finding, 'finding', bindingMap, errors, findingPath);
    const ownedBindings = finding.evidenceBindingIds.map((id) => bindingMap.get(id)).filter(Boolean);
    const issueDetails = ownedBindings.filter((binding) => binding.role === 'issue-detail' && binding.review.verdict === 'supports');
    if (!issueDetails.length) addError(errors, 'finding-without-supported-issue', findingPath, 'Finding requires a supported issue-detail binding.');
    for (const issueBinding of issueDetails) {
      const capture = captureMap.get(issueBinding.captureId);
      if (capture?.captureKind === 'element-clip' && !ownedBindings.some((binding) => binding.role === 'issue-context' && binding.review.verdict === 'supports')) {
        addError(errors, 'clipped-issue-without-context', findingPath, 'Clipped issue evidence requires a supported issue-context binding.');
      }
    }
    const admittedEvents = finding.lifecycleEvents.filter((event) => event.type === 'finding-admitted');
    if (admittedEvents.length > 1) {
      addError(errors, 'duplicate-finding-admission', `${findingPath}.lifecycleEvents`, 'Finding must have exactly one finding-admitted event.');
    }
    const admittedAt = admittedEvents.length
      ? parsedTime(admittedEvents[0].at, `${findingPath}.lifecycleEvents.finding-admitted.at`, errors)
      : null;
    if (admittedAt !== null) {
      for (const issueBinding of issueDetails) {
        const admissionReview = issueBinding.admissionReview || issueBinding.review;
        const reviewAt = parsedTime(admissionReview.reviewedAt, `$.evidenceBindings.${issueBinding.id}.${issueBinding.admissionReview ? 'admissionReview' : 'review'}.reviewedAt`, errors);
        const capture = captureMap.get(issueBinding.captureId);
        const pixelAdmissionAt = capture?.admission.reviewedAt
          ? parsedTime(capture.admission.reviewedAt, `$.captures.${capture.id}.admission.reviewedAt`, errors)
          : null;
        if (reviewAt !== null && admittedAt < reviewAt) {
          addError(errors, 'finding-admitted-before-evidence-review', `${findingPath}.lifecycleEvents`, `Finding was admitted before independent review of ${issueBinding.id}.`);
        }
        if (pixelAdmissionAt !== null && admittedAt < pixelAdmissionAt) {
          addError(errors, 'finding-admitted-before-capture-admission', `${findingPath}.lifecycleEvents`, `Finding was admitted before pixel admission of ${capture.id}.`);
        }
      }
    }
    const acceptanceIds = verifyAcceptanceChecks(finding, bindingMap, captureMap, validationMap, errors, findingPath);
    for (const validationId of finding.remediation.validationIds) {
      const validation = validationMap.get(validationId);
      if (!validation) {
        addError(errors, 'unknown-validation', `${findingPath}.remediation.validationIds`, `${validationId} does not exist.`);
      } else if (finding.verification.result === 'passed' && validation.result !== 'passed') {
        addError(errors, 'verified-finding-failed-validation', `${findingPath}.remediation.validationIds`, `${validationId} is not passing.`);
      }
    }
    const assessment = finding.remediation.fixAssessment;
    if (assessment) {
      for (const regressionId of assessment.regressionCheckIds) {
        if (!acceptanceIds.has(regressionId) && !validationMap.has(regressionId)) {
          addError(errors, 'unknown-regression-check', `${findingPath}.remediation.fixAssessment.regressionCheckIds`, `${regressionId} is neither an acceptance check nor validation.`);
        }
      }
      if (finding.remediation.commit && finding.remediation.commit.hash !== assessment.fixCommit) {
        addError(errors, 'fix-commit-mismatch', findingPath, 'Remediation commit differs from fix assessment commit.');
      }
      verifyFindingRisk(
        finding,
        report.reviews.codeRisk,
        report.run.primaryInspectorId,
        errors,
        findingPath,
        finding.verification.result === 'passed' || REVIEWABLE_RUN_STATUSES.has(report.run.status),
      );
    }
    lifecycleOrder(finding, errors, findingPath);
    checkLifecycleRequirements(finding, errors, findingPath);
    for (const [eventIndex, event] of finding.lifecycleEvents.entries()) {
      const eventAt = parsedTime(event.at, `${findingPath}.lifecycleEvents[${eventIndex}].at`, errors);
      if (runUpdated !== null && eventAt !== null && eventAt > runUpdated) {
        addError(errors, 'lifecycle-after-report-update', `${findingPath}.lifecycleEvents[${eventIndex}]`, 'Lifecycle event is newer than run.updatedAt.');
      }
    }
    if (finding.remediation.commit) {
      const pushedAt = parsedTime(finding.remediation.commit.pushedAt, `${findingPath}.remediation.commit.pushedAt`, errors);
      if (runUpdated !== null && pushedAt !== null && pushedAt > runUpdated) {
        addError(errors, 'commit-after-report-update', `${findingPath}.remediation.commit.pushedAt`, 'Commit push time is newer than run.updatedAt.');
      }
      if (!finding.lifecycleEvents.some((event) => event.type === 'committed' && event.commit === finding.remediation.commit.hash)) {
        addError(errors, 'commit-lifecycle-mismatch', findingPath, 'Committed lifecycle event must reference remediation.commit.hash.');
      }
    }

    if (finding.verification.result === 'passed') {
      if (finding.remediation.disposition !== 'fixed-locally' || !assessment || !finding.remediation.commit) {
        addError(errors, 'verified-without-fix-evidence', findingPath, 'Passed verification requires fixed-locally disposition, fix assessment, and commit.');
      }
      if (finding.acceptanceChecks.some((check) => !['passed', 'not-applicable'].includes(check.status))) {
        addError(errors, 'verified-with-incomplete-acceptance', findingPath, 'All acceptance checks must pass or be explicitly not applicable.');
      }
      if (!finding.acceptanceChecks.some((check) => check.kind === 'visual' && check.status === 'passed')) {
        addError(errors, 'verified-without-visual-acceptance', findingPath, 'Passed verification requires a passing visual acceptance check.');
      }
      if (!finding.acceptanceChecks.some((check) => check.kind === 'code' && check.status === 'passed')) {
        addError(errors, 'verified-without-code-acceptance', findingPath, 'Passed verification requires a passing code acceptance check.');
      }
      if (!finding.acceptanceChecks.some((check) => check.kind === 'release' && check.status === 'passed')) {
        addError(errors, 'verified-without-release-acceptance', findingPath, 'Passed verification requires a passing release-provenance acceptance check.');
      }
      const deployment = deploymentMap.get(finding.verification.deploymentId);
      if (!deployment || deployment.status !== 'published' || deployment.stage !== 'fix') {
        addError(errors, 'verified-without-fix-deployment', findingPath, 'Passed verification requires a published fix deployment.');
      } else if (!report.run.finalCommit || deployment.buildCommit !== report.run.finalCommit) {
        addError(errors, 'verification-deployment-commit', findingPath, 'Verification deployment build commit differs from run.finalCommit.');
      }
      if (!finding.verification.verifiedAtCommit) {
        addError(errors, 'verification-commit-required', `${findingPath}.verification.verifiedAtCommit`, 'Passed verification requires verifiedAtCommit.');
      } else if (finding.verification.verifiedAtCommit !== report.run.finalCommit
        || finding.verification.verifiedAtCommit !== deployment?.buildCommit) {
        addError(errors, 'verification-commit-mismatch', `${findingPath}.verification.verifiedAtCommit`, 'verifiedAtCommit must match the current run finalCommit and verification deployment build.');
      }
      const verificationDetails = ownedBindings.filter((binding) => binding.role === 'verification-detail' && binding.review.verdict === 'supports');
      if (!verificationDetails.length) addError(errors, 'verified-without-supported-after', findingPath, 'Passed verification requires a supported verification-detail binding.');
      const visualRegressionBindings = ownedBindings.filter((binding) => binding.role === 'regression-check' && binding.review.verdict === 'supports');
      if (LAYOUT_FINDING_CATEGORIES.has(finding.category) && !visualRegressionBindings.length) {
        addError(errors, 'layout-fix-without-visual-regression', findingPath, 'Layout-sensitive fixes require a separate supported regression-check claim for neighboring UI or visible capacity.');
      }
      const passedVisualBindingIds = new Set(finding.acceptanceChecks
        .filter((check) => ['visual', 'cross-locale'].includes(check.kind) && check.status === 'passed')
        .flatMap((check) => check.evidenceBindingIds));
      if (LAYOUT_FINDING_CATEGORIES.has(finding.category)
        && !visualRegressionBindings.some((binding) => passedVisualBindingIds.has(binding.id))) {
        addError(errors, 'visual-regression-not-in-acceptance', findingPath, 'A passing visual acceptance check must explicitly reference the regression-check evidence.');
      }
      for (const regressionBinding of visualRegressionBindings.filter((binding) => passedVisualBindingIds.has(binding.id))) {
        const regressionCapture = captureMap.get(regressionBinding.captureId);
        if (regressionCapture?.deploymentId !== finding.verification.deploymentId) {
          addError(errors, 'regression-deployment-mismatch', findingPath, `${regressionBinding.id} is not tied to the final verification deployment.`);
        }
      }
      const verifiedAt = finding.verification.verifiedAt
        ? parsedTime(finding.verification.verifiedAt, `${findingPath}.verification.verifiedAt`, errors)
        : null;
      if (!finding.verification.verifiedAt) {
        addError(errors, 'verification-time-required', `${findingPath}.verification.verifiedAt`, 'Passed verification requires verifiedAt.');
      }
      const deploymentPublishedAt = deployment
        ? parsedTime(deployment.publishedAt, `$.deployments.${deployment.id}.publishedAt`, errors)
        : null;
      const pushedAt = finding.remediation.commit
        ? parsedTime(finding.remediation.commit.pushedAt, `${findingPath}.remediation.commit.pushedAt`, errors)
        : null;
      if (pushedAt !== null && deploymentPublishedAt !== null && deploymentPublishedAt < pushedAt) {
        addError(errors, 'deployment-before-fix-push', findingPath, 'Fix deployment predates the pushed fix commit.');
      }
      if (verifiedAt !== null && deploymentPublishedAt !== null && verifiedAt < deploymentPublishedAt) {
        addError(errors, 'verification-before-deployment', findingPath, 'Verification time predates the fix deployment.');
      }
      if (runUpdated !== null && verifiedAt !== null && verifiedAt > runUpdated) {
        addError(errors, 'verification-after-report-update', findingPath, 'Verification time is newer than run.updatedAt.');
      }
      if (!finding.lifecycleEvents.some((event) => event.type === 'published' && event.deploymentId === finding.verification.deploymentId)) {
        addError(errors, 'publish-lifecycle-mismatch', findingPath, 'Published lifecycle event must reference verification.deploymentId.');
      }
      if (!finding.lifecycleEvents.some((event) => event.type === 'verified' && event.deploymentId === finding.verification.deploymentId)) {
        addError(errors, 'verification-lifecycle-mismatch', findingPath, 'Verified lifecycle event must reference verification.deploymentId.');
      }
      for (const afterBinding of verificationDetails) {
        const afterCapture = captureMap.get(afterBinding.captureId);
        if (afterCapture?.deploymentId !== finding.verification.deploymentId) {
          addError(errors, 'after-deployment-mismatch', findingPath, `${afterBinding.id} is not tied to the verification deployment.`);
        }
        if (afterCapture?.captureKind === 'element-clip' && !ownedBindings.some((binding) => binding.role === 'verification-context' && binding.review.verdict === 'supports')) {
          addError(errors, 'clipped-after-without-context', findingPath, 'Clipped final evidence requires a supported verification-context binding.');
        }
        const afterCapturedAt = afterCapture
          ? parsedTime(afterCapture.capturedAt, `$.captures.${afterCapture.id}.capturedAt`, errors)
          : null;
        if (verifiedAt !== null && afterCapturedAt !== null && verifiedAt < afterCapturedAt) {
          addError(errors, 'verification-before-final-capture', findingPath, `Verification time predates final evidence ${afterBinding.id}.`);
        }
        for (const issueBinding of issueDetails) {
          const beforeCapture = captureMap.get(issueBinding.captureId);
          if (beforeCapture && afterCapture && (
            !sameStateSnapshot(beforeCapture.stateSnapshot, afterCapture.stateSnapshot)
            || beforeCapture.locale !== afterCapture.locale
            || !sameViewport(beforeCapture.viewport, afterCapture.viewport)
          )) {
            addError(errors, 'before-after-not-comparable', findingPath, `${issueBinding.id} and ${afterBinding.id} do not share the full state snapshot, locale, and viewport.`);
          }
        }
      }
    }
    if (finding.verification.result === 'failed') {
      const failedBindings = ownedBindings.filter((binding) => (
        binding.role === 'failed-verification' && binding.review.verdict === 'supports'
      ));
      if (!failedBindings.length) {
        addError(errors, 'failed-without-evidence', findingPath, 'Failed verification requires a supported failed-verification binding.');
      }
      if (!finding.verification.deploymentId || !deploymentMap.has(finding.verification.deploymentId)) {
        addError(errors, 'failed-without-deployment', findingPath, 'Failed verification requires the attempted deployment.');
      }
      const failedDeployment = deploymentMap.get(finding.verification.deploymentId);
      if (!finding.verification.verifiedAtCommit
        || finding.verification.verifiedAtCommit !== failedDeployment?.buildCommit) {
        addError(errors, 'verification-commit-mismatch', `${findingPath}.verification.verifiedAtCommit`, 'Failed verification must record the attempted deployment build commit.');
      }
      if (!finding.verification.verifiedAt) {
        addError(errors, 'verification-time-required', `${findingPath}.verification.verifiedAt`, 'Failed verification requires verifiedAt.');
      } else {
        const failedAt = parsedTime(finding.verification.verifiedAt, `${findingPath}.verification.verifiedAt`, errors);
        const failedPublishedAt = failedDeployment
          ? parsedTime(failedDeployment.publishedAt, `$.deployments.${failedDeployment.id}.publishedAt`, errors)
          : null;
        if (failedAt !== null && failedPublishedAt !== null && failedAt < failedPublishedAt) {
          addError(errors, 'verification-before-deployment', findingPath, 'Failed verification time predates the attempted deployment.');
        }
        if (runUpdated !== null && failedAt !== null && failedAt > runUpdated) {
          addError(errors, 'verification-after-report-update', findingPath, 'Failed verification time is newer than run.updatedAt.');
        }
      }
      if (!finding.lifecycleEvents.some((event) => event.type === 'verification-failed' && event.deploymentId === finding.verification.deploymentId)) {
        addError(errors, 'verification-lifecycle-mismatch', findingPath, 'verification-failed lifecycle event must reference verification.deploymentId.');
      }
    }
  }

  for (const [index, observation] of report.observations.entries()) {
    const observationPath = `$.observations[${index}]`;
    if (!targetMap.has(observation.targetId)) addError(errors, 'unknown-target', `${observationPath}.targetId`, `${observation.targetId} does not exist.`);
    verifyOwnerBindings(observation, 'observation', bindingMap, errors, observationPath);
    const expectedRole = observation.kind === 'blocker' ? 'blocker' : 'non-i18n';
    if (!observation.evidenceBindingIds.some((id) => {
      const binding = bindingMap.get(id);
      return binding?.role === expectedRole && binding.review.verdict === 'supports';
    })) {
      addError(errors, 'observation-without-evidence', observationPath, `${observation.kind} observation requires a supported ${expectedRole} binding.`);
    }
  }

  const summary = deriveReportSummary(report);
  if (REVIEWABLE_RUN_STATUSES.has(report.run.status)
    && report.coverage.some((item) => COVERAGE_ACTIVE_STATUSES.has(item.status))) {
    addError(errors, 'reviewable-run-with-active-coverage', '$.run.status', 'A reviewable report cannot leave coverage pending or in progress.');
  }
  if (report.run.status === REVIEW_READY_STATUS
    && report.coverage.some((item) => COVERAGE_INCOMPLETE_STATUSES.has(item.status))) {
    addError(errors, 'complete-candidate-with-incomplete-coverage', '$.run.status', 'A complete candidate contains partial, blocked, or not-reached coverage. Use partial or blocked status instead.');
  }
  if (report.run.status === REVIEW_READY_STATUS
    && !report.coverage.some((item) => !item.parentId && item.status === 'covered')) {
    addError(errors, 'complete-candidate-without-covered-root', '$.coverage', 'A complete candidate requires at least one covered root with evidence.');
  }
  if (report.run.status === 'partial'
    && !report.coverage.some((item) => ['partial', 'not-reached'].includes(item.status))) {
    addError(errors, 'partial-run-without-partial-coverage', '$.run.status', 'A partial run must identify partial or not-reached coverage.');
  }
  if (report.run.status === 'blocked'
    && !report.coverage.some((item) => item.status === 'blocked')
    && !report.observations.some((item) => item.kind === 'blocker')) {
    addError(errors, 'blocked-run-without-blocker', '$.run.status', 'A blocked run must identify blocked coverage or a blocker observation.');
  }

  const finalReview = report.reviews.finalReport;
  if (finalReview) {
    if (!REVIEWABLE_RUN_STATUSES.has(report.run.status)) {
      addError(errors, 'final-review-on-active-run', '$.run.status', 'Final report review requires complete-candidate, partial, or blocked run status.');
    }
    if (finalReview.reviewerId === report.run.primaryInspectorId) {
      addError(errors, 'non-independent-final-review', '$.reviews.finalReport.reviewerId', 'The primary inspector cannot perform the final human-readable report review.');
    }
    const priorReviewerIds = new Set([
      ...report.evidenceBindings.flatMap((item) => [item.review.reviewerId, item.admissionReview?.reviewerId].filter(Boolean)),
      ...report.reviews.codeRisk.map((item) => item.reviewerId),
    ]);
    if (priorReviewerIds.has(finalReview.reviewerId)) {
      addError(errors, 'non-isolated-final-review', '$.reviews.finalReport.reviewerId', 'The final report reviewer must be fresh and distinct from evidence and code-risk reviewers.');
    }
    const priorReviewSessionIds = new Set([
      ...report.evidenceBindings.flatMap((item) => [item.review.reviewSessionId, item.admissionReview?.reviewSessionId].filter(Boolean)),
      ...report.reviews.codeRisk.map((item) => item.reviewSessionId),
    ]);
    if (priorReviewSessionIds.has(finalReview.reviewSessionId)) {
      addError(errors, 'non-isolated-final-review-session', '$.reviews.finalReport.reviewSessionId', 'The final report review must use a fresh review session distinct from evidence and code-risk review sessions.');
    }
    const finalReviewedAt = parsedTime(finalReview.reviewedAt, '$.reviews.finalReport.reviewedAt', errors);
    if (runUpdated !== null && finalReviewedAt !== null && finalReviewedAt < runUpdated) {
      addError(errors, 'final-review-before-report-update', '$.reviews.finalReport.reviewedAt', 'Final report review predates run.updatedAt.');
    }
    if (finalReview.reportRevision !== report.revision) addError(errors, 'stale-final-review', '$.reviews.finalReport.reportRevision', 'Final review revision differs from the report revision.');
    const contentDigest = computeReviewableContentSha256(report);
    if (finalReview.contentSha256 !== contentDigest) addError(errors, 'stale-final-review', '$.reviews.finalReport.contentSha256', `Final review digest must be ${contentDigest}.`);
    if (finalReview.verdict === 'approved' && (!finalReview.coverageAssessable || !finalReview.artifactUsable)) {
      addError(errors, 'approved-report-not-usable', '$.reviews.finalReport', 'Approved final review requires coverageAssessable and artifactUsable to both be true.');
    }
    if (finalReview.verdict === 'approved'
      && !report.validations.some((item) => item.scope === 'report' && item.result === 'passed')) {
      addError(errors, 'approved-report-without-validation', '$.validations', 'Approved final review requires a passing report validation with hashed execution output.');
    }
    const reviewedFindingIds = new Set(finalReview.findingReviews.map((item) => item.findingId));
    if (reviewedFindingIds.size !== finalReview.findingReviews.length) {
      addError(errors, 'duplicate-finding-review', '$.reviews.finalReport.findingReviews', 'Final finding reviews must be unique by findingId.');
    }
    for (const finding of report.findings) {
      const review = finalReview.findingReviews.find((item) => item.findingId === finding.id);
      if (!review) {
        addError(errors, 'missing-finding-review', '$.reviews.finalReport.findingReviews', `${finding.id} has no final human-view review.`);
      } else if (finalReview.verdict === 'approved' && (review.verdict !== 'approved' || !review.understandable || !review.riskAssessable)) {
        addError(errors, 'finding-review-not-approved', '$.reviews.finalReport.findingReviews', `${finding.id} is not understandable, risk-assessable, and approved.`);
      }
    }
    for (const findingId of reviewedFindingIds) {
      if (!findingMap.has(findingId)) addError(errors, 'review-of-unknown-finding', '$.reviews.finalReport.findingReviews', `${findingId} does not exist.`);
    }
  }

  if (options.verifyAssets !== false && options.reportPath) {
    await verifySupportingArtifacts(report, path.resolve(options.reportPath), errors);
    await verifyCaptureAssets(report, path.resolve(options.reportPath), errors);
  }
  if (options.repositoryPath) {
    await verifyRepositoryEvidence(report, path.resolve(options.repositoryPath), errors);
  }

  return {
    errors,
    warnings,
    derived: {
      summary,
      reportStatus: deriveReportStatus(report),
      reviewableContentSha256: computeReviewableContentSha256(report),
    },
  };
}

export class UiInspectionReportValidationError extends Error {
  /** Creates an error that describes report validation failures. */
  constructor(result) {
    super(result.errors.map((item) => `${item.code} ${item.path}: ${item.message}`).join('\n'));
    this.name = 'UiInspectionReportValidationError';
    this.result = result;
  }
}

/** Throws a validation error when a UI inspection report is invalid. */
export async function assertValidUiInspectionReport(report, options = {}) {
  const result = await validateUiInspectionReport(report, options);
  if (result.errors.length) throw new UiInspectionReportValidationError(result);
  return result;
}
