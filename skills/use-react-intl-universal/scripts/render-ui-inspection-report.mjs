#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VALID_CAPTURE_REJECTION_REASONS = new Set([
  'wrong-state',
  'wrong-locale',
  'not-ready',
  'loading-state',
  'foreign-overlay',
  'capture-corruption',
  'target-not-visible',
  'insufficient-context',
  'not-pixel-reviewed',
]);
const VALID_VALIDATION_RESULTS = new Set(['passed', 'failed', 'failed-pre-existing', 'not-run']);
const FRONTEND_SOURCE_ORIGINS = new Set(['frontend-source', 'frontend-locale-data', 'frontend-locale-fallback']);

function parseArgs(argv) {
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

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function code(value = '') {
  return `<code>${escapeHtml(value)}</code>`;
}

function tone(value, kind = 'status') {
  if (kind === 'severity' || kind === 'risk') {
    if (value === 'critical' || value === 'high') return 'danger';
    if (value === 'medium') return 'warning';
    return 'success';
  }
  if (kind === 'verification') {
    if (value === 'high') return 'success';
    if (value === 'medium') return 'warning';
    return 'danger';
  }
  if (['verifiedFixed', 'verified', 'covered', 'nonI18n'].includes(value)) return 'success';
  if (['open', 'verificationFailed', 'blocked'].includes(value)) return 'danger';
  if (['publishedToPreview', 'needsHumanConfirmation', 'partial'].includes(value)) return 'warning';
  return 'secondary';
}

function badge(value, prefix = '', kind = 'status') {
  return `<span class="badge badge-pill badge-${tone(value, kind)}">${escapeHtml(prefix + value)}</span>`;
}

function formatTime(value) {
  if (!value) return 'not recorded';
  return escapeHtml(value.replace('T', ' ').replace(/\+08:00$/, ' CST'));
}

function sentenceList(values = []) {
  return values.length ? values.map(escapeHtml).join('; ') : 'None recorded.';
}

function countBy(items, key) {
  return items.reduce((result, item) => {
    const value = item[key];
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function sameCountMap(actual = {}, expected = {}) {
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  return [...keys].every((key) => actual[key] === expected[key]);
}

function assertUnique(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (!item.id) throw new Error(`${label} contains an item without an id.`);
    if (seen.has(item.id)) throw new Error(`${label} contains duplicate id ${item.id}.`);
    seen.add(item.id);
  }
}

async function validateReport(report, reportPath) {
  const manifests = report.screenshotManifest || [];
  const findings = report.findings || [];
  const coverage = report.coverageEvidence || [];
  const captureLedger = report.captureLedger || [];
  assertUnique(manifests, 'screenshotManifest');
  assertUnique(findings, 'findings');
  assertUnique(coverage, 'coverageEvidence');
  if (report.schemaVersion === '2.1') assertUnique(captureLedger, 'captureLedger');

  if (report.schemaVersion === '2.1') {
    const pending = captureLedger.filter((item) => item.state === 'pendingPixelReview');
    if (pending.length && report.inspectionStatus !== 'partial') {
      throw new Error(`Completed report contains pending pixel review candidates: ${pending.map((item) => item.id).join(', ')}.`);
    }
    for (const candidate of captureLedger) {
      for (const field of ['screenshotRef', 'capturedAt', 'locale', 'page', 'url', 'action', 'intendedUse', 'state', 'notes']) {
        if (!candidate[field]) throw new Error(`captureLedger item ${candidate.id} is missing ${field}.`);
      }
      if (!Array.isArray(candidate.rejectionReasons)) {
        throw new Error(`captureLedger item ${candidate.id} is missing rejectionReasons.`);
      }
      if (path.isAbsolute(candidate.screenshotRef)) {
        throw new Error(`captureLedger item ${candidate.id} must use a report-relative screenshotRef.`);
      }
      const invalidReasons = candidate.rejectionReasons.filter((reason) => !VALID_CAPTURE_REJECTION_REASONS.has(reason));
      if (invalidReasons.length) {
        throw new Error(`captureLedger item ${candidate.id} has invalid rejection reasons: ${invalidReasons.join(', ')}.`);
      }
      if (candidate.state === 'rejected' && !candidate.rejectionReasons.length) {
        throw new Error(`Rejected capture ${candidate.id} has no rejection reason.`);
      }
      if (candidate.state === 'admitted' && (candidate.rejectionReasons.length || !candidate.admittedScreenshotId)) {
        throw new Error(`Admitted capture ${candidate.id} has an invalid admission record.`);
      }
      if (candidate.state !== 'admitted' && candidate.admittedScreenshotId) {
        throw new Error(`Non-admitted capture ${candidate.id} points to screenshotManifest.`);
      }
      await fs.access(path.resolve(path.dirname(reportPath), candidate.screenshotRef));
    }
  }

  for (const [index, item] of (report.validationEvidence || []).entries()) {
    if (typeof item.command !== 'string' || !item.command.trim()) {
      throw new Error(`validationEvidence item ${index + 1} is missing command.`);
    }
    if (!VALID_VALIDATION_RESULTS.has(item.result)) {
      throw new Error(`validationEvidence item ${index + 1} has invalid result ${item.result}.`);
    }
  }

  const manifestById = new Map(manifests.map((item) => [item.id, item]));
  const rejectedPaths = new Set(captureLedger.filter((item) => item.state === 'rejected').map((item) => item.screenshotRef));
  const admittedCandidates = captureLedger.filter((item) => item.state === 'admitted' && item.admittedScreenshotId);
  const admittedByScreenshotId = new Map();
  for (const candidate of admittedCandidates) {
    if (admittedByScreenshotId.has(candidate.admittedScreenshotId)) {
      throw new Error(`Multiple captureLedger records admit screenshot ${candidate.admittedScreenshotId}.`);
    }
    admittedByScreenshotId.set(candidate.admittedScreenshotId, candidate);
  }
  for (const item of manifests) {
    if (path.isAbsolute(item.screenshotRef)) {
      throw new Error(`screenshotManifest item ${item.id} must use a report-relative screenshotRef.`);
    }
    if (rejectedPaths.has(item.screenshotRef)) throw new Error(`Rejected capture leaked into screenshotManifest: ${item.id}`);
    if (report.schemaVersion === '2.1' && !admittedByScreenshotId.has(item.id)) {
      throw new Error(`screenshotManifest item ${item.id} has no admitted captureLedger record.`);
    }
    if (report.schemaVersion === '2.1' && admittedByScreenshotId.get(item.id).screenshotRef !== item.screenshotRef) {
      throw new Error(`Admitted capture path does not match screenshotManifest item ${item.id}.`);
    }
    await fs.access(path.resolve(path.dirname(reportPath), item.screenshotRef));
  }

  const referencedCollections = [
    ...findings.map((item) => [item.id, [...(item.contextScreenshotRefs || []), ...(item.screenshotRefs || [])]]),
    ...(report.blockers || []).map((item) => [item.id, item.screenshotRefs || []]),
    ...(report.nonI18nObservations || []).map((item) => [item.id, item.screenshotRefs || []]),
    ...coverage.filter((item) => item.screenshotRef).map((item) => [item.id, [item.screenshotRef]]),
  ];
  for (const [owner, refs] of referencedCollections) {
    for (const ref of refs) {
      if (!manifestById.has(ref)) throw new Error(`${owner} references unknown screenshot ${ref}.`);
    }
  }

  for (const annotation of report.screenshotAnnotations || []) {
    if (!manifestById.has(annotation.screenshotRef)) throw new Error(`Annotation references unknown screenshot ${annotation.screenshotRef}.`);
    for (const box of annotation.boxes || []) {
      if ([box.x, box.y, box.width, box.height].some((value) => typeof value !== 'number' || value < 0 || value > 100)) {
        throw new Error(`Annotation for ${annotation.screenshotRef} has invalid percentage coordinates.`);
      }
      if (box.x + box.width > 100 || box.y + box.height > 100) {
        throw new Error(`Annotation for ${annotation.screenshotRef} extends beyond the image.`);
      }
    }
  }

  for (const finding of findings) {
    const annotationRefs = new Set((report.screenshotAnnotations || []).filter((item) => item.boxes?.length).map((item) => item.screenshotRef));
    for (const ref of [...(finding.contextScreenshotRefs || []), ...(finding.screenshotRefs || [])]) {
      if (!annotationRefs.has(ref)) throw new Error(`${finding.id} screenshot ${ref} has no visible annotation.`);
    }
    const failedVerificationRefs = finding.fixEvidence?.failedVerificationScreenshotRefs || [];
    for (const ref of failedVerificationRefs) {
      if (!(finding.screenshotRefs || []).includes(ref)) {
        throw new Error(`${finding.id} failed-verification screenshot ${ref} is not bound to the finding.`);
      }
      const screenshot = manifestById.get(ref);
      if (!screenshot || screenshot.status !== 'verificationFailed' || !screenshot.releaseCommit) {
        throw new Error(`${finding.id} failed-verification screenshot ${ref} is not admitted released failure evidence.`);
      }
    }
    if (finding.status !== 'verifiedFixed') continue;
    const verificationRefs = finding.fixEvidence?.verificationScreenshotRefs || [];
    if (!verificationRefs.length) throw new Error(`${finding.id} is verifiedFixed without verification screenshots.`);
    if (!report.finalReleaseCommit || finding.fixEvidence?.releaseCommit !== report.finalReleaseCommit) {
      throw new Error(`${finding.id} is verifiedFixed without the final release commit.`);
    }
    for (const ref of verificationRefs) {
      if (!(finding.screenshotRefs || []).includes(ref)) {
        throw new Error(`${finding.id} verification screenshot ${ref} is not bound to the finding.`);
      }
      const screenshot = manifestById.get(ref);
      if (!screenshot || screenshot.status !== 'verified' || screenshot.releaseCommit !== report.finalReleaseCommit) {
        throw new Error(`${finding.id} verification screenshot ${ref} is not admitted final-release evidence.`);
      }
    }
    const beforeRefs = (finding.screenshotRefs || []).filter((ref) => !verificationRefs.includes(ref));
    if (!beforeRefs.some((ref) => manifestById.get(ref)?.status === 'issueEvidence')) {
      throw new Error(`${finding.id} is verifiedFixed without admitted before issue evidence.`);
    }
    if (FRONTEND_SOURCE_ORIGINS.has(finding.sourceOrigin)) {
      if (!finding.fixEvidence?.changedFiles?.length) {
        throw new Error(`${finding.id} is verifiedFixed frontend work without changedFiles.`);
      }
      if (!finding.fixEvidence?.localValidation?.length) {
        throw new Error(`${finding.id} is verifiedFixed frontend work without localValidation.`);
      }
    }
  }

  const issueSummary = report.summary?.issues;
  const expectedIssueSummary = {
    found: findings.length,
    fixed: findings.filter((item) => item.status === 'verifiedFixed').length,
    needAttention: findings.filter((item) => item.status !== 'verifiedFixed').length,
    bySeverity: countBy(findings, 'severity'),
    byStatus: countBy(findings, 'status'),
  };
  if (
    issueSummary?.found !== expectedIssueSummary.found
    || issueSummary?.fixed !== expectedIssueSummary.fixed
    || issueSummary?.needAttention !== expectedIssueSummary.needAttention
    || !sameCountMap(issueSummary?.bySeverity, expectedIssueSummary.bySeverity)
    || !sameCountMap(issueSummary?.byStatus, expectedIssueSummary.byStatus)
  ) {
    throw new Error(`summary.issues does not match finding records. Expected ${JSON.stringify(expectedIssueSummary)}.`);
  }
  const expectedCoverage = { total: coverage.length, byStatus: countBy(coverage, 'status') };
  if (report.summary?.coverage?.total !== expectedCoverage.total || !sameCountMap(report.summary?.coverage?.byStatus, expectedCoverage.byStatus)) {
    throw new Error(`summary.coverage does not match coverage records. Expected ${JSON.stringify(expectedCoverage)}.`);
  }
}

function screenshotStage(item, annotation, title, context = 'evidence') {
  if (!item) return '<div class="alert alert-warning mb-0">Evidence record is missing.</div>';
  const stageId = `shot-${escapeHtml(item.id)}-${escapeHtml(context)}`;
  const boxes = (annotation?.boxes || [])
    .map(
      (box) =>
        `<span class="redbox" style="left:${box.x}%;top:${box.y}%;width:${box.width}%;height:${box.height}%"><em>${escapeHtml(box.label)}</em></span>`,
    )
    .join('');
  return `<div><h4 class="evidence-title">${escapeHtml(title)}</h4><figure class="annotated-shot"><div class="shot-scroll"><a class="annotated-stage with-image" id="${stageId}" href="#${stageId}" data-preview-stage="${stageId}"><img class="real-shot" src="${escapeHtml(item.screenshotRef)}" alt="${escapeHtml(item.page)} screenshot" />${boxes}</a></div><figcaption>${escapeHtml(item.notes)}<span class="shot-time">${formatTime(item.capturedAt)}</span></figcaption></figure></div>`;
}

function observationCard(observation, screenshotMap, annotationMap, labels) {
  const shots = observation.screenshotRefs
    .map((ref, index) => screenshotStage(screenshotMap.get(ref), annotationMap.get(ref), labels.evidence, `${observation.id}-${index}`))
    .join('');
  return `<article class="card observation-card" id="${escapeHtml(observation.id)}"><header class="observation-head"><h3>${escapeHtml(observation.id)} ${escapeHtml(observation.title)}</h3><div class="badge-row">${badge(observation.kind)}${observation.userCreatedDataAssessment ? badge(observation.userCreatedDataAssessment) : ''}</div></header><div class="observation-body">${shots}<div class="table-responsive table-wrap mt-3"><table class="table table-sm evidence-table"><tbody><tr><th>${labels.observation}</th><td>${escapeHtml(observation.observation)}</td></tr><tr><th>${labels.action}</th><td>${escapeHtml(observation.action)}</td></tr><tr><th>${labels.reason}</th><td>${escapeHtml(observation.outOfScopeReason || observation.runtimeEvidence || observation.notes || '')}</td></tr><tr><th>${labels.followUp}</th><td>${escapeHtml(observation.followUp || labels.none)}</td></tr></tbody></table></div></div></article>`;
}

function renderReport(report) {
  const zh = /^zh/i.test(report.reportDisplayLanguage || '');
  const labels = zh
    ? {
        title: '国际化巡检报告',
        found: '已发现问题',
        fixed: '已修复问题',
        attention: '需要人关注',
        overview: '问题总览',
        findings: '问题详情',
        nonI18n: '非 i18n 观察',
        appendix: '截图附录',
        copy: '复制 Finding 与反馈',
        feedback: '输入评审反馈',
        noneBlocker: '本轮无 Blocker。',
        noneNonI18n: '本轮无需要展示的非 i18n 观察。',
        evidence: '证据',
        context: '页面上下文 / 功能位置',
        before: '修复前 / 问题证据',
        failed: '失败复验',
        after: '修复后 / 最终 Preview',
        observation: '观察',
        action: '操作',
        reason: '判断理由',
        followUp: '后续动作',
        none: '无',
        fixRisk: '修复风险',
        status: '状态',
        verification: '验证',
        reviewer: 'Reviewer feedback',
        details: 'Finding 详情',
        state: '页面状态',
        owner: 'Owner',
        origin: '来源',
        actual: '实际表现',
        expected: '预期表现',
        release: '发布证据',
        noRelease: '没有已验证的发布证据。',
        reproduction: '复现步骤',
        attribution: '归因',
        recommendation: '修复建议',
        acceptance: '验收与校验',
        codeSummary: '代码变更摘要',
        noScreenshot: '此 Finding 未绑定准入截图。',
        scope: '页面/范围',
        urlState: 'URL/状态',
        notes: '备注',
        commit: '提交',
        releaseNote: '发布信息',
        appendixNote: '仅展示已准入截图；拒绝候选只保留在 capture ledger。',
      }
    : {
        title: 'Internationalization Inspection Report',
        found: 'Issues found',
        fixed: 'Issues fixed',
        attention: 'Need attention',
        overview: 'Overview',
        findings: 'Findings',
        nonI18n: 'Non-i18n observations',
        appendix: 'Screenshot appendix',
        copy: 'Copy findings and feedback',
        feedback: 'Enter reviewer feedback',
        noneBlocker: 'No blockers were recorded.',
        noneNonI18n: 'No non-i18n observations were recorded.',
        evidence: 'Evidence',
        context: 'Page context / feature location',
        before: 'Before / issue evidence',
        failed: 'Failed verification',
        after: 'After / final Preview',
        observation: 'Observation',
        action: 'Action',
        reason: 'Reason',
        followUp: 'Follow-up',
        none: 'None',
        fixRisk: 'Fix risk',
        status: 'Status',
        verification: 'Verification',
        reviewer: 'Reviewer feedback',
        details: 'Finding details',
        state: 'State',
        owner: 'Owner',
        origin: 'Origin',
        actual: 'Actual',
        expected: 'Expected',
        release: 'Release',
        noRelease: 'No verified release evidence.',
        reproduction: 'Reproduction',
        attribution: 'Attribution',
        recommendation: 'Recommendation',
        acceptance: 'Acceptance and validation',
        codeSummary: 'Code change summary',
        noScreenshot: 'No admitted screenshot is bound to this finding.',
        scope: 'Scope',
        urlState: 'URL/state',
        notes: 'Notes',
        commit: 'Commit',
        releaseNote: 'Release evidence',
        appendixNote: 'Only admitted screenshots are listed. Rejected candidates remain in the capture ledger.',
      };

  const screenshotMap = new Map(report.screenshotManifest.map((item) => [item.id, item]));
  const annotationMap = new Map(report.screenshotAnnotations.map((item) => [item.screenshotRef, item]));
  const release = report.releaseEvidence || {};
  const releaseLabel = [release.publishId, release.buildId, release.cdnVersion].filter(Boolean).join(' / ') || 'not recorded';
  const repoName = report.repository ? path.basename(report.repository) : 'UI';

  const overviewRows = report.findings
    .map(
      (finding) => `<tr><td><a href="#${escapeHtml(finding.id)}">${escapeHtml(finding.id)}</a></td><td class="overview-title"><a href="#${escapeHtml(finding.id)}" data-finding-modal="${escapeHtml(finding.id)}">${escapeHtml(finding.title)}</a><div class="risk-note">${escapeHtml(finding.ownershipRationale)}</div></td><td>${badge(finding.fixRisk, '', 'risk')}</td><td>${badge(finding.status)}</td><td>${badge(finding.fixVerification, '', 'verification')}</td><td class="feedback-cell"><textarea class="form-control" data-feedback-id="${escapeHtml(finding.id)}" placeholder="${labels.feedback}"></textarea></td></tr>`,
    )
    .join('');

  const findingCards = report.findings
    .map((finding) => {
      const verifiedRefs = new Set(finding.fixEvidence?.verificationScreenshotRefs || []);
      const failedRefs = new Set(finding.fixEvidence?.failedVerificationScreenshotRefs || []);
      const issueRefs = finding.screenshotRefs.filter((ref) => !verifiedRefs.has(ref) && !failedRefs.has(ref));
      const evidence = [
        ...(finding.contextScreenshotRefs || []).map((ref, index) => screenshotStage(screenshotMap.get(ref), annotationMap.get(ref), labels.context, `${finding.id}-context-${index}`)),
        ...issueRefs.map((ref, index) => screenshotStage(screenshotMap.get(ref), annotationMap.get(ref), labels.before, `${finding.id}-issue-${index}`)),
        ...[...failedRefs].map((ref, index) => screenshotStage(screenshotMap.get(ref), annotationMap.get(ref), labels.failed, `${finding.id}-failed-${index}`)),
        ...[...verifiedRefs].map((ref, index) => screenshotStage(screenshotMap.get(ref), annotationMap.get(ref), labels.after, `${finding.id}-verified-${index}`)),
      ];
      if (!evidence.length) evidence.push(`<div class="alert alert-warning mb-0">${labels.noScreenshot}</div>`);
      const changedFiles = finding.fixEvidence?.changedFiles || [];
      const changeSummary = changedFiles.length
        ? `<section class="fix-diff"><h4>${labels.codeSummary}</h4><div class="diff-file"><div class="diff-title"><strong>${changedFiles.map(code).join('<br />')}</strong><span>${escapeHtml(finding.fixEvidence?.notes || finding.fixRecommendation)}</span></div></div></section>`
        : '';
      const sourceMatches = finding.sourceSearch?.matches || [];
      const sourceText = sourceMatches.length
        ? sourceMatches.map((match) => `${code(match.filePath)}${match.line ? `:${match.line}` : ''} - ${escapeHtml(match.reason)}`).join('<br />')
        : escapeHtml(finding.sourceSearch?.notes || 'No local source match recorded.');
      return `<article class="card finding-card" id="${escapeHtml(finding.id)}"><header class="finding-head"><div><h3>${escapeHtml(finding.id)} ${escapeHtml(finding.title)}</h3><p class="text-muted">Category: ${escapeHtml(finding.category)}</p></div><div class="badge-row">${badge(finding.severity, 'severity: ', 'severity')}${badge(finding.status, 'status: ')}${badge(finding.fixRisk, 'risk: ', 'risk')}${badge(finding.fixVerification, 'verification: ', 'verification')}</div></header><dl class="finding-meta"><div><dt>${labels.state}</dt><dd>${code(finding.url)}<br />${escapeHtml(finding.state)}</dd></div><div><dt>${labels.owner}</dt><dd>${escapeHtml(finding.recommendedOwner)}</dd></div><div><dt>${labels.origin}</dt><dd>${escapeHtml(finding.sourceOrigin)}</dd></div><div><dt>${labels.actual}</dt><dd>${escapeHtml(finding.actual)}</dd></div><div><dt>${labels.expected}</dt><dd>${escapeHtml(finding.expected)}</dd></div><div><dt>${labels.release}</dt><dd>${finding.fixEvidence?.releaseCommit ? code(finding.fixEvidence.releaseCommit) : labels.noRelease}</dd></div></dl><div class="shot-grid"><div class="shot-grid-row">${evidence.join('')}</div></div>${changeSummary}<div class="finding-body"><section><h4>${labels.reproduction}</h4><p>${sentenceList(finding.reproductionSteps)}</p></section><section><h4>${labels.attribution}</h4><p>${escapeHtml(finding.ownershipRationale)}</p><p class="mt-2">${sourceText}</p></section><section><h4>${labels.recommendation}</h4><p>${escapeHtml(finding.fixRecommendation)}</p></section><section><h4>${labels.acceptance}</h4><p>${sentenceList(finding.acceptanceCriteria)}</p><p class="mt-2">${sentenceList(finding.fixEvidence?.localValidation || [])}</p></section></div></article>`;
    })
    .join('');

  const blockers = report.blockers.length
    ? `<div class="observation-grid">${report.blockers.map((item) => observationCard(item, screenshotMap, annotationMap, labels)).join('')}</div>`
    : `<div class="alert alert-success mb-0"><strong>${labels.noneBlocker}</strong></div>`;
  const nonI18n = report.nonI18nObservations.length
    ? `<div class="observation-grid single">${report.nonI18nObservations.map((item) => observationCard(item, screenshotMap, annotationMap, labels)).join('')}</div>`
    : `<div class="alert alert-light mb-0">${labels.noneNonI18n}</div>`;

  const appendixItems = report.screenshotManifest
    .map((item) => `<figure class="annotated-shot"><div class="shot-scroll"><a class="annotated-stage with-image" id="appendix-${escapeHtml(item.id)}" href="#appendix-${escapeHtml(item.id)}" data-preview-stage="appendix-${escapeHtml(item.id)}"><img class="real-shot" src="${escapeHtml(item.screenshotRef)}" alt="${escapeHtml(item.page)} screenshot" /></a></div><figcaption>${escapeHtml(path.basename(item.screenshotRef))}<span class="shot-time">${formatTime(item.capturedAt)}</span></figcaption><div class="appendix-meta"><dl><dt>${labels.scope}</dt><dd>${escapeHtml(item.page)}</dd><dt>${labels.urlState}</dt><dd>${code(item.url)}</dd><dt>${labels.action}</dt><dd>${escapeHtml(item.action)}</dd><dt>${labels.status}</dt><dd>${badge(item.status)}</dd><dt>${labels.notes}</dt><dd>${escapeHtml(item.notes)}</dd>${item.releaseCommit ? `<dt>${labels.commit}</dt><dd>${code(item.releaseCommit)}</dd>` : ''}</dl></div></figure>`)
    .join('');

  return `<header class="card hero-card"><div class="hero-grid"><div><div class="hero-kicker">Internationalization inspection</div><h1>${escapeHtml(repoName)} ${labels.title}</h1><p>${escapeHtml(report.reportSummary || `Inspection of ${repoName} in ${report.targets.map((target) => target.locale).join(', ')}. Only admitted evidence is shown.`)}</p></div><div class="report-meta-row" aria-label="Report metadata"><div><span>Target locale</span><strong>${escapeHtml(report.targets.map((target) => target.locale).join(', '))}</strong></div><div><span>Branch</span><strong>${escapeHtml(report.branch || 'not recorded')}</strong></div><div><span>Commit</span><strong>${report.finalReleaseCommit ? code(report.finalReleaseCommit.slice(0, 10)) : 'not recorded'}</strong></div><div><span>Onebox</span><strong>${escapeHtml(releaseLabel)}</strong></div><div><span>Report status</span><strong>${escapeHtml(report.inspectionStatus)}</strong></div></div><div class="metric-strip" aria-label="Inspection summary"><div class="metric-card" data-tone="danger"><span>${labels.found}</span><strong>${report.summary.issues.found}</strong><small>Confirmed and confirmation-required i18n findings</small></div><div class="metric-card" data-tone="success"><span>${labels.fixed}</span><strong>${report.summary.issues.fixed}</strong><small>Verified with final-release evidence</small></div><div class="metric-card" data-tone="warning"><span>${labels.attention}</span><strong>${report.summary.issues.needAttention}</strong><small>Unverified, open, or confirmation-required</small></div></div></div></header><div class="alert alert-light mt-3 mb-0" role="note"><strong>${labels.releaseNote}:</strong> ${release.previewUrl ? `<a href="${escapeHtml(release.previewUrl)}">Preview</a>` : 'Preview URL not recorded'} ${report.finalReleaseCommit ? `uses ${code(report.finalReleaseCommit)}` : ''}. ${escapeHtml((report.validationEvidence || []).map((item) => `${item.command}: ${item.result}`).join('; '))}</div><nav class="nav quick-nav" aria-label="Report sections"><a class="nav-link active" href="#finding-overview">${labels.overview}</a><a class="nav-link" href="#findings">${labels.findings}</a><a class="nav-link" href="#blockers">Blockers</a><a class="nav-link" href="#non-i18n">${labels.nonI18n}</a><a class="nav-link" href="#appendix">${labels.appendix}</a></nav><section class="card report-card" id="finding-overview" aria-labelledby="overview-title"><div class="section-head"><div><div class="section-kicker">Triage desk</div><h2 id="overview-title">Finding overview and feedback</h2><p>Every row is derived from the same structured record used by the detail card.</p></div></div><div class="feedback-actions"><button class="btn btn-primary" id="copyFeedback" type="button">${labels.copy}</button><span class="text-muted" id="copyStatus" aria-live="polite"></span></div><div class="alert alert-warning copy-fallback" id="copyFallback" aria-live="polite"><label for="copyFallbackText">Copy fallback text</label><p class="mb-2">Clipboard access is unavailable. Copy the generated text manually.</p><textarea class="form-control" id="copyFallbackText" readonly></textarea></div><div class="table-responsive table-wrap"><table class="table table-sm table-hover"><thead class="thead-light"><tr><th>ID</th><th>Title</th><th>${labels.fixRisk}</th><th>${labels.status}</th><th>${labels.verification}</th><th>${labels.reviewer}</th></tr></thead><tbody>${overviewRows}</tbody></table></div></section><section id="findings" aria-labelledby="findings-title"><h2 class="findings-title" id="findings-title">${labels.details}</h2>${findingCards}</section><section class="card report-card" id="blockers" aria-labelledby="blockers-title"><div class="section-head"><div><div class="section-kicker">Blocked coverage</div><h2 id="blockers-title">Blockers</h2><p>Coverage blockers are separate from i18n findings.</p></div></div>${blockers}</section><section class="card report-card" id="non-i18n" aria-labelledby="non-i18n-title"><div class="section-head"><div><div class="section-kicker">Excluded observation</div><h2 id="non-i18n-title">${labels.nonI18n}</h2><p>Visible exclusions are documented without inflating finding counts.</p></div></div>${nonI18n}</section><section class="card report-card" id="appendix" aria-labelledby="appendix-title"><div class="section-head"><div><div class="section-kicker">Screenshot ledger</div><h2 id="appendix-title">${labels.appendix}</h2><p>${labels.appendixNote}</p></div></div><div class="appendix-grid" id="appendixGrid">${appendixItems}</div></section>`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args['report-json'] || !args.output) {
    throw new Error('Usage: render-ui-inspection-report.mjs --report-json <path> --output <path> [--template <path>]');
  }
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = path.resolve(args.template || path.join(scriptDir, '../references/ui-inspection-report-wireframe.html'));
  const reportPath = path.resolve(args['report-json']);
  const outputPath = path.resolve(args.output);
  const [template, reportText] = await Promise.all([fs.readFile(templatePath, 'utf8'), fs.readFile(reportPath, 'utf8')]);
  const report = JSON.parse(reportText);
  if (!['2.0', '2.1'].includes(report.schemaVersion)) throw new Error(`Unsupported report schema: ${report.schemaVersion}`);
  await validateReport(report, reportPath);
  if (template.indexOf('<div class="report-main">') < 0 || template.indexOf('\n    </div>\n  </main>') < 0) {
    throw new Error('The report wireframe no longer exposes the required report-main content region.');
  }
  const documentLanguage = report.reportDisplayLanguage || 'en';
  const documentTitle = `${report.repository ? path.basename(report.repository) : 'UI'} Internationalization Inspection Report`;
  const populated = template
    .replace('<html lang="en">', `<html lang="${escapeHtml(documentLanguage)}">`)
    .replace('<title>UI Inspection Report</title>', `<title>${escapeHtml(documentTitle)}</title>`)
    .replace(' data-template-sample="true"', '')
    .replace(/(<div class="report-main">)[\s\S]*?(\n    <\/div>\n  <\/main>)/, `$1\n${renderReport(report)}$2`);
  if (populated.includes('data-template-sample="true"') || populated.includes('<div class="mock-shot"')) {
    throw new Error('Sample report content survived template population.');
  }
  await fs.writeFile(outputPath, populated);
  process.stdout.write(`${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
