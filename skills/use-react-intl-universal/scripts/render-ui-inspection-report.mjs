#!/usr/bin/env node

/*
 * Purpose:
 * Render a validated UI inspection report into the run-local HTML wireframe
 * without changing the template-owned shell or interaction behavior.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import {
  assertValidUiInspectionReport,
  deriveFindingStatus,
  deriveReportStatus,
} from './lib/ui-inspection-report-contract.mjs';
import { limitInlineDiff } from './lib/ui-inspection-report-presentation.mjs';

const CONTENT_START = '<!-- UI_INSPECTION_REPORT_CONTENT_START -->';
const CONTENT_END = '<!-- UI_INSPECTION_REPORT_CONTENT_END -->';
const RISK_RANK = { low: 0, medium: 1, high: 2 };
const INLINE_DIFF_MAX_BYTES = 64 * 1024;
const INLINE_DIFF_MAX_LINES = 800;
const ROLE_ORDER = [
  'issue-context',
  'issue-detail',
  'failed-verification',
  'verification-context',
  'verification-detail',
  'regression-check',
];
const USAGE = 'Usage: render-ui-inspection-report.mjs --report-json <path> --output <run-report.html> [--template <run-local-template.html>] [--repository <path>]';

/** Parses command-line arguments into script options. */
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

/** Escapes a value for insertion into report HTML. */
function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Wraps escaped text in an inline code element. */
function code(value = '') {
  return `<code>${escapeHtml(value)}</code>`;
}

/** Renders a link to a report artifact when a path is available. */
function artifactLink(artifact, label = 'raw artifact') {
  if (!artifact) return 'artifact not recorded';
  return `<a class="artifact-link" href="${escapeHtml(artifact.path)}" target="_blank" rel="noopener" title="SHA-256 ${escapeHtml(artifact.sha256)}">${escapeHtml(label)}</a>`;
}

/** Formats an evidence timestamp in the report's fixed date-time style. */
function formatTime(value) {
  return escapeHtml(String(value || 'not recorded').replace('T', ' '));
}

/** Formats CSS viewport dimensions, device-pixel ratio, and browser zoom. */
function formatViewport(viewport) {
  if (!viewport) return 'not recorded';
  return `${viewport.width}x${viewport.height} CSS px, DPR ${viewport.deviceScaleFactor}, zoom ${Math.round(viewport.browserZoom * 100)}%`;
}

/** Formats viewport and image-pixel dimensions for screenshot metadata. */
function formatCaptureGeometry(capture) {
  return `${formatViewport(capture.viewport)}, capture ${capture.captureScaleFactor}x, asset ${capture.pixelWidth}x${capture.pixelHeight} px`;
}

/** Renders the runtime-resource evidence that identifies the inspected deployment. */
function renderDeploymentIdentityProof(capture) {
  const proof = capture.deploymentIdentityProof;
  if (!proof) return '';
  if (proof.method === 'runtime-publication-manifest') {
    const resources = proof.runtimeIdentity?.resourceUrls || [];
    return `<br /><span class="text-muted">SPA deployment proof: requested ${code(proof.requestedUrl)} · runtime release ${code(proof.runtimeIdentity?.releaseVersion)} · ${resources.length} loaded resource${resources.length === 1 ? '' : 's'} · ${artifactLink(proof.artifact, 'raw identity proof')}</span>`;
  }
  return `<br /><span class="text-muted">SPA deployment proof: requested ${code(proof.requestedUrl)} · loaded ${code(proof.observedResourceUrl)} · ${artifactLink(proof.artifact, 'raw identity proof')}</span>`;
}

/** Maps a risk level to its presentation tone. */
function riskTone(value) {
  if (value === 'high') return 'danger';
  if (value === 'medium') return 'warning';
  return 'success';
}

/** Maps a finding status to its presentation tone. */
function statusTone(value) {
  if (['verifiedFixed', 'covered', 'supports', 'approved', 'passed', 'admitted'].includes(value)) return 'success';
  if (['verificationFailed', 'failed', 'blocked', 'mismatch', 'does-not-support', 'changes-requested'].includes(value)) return 'danger';
  if (['publishedForVerification', 'needsHumanConfirmation', 'partial', 'uncertain', 'insufficient', 'completed-with-attention'].includes(value)) return 'warning';
  return 'secondary';
}

/** Renders a Bootstrap badge for a labeled value. */
function badge(value, prefix = '', kind = 'status') {
  const tone = kind === 'risk' ? riskTone(value) : statusTone(value);
  return `<span class="badge badge-${tone}">${escapeHtml(prefix + value)}</span>`;
}

/** Returns the effective risk level for a finding. */
function effectiveRisk(finding) {
  const assessment = finding.remediation.fixAssessment;
  if (!assessment) return null;
  const rank = Math.max(RISK_RANK[assessment.derivedRiskFloor], RISK_RANK[assessment.claimedRisk]);
  return ['low', 'medium', 'high'][rank];
}

/** Returns localized labels used by the report renderer. */
function labels(report) {
  const zh = /^zh/i.test(report.run.reportDisplayLanguage);
  return zh
    ? {
        title: '国际化巡检报告',
        found: '已发现问题',
        fixed: '已验证修复',
        attention: '需要人关注',
        overview: '问题总览',
        findings: '问题详情',
        coverageLimits: '覆盖限制',
        blockers: 'Blockers',
        nonI18n: '非 i18n 观察',
        appendix: '截图附录',
        feedback: '评审反馈',
        copyFeedback: '复制 Finding 与反馈',
        issueContext: '问题页面上下文',
        issueDetail: '问题证据',
        failedVerification: '失败复验',
        verificationContext: '最终页面上下文',
        verificationDetail: '最终 Preview 证据',
        regressionCheck: '原有功能回归检查证据',
        beforeColumn: '修复前 / 问题证据',
        afterColumn: '修复后 / 最终 Preview',
        noBeforeEvidence: '没有准入的修复前证据。',
        noAfterEvidence: '尚未产生修复后 Preview 证据。',
        claim: '这张图需要证明',
        observed: '独立读图结果',
        evidenceReview: '证据复核',
        acceptance: '验收项',
        risk: '修复风险',
        fixDiff: '修复代码 diff',
        releaseRisk: '本轮发布风险',
        introducedFix: '首次修复',
        currentVerification: '当前发布复验',
        source: '来源归因',
        validations: '代码与运行校验',
        reproduction: '复现步骤',
        noCoverageLimits: '所有范围内节点均已达到终态；source-backed 排除项列在上方。',
        excludedRoots: '排除的根页面',
        noBlockers: '本轮无 Blocker。',
        noNonI18n: '本轮无需要展示的非 i18n 观察。',
        noFindings: '本轮没有准入 Finding。',
      }
    : {
        title: 'Internationalization Inspection Report',
        found: 'Issues found',
        fixed: 'Verified fixes',
        attention: 'Need attention',
        overview: 'Finding overview',
        findings: 'Finding details',
        coverageLimits: 'Coverage limitations',
        blockers: 'Blockers',
        nonI18n: 'Non-i18n observations',
        appendix: 'Screenshot appendix',
        feedback: 'Reviewer feedback',
        copyFeedback: 'Copy findings and feedback',
        issueContext: 'Issue page context',
        issueDetail: 'Issue evidence',
        failedVerification: 'Failed verification',
        verificationContext: 'Final page context',
        verificationDetail: 'Final Preview evidence',
        regressionCheck: 'Original-function regression evidence',
        beforeColumn: 'Before / issue evidence',
        afterColumn: 'After / final deployment',
        noBeforeEvidence: 'No admitted before evidence.',
        noAfterEvidence: 'No final deployment evidence is available yet.',
        claim: 'Claim this image must prove',
        observed: 'Independent image reading',
        evidenceReview: 'Evidence review',
        acceptance: 'Acceptance checks',
        risk: 'Fix risk',
        fixDiff: 'Fix code diff',
        releaseRisk: 'Release risk',
        introducedFix: 'Introduced fix',
        currentVerification: 'Current release verification',
        source: 'Source attribution',
        validations: 'Code and runtime validation',
        reproduction: 'Reproduction steps',
        noCoverageLimits: 'Every in-scope node reached a terminal state; source-backed exclusions are listed above.',
        excludedRoots: 'Excluded roots',
        noBlockers: 'No blockers were recorded.',
        noNonI18n: 'No non-i18n observations were recorded.',
        noFindings: 'No findings were admitted.',
      };
}

/** Returns the display label for an evidence role. */
function roleLabel(role, text) {
  const key = {
    'issue-context': 'issueContext',
    'issue-detail': 'issueDetail',
    'failed-verification': 'failedVerification',
    'verification-context': 'verificationContext',
    'verification-detail': 'verificationDetail',
    'regression-check': 'regressionCheck',
  }[role];
  return text[key] || role;
}

/** Renders screenshot overlays for the claims bound to one capture. */
function renderAnnotationBoxes(bindings) {
  const list = Array.isArray(bindings) ? bindings : [bindings];
  const seen = new Set();
  const boxes = list.flatMap((binding) => binding.annotation.boxes).filter((box) => {
    const key = [box.x, box.y, box.width, box.height, box.label].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return boxes.map((box) => {
    const inside = box.y < 4 ? ' label-inside' : '';
    return `<span class="redbox${inside}" style="left:${box.x}%;top:${box.y}%;width:${box.width}%;height:${box.height}%"><span>${escapeHtml(box.label)}</span></span>`;
  }).join('');
}

/** Renders one claim and its annotation label beneath a screenshot. */
function renderEvidenceClaim(binding, capture, deployment, text) {
  const deploymentText = deployment
    ? `${deployment.id} / ${deployment.buildCommit.slice(0, 12)}`
    : 'not tied to a deployment';
  return `<section class="evidence-claim" id="${escapeHtml(binding.id)}">
    <div class="evidence-claim-head"><h5>${escapeHtml(roleLabel(binding.role, text))}</h5>${badge(binding.review.verdict)}</div>
    <p><strong>${escapeHtml(text.claim)}:</strong> ${escapeHtml(binding.claim)}<br /><strong>${escapeHtml(text.observed)}:</strong> ${escapeHtml(binding.observed)}</p>
    <div class="evidence-review"><strong>${escapeHtml(text.evidenceReview)}:</strong> ${badge(binding.review.verdict)} ${escapeHtml(binding.review.rationale)}<br /><span class="text-muted">Reviewer ${escapeHtml(binding.review.reviewerId)} · session ${code(binding.review.reviewSessionId)} · ${artifactLink(binding.review.artifact, 'raw review')} · asset ${code(capture.sha256.slice(0, 12))} · ${escapeHtml(deploymentText)}</span>${binding.admissionReview ? `<br /><span class="text-muted">Initial admission: ${escapeHtml(binding.admissionReview.reviewerId)} · session ${code(binding.admissionReview.reviewSessionId)} · ${artifactLink(binding.admissionReview.artifact, 'raw admission review')}</span>` : ''}${renderDeploymentIdentityProof(capture)}</div>
  </section>`;
}

/** Renders one capture with all claims that reuse that immutable screenshot. */
function renderEvidenceGroup(bindings, capture, deployment, text, { findingGroup = false } = {}) {
  const ownerId = bindings[0]?.ownerId || 'unowned';
  const stageId = `evidence-${escapeHtml(ownerId)}-${escapeHtml(capture.id)}`;
  const roleLabels = [...new Set(bindings.map((binding) => roleLabel(binding.role, text)))];
  const annotationBoxes = renderAnnotationBoxes(bindings);
  return `<article class="evidence-card evidence-group-card"${findingGroup ? ` data-finding-evidence-capture="${escapeHtml(capture.id)}"` : ''}>
    <div class="d-flex justify-content-between align-items-start mb-2">
      <h4 class="evidence-title">${escapeHtml(roleLabels.join(' · '))}</h4>
      <div class="badge-row">${bindings.map((binding) => badge(binding.review.verdict)).join('')}</div>
    </div>
    <figure class="annotated-shot">
      <div class="shot-scroll">
        <a class="annotated-stage with-image" id="${stageId}" href="#${stageId}" data-preview-stage="${stageId}" aria-label="Open ${escapeHtml(capture.id)} screenshot">
          <img class="real-shot" src="${escapeHtml(capture.path)}" width="${capture.pixelWidth}" height="${capture.pixelHeight}" alt="${escapeHtml(capture.page)}" />
          ${annotationBoxes}
        </a>
      </div>
      <figcaption>${escapeHtml(capture.page)} · ${formatTime(capture.capturedAt)}<span class="shot-time">${escapeHtml(formatCaptureGeometry(capture))}</span></figcaption>
    </figure>
    <div class="evidence-claims">${bindings.map((binding) => renderEvidenceClaim(binding, capture, deployment, text)).join('')}</div>
  </article>`;
}

/** Renders a standalone evidence binding and its referenced capture. */
function renderEvidence(binding, capture, deployment, text) {
  return renderEvidenceGroup([binding], capture, deployment, text);
}

/** Groups evidence bindings by capture ID while preserving encounter order. */
function groupBindingsByCapture(bindings) {
  const groups = new Map();
  for (const binding of bindings) {
    if (!groups.has(binding.captureId)) groups.set(binding.captureId, []);
    groups.get(binding.captureId).push(binding);
  }
  return [...groups.values()];
}

/** Renders a finding's before and after evidence in paired columns. */
function renderFindingEvidence(bindings, maps, text) {
  const beforeRoles = new Set(['issue-context', 'issue-detail']);
  const before = bindings.filter((binding) => beforeRoles.has(binding.role));
  const after = bindings.filter((binding) => !beforeRoles.has(binding.role));
  const renderColumn = (columnBindings, title, emptyText, side) => {
    const cards = groupBindingsByCapture(columnBindings).map((group) => {
      const capture = maps.captureMap.get(group[0].captureId);
      const deployment = capture.deploymentId ? maps.deploymentMap.get(capture.deploymentId) : null;
      return renderEvidenceGroup(group, capture, deployment, text, { findingGroup: true });
    }).join('');
    return `<section class="finding-evidence-column" data-evidence-side="${side}"><h4 class="evidence-column-title">${escapeHtml(title)}</h4><div class="finding-evidence-stack">${cards || `<div class="evidence-empty">${escapeHtml(emptyText)}</div>`}</div></section>`;
  };
  return `<div class="finding-evidence-grid">${renderColumn(before, text.beforeColumn, text.noBeforeEvidence, 'before')}${renderColumn(after, text.afterColumn, text.noAfterEvidence, 'after')}</div>`;
}

/** Renders code-risk assessments and bounded inline diffs for a finding. */
function renderRiskPanel(finding, codeRiskReviews, diffContents, inlineDiffOwners, text) {
  const assessment = finding.remediation.fixAssessment;
  if (!assessment) {
    return `<section class="risk-panel"><h4>${escapeHtml(text.risk)}</h4><p class="mb-0">${escapeHtml(finding.remediation.recommendation)}</p></section>`;
  }
  const review = codeRiskReviews.find((item) => item.baseCommit === assessment.baseCommit
    && item.fixCommit === assessment.fixCommit
    && item.diffSha256 === assessment.diffSha256
    && ((item.scope === 'finding' && item.findingIds.includes(finding.id))
      || (item.scope === 'release' && item.findingIds.includes(finding.id))));
  const changedFiles = assessment.changedFiles.map((item) => `<li>${code(item.path)} ${badge(item.changeKind)}</li>`).join('');
  const unresolved = review?.findings.filter((item) => !item.resolved) || [];
  const diffText = diffContents.get(assessment.diffArtifact.sha256);
  const inlineDiff = limitInlineDiff(diffText || 'Validated diff artifact could not be loaded for inline display.', {
    maxBytes: INLINE_DIFF_MAX_BYTES,
    maxLines: INLINE_DIFF_MAX_LINES,
  });
  const priorInlineOwner = inlineDiff.truncated
    ? inlineDiffOwners.get(assessment.diffArtifact.sha256)
    : null;
  if (inlineDiff.truncated && !priorInlineOwner) {
    inlineDiffOwners.set(assessment.diffArtifact.sha256, finding.id);
  }
  const inlinePreview = priorInlineOwner
    ? `<div class="fix-diff-limit">Inline preview omitted because this large validated diff is already shown under <a href="#${escapeHtml(priorInlineOwner)}">${escapeHtml(priorInlineOwner)}</a>. Open ${artifactLink(assessment.diffArtifact, 'the raw diff')} for the complete artifact.</div>`
    : `<pre><code>${escapeHtml(inlineDiff.content)}</code></pre>
      ${inlineDiff.truncated ? `<div class="fix-diff-limit">Inline preview limited to ${INLINE_DIFF_MAX_LINES} lines / ${INLINE_DIFF_MAX_BYTES} bytes from ${inlineDiff.sourceLines} lines / ${inlineDiff.sourceBytes} bytes. Open ${artifactLink(assessment.diffArtifact, 'the raw diff')} for the complete validated artifact.</div>` : ''}`;
  return `<section class="risk-panel">
    <div class="d-flex justify-content-between align-items-start mb-2"><h4>${escapeHtml(text.risk)}</h4><div class="badge-row">${badge(assessment.derivedRiskFloor, 'floor: ', 'risk')}${badge(assessment.claimedRisk, 'reported: ', 'risk')}${review ? badge(review.verdict) : badge('review-pending')}</div></div>
    <p>${escapeHtml(assessment.rationale)}</p>
    <dl class="row mb-2"><dt class="col-3">${escapeHtml(text.introducedFix)}</dt><dd class="col-9">${code(`${assessment.baseCommit.slice(0, 10)}..${assessment.fixCommit.slice(0, 10)}`)} · ${code(assessment.diffSha256.slice(0, 12))} · ${artifactLink(assessment.diffArtifact, 'readable diff')}</dd><dt class="col-3">Risk factors</dt><dd class="col-9">${assessment.riskFactors.map((item) => badge(item)).join(' ')}</dd><dt class="col-3">Surfaces</dt><dd class="col-9">${escapeHtml(assessment.affectedSurfaces.join('; '))}</dd></dl>
    <ul class="mb-2">${changedFiles}</ul>
    <details class="fix-diff" open>
      <summary>${escapeHtml(text.fixDiff)} · ${code(`${assessment.baseCommit.slice(0, 10)}..${assessment.fixCommit.slice(0, 10)}`)}</summary>
      <div class="fix-diff-toolbar">${artifactLink(assessment.diffArtifact, 'open raw diff')} · SHA-256 ${code(assessment.diffSha256.slice(0, 12))}</div>
      ${inlinePreview}
    </details>
    <p class="mb-0"><strong>Independent code review:</strong> ${review ? `${escapeHtml(review.notes)}${unresolved.length ? ` Unresolved: ${escapeHtml(unresolved.map((item) => `${item.severity} ${item.summary}`).join('; '))}` : ''}<br /><span class="text-muted">Reviewer ${escapeHtml(review.reviewerId)} · session ${code(review.reviewSessionId)} · ${artifactLink(review.artifact, 'raw review')}</span>` : 'Not completed.'}</p>
  </section>`;
}

/** Renders acceptance criteria with their evidence and validation references. */
function renderAcceptance(finding, bindingMap, validationMap, text) {
  const rows = finding.acceptanceChecks.map((check) => {
    const evidence = check.evidenceBindingIds.map((id) => {
      const binding = bindingMap.get(id);
      return binding ? `<a href="#${escapeHtml(id)}">${escapeHtml(id)} (${escapeHtml(roleLabel(binding.role, text))})</a>` : escapeHtml(id);
    }).join('<br />') || '—';
    const validations = check.validationIds.map((id) => {
      const item = validationMap.get(id);
      return item ? `${code(id)} ${badge(item.result)}` : code(id);
    }).join('<br />') || '—';
    return `<tr><td>${code(check.id)}</td><td>${escapeHtml(check.statement)}</td><td>${badge(check.status)}</td><td>${evidence}</td><td>${validations}</td><td>${escapeHtml(check.notes)}</td></tr>`;
  }).join('');
  return `<section class="finding-acceptance"><h4>${escapeHtml(text.acceptance)}</h4><div class="table-wrap"><table class="table table-sm acceptance-table"><thead><tr><th>ID</th><th>Check</th><th>Status</th><th>Visual evidence</th><th>Validation</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

/** Renders a complete finding section for the report body and review modal. */
function renderFinding(finding, maps, text, finalFindingReview) {
  const status = deriveFindingStatus(finding);
  const risk = effectiveRisk(finding);
  const target = maps.targetMap.get(finding.targetId);
  const bindings = finding.evidenceBindingIds
    .map((id) => maps.bindingMap.get(id))
    .filter(Boolean)
    .sort((left, right) => ROLE_ORDER.indexOf(left.role) - ROLE_ORDER.indexOf(right.role));
  const evidence = renderFindingEvidence(bindings, maps, text);
  const sourceMatches = finding.sourceAttribution.matches.length
    ? finding.sourceAttribution.matches.map((item) => `${code(item.filePath)}${item.line ? `:${item.line}` : ''} · ${escapeHtml(item.reason)}`).join('<br />')
    : 'No local source match recorded.';
  const validationRows = finding.remediation.validationIds.map((id) => {
    const item = maps.validationMap.get(id);
    return item ? `${code(id)} ${badge(item.result)} ${escapeHtml(item.command)} · ${escapeHtml(item.notes)}${item.result !== 'not-run' ? ` · ${formatTime(item.executedAt)} · exit ${escapeHtml(item.exitCode)} · ${artifactLink(item.artifact, 'raw output')}` : ''}` : code(id);
  }).join('<br />') || 'No validation recorded.';
  return `<article class="finding-card" id="${escapeHtml(finding.id)}">
    <header class="finding-head">
      <div><h3 data-finding-title>${escapeHtml(finding.id)} ${escapeHtml(finding.title)}</h3><p>${escapeHtml(finding.category)}</p></div>
      <div class="badge-row">${badge(finding.severity, 'severity: ')}${badge(status, 'status: ')}${risk ? badge(risk, 'fix risk: ', 'risk') : badge('not-fixed')}${finalFindingReview ? badge(finalFindingReview.verdict, 'human review: ') : badge('human review pending')}</div>
    </header>
    <dl class="finding-meta">
      <div><dt>URL / state</dt><dd>${code(finding.url)}<br />${code(finding.stateKey)}</dd></div>
      <div><dt>Target</dt><dd>${escapeHtml(target.locale)}<br />${escapeHtml(formatViewport(target.viewport))}</dd></div>
      <div><dt>Owner / origin</dt><dd>${escapeHtml(finding.sourceAttribution.owner)}<br />${code(finding.sourceAttribution.origin)}</dd></div>
      <div><dt>Actual</dt><dd>${escapeHtml(finding.actual)}</dd></div>
      <div><dt>Expected</dt><dd>${escapeHtml(finding.expected)}</dd></div>
      <div><dt>${escapeHtml(text.currentVerification)}</dt><dd>${badge(finding.verification.result)} ${finding.verification.verifiedAtCommit ? code(finding.verification.verifiedAtCommit.slice(0, 12)) : ''}<br />${escapeHtml(finding.verification.notes)}</dd></div>
    </dl>
    ${evidence}
    <div class="finding-body">
      <section><h4>${escapeHtml(text.reproduction)}</h4><ol class="mb-0 pl-3">${finding.reproductionSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol></section>
      <section><h4>${escapeHtml(text.source)}</h4><p>${escapeHtml(finding.sourceAttribution.rationale)}</p><p class="mb-0">${sourceMatches}</p></section>
      ${renderRiskPanel(finding, maps.codeRiskReviews, maps.diffContents, maps.inlineDiffOwners, text)}
      <section><h4>${escapeHtml(text.validations)}</h4><p class="mb-0">${validationRows}</p></section>
    </div>
    ${renderAcceptance(finding, maps.bindingMap, maps.validationMap, text)}
  </article>`;
}

/** Renders a blocker or non-i18n observation with supporting evidence. */
function renderObservation(observation, maps, text) {
  const evidence = observation.evidenceBindingIds.map((id) => {
    const binding = maps.bindingMap.get(id);
    const capture = maps.captureMap.get(binding.captureId);
    return renderEvidence(binding, capture, capture.deploymentId ? maps.deploymentMap.get(capture.deploymentId) : null, text);
  }).join('');
  return `<article class="observation-card" id="${escapeHtml(observation.id)}"><header class="observation-head"><h3>${escapeHtml(observation.id)} ${escapeHtml(observation.title)}</h3><div class="badge-row">${badge(observation.kind)}</div></header><div class="observation-body"><p><strong>Observation:</strong> ${escapeHtml(observation.observation)}</p><p><strong>Classification:</strong> ${escapeHtml(observation.classificationReason)}</p><p><strong>Follow-up:</strong> ${escapeHtml(observation.followUp)}</p><div class="evidence-list p-0 border-0">${evidence}</div></div></article>`;
}

/** Renders a screenshot appendix entry with route, action, state, and timestamp. */
function renderAppendixCapture(capture, deployment) {
  const stageId = `capture-${escapeHtml(capture.id)}`;
  return `<figure class="annotated-shot" id="appendix-${escapeHtml(capture.id)}">
    <div class="shot-scroll"><a class="annotated-stage with-image" id="${stageId}" href="#${stageId}" data-preview-stage="${stageId}"><img class="real-shot" src="${escapeHtml(capture.path)}" width="${capture.pixelWidth}" height="${capture.pixelHeight}" alt="${escapeHtml(capture.page)}" /></a></div>
    <figcaption>${escapeHtml(path.basename(capture.path))}<span class="shot-time">${formatTime(capture.capturedAt)}</span></figcaption>
    <div class="appendix-meta"><dl><dt>ID</dt><dd>${code(capture.id)}</dd><dt>Scope</dt><dd>${escapeHtml(capture.page)}</dd><dt>URL/state</dt><dd>${code(capture.url)}<br />${code(capture.stateSnapshot.key)}${renderDeploymentIdentityProof(capture)}</dd><dt>Action</dt><dd>${escapeHtml(capture.action)}</dd><dt>Viewport</dt><dd>${escapeHtml(formatViewport(capture.viewport))}<br />Capture scale ${escapeHtml(String(capture.captureScaleFactor))}x</dd><dt>Admission</dt><dd>${badge(capture.admission.status)} ${escapeHtml(capture.admission.reviewedBy || '')}</dd><dt>Asset</dt><dd>${code(`${capture.mimeType} ${capture.pixelWidth}x${capture.pixelHeight} ${capture.sha256.slice(0, 12)}`)}</dd><dt>Deployment</dt><dd>${deployment ? `${code(deployment.id)} ${code(deployment.buildCommit.slice(0, 12))}` : 'none'}</dd></dl></div>
  </figure>`;
}

/** Renders final release checks and the derived release recommendation. */
function renderReleaseAssessment(report, validationMap, text) {
  const assessment = report.releaseAssessment;
  if (!assessment) return '<strong>Release assessment:</strong> no code release diff recorded.';
  const risk = ['low', 'medium', 'high'][Math.max(
    RISK_RANK[assessment.derivedRiskFloor],
    RISK_RANK[assessment.claimedRisk],
  )];
  const review = report.reviews.codeRisk.find((item) => item.scope === 'release'
    && item.baseCommit === assessment.baseCommit
    && item.fixCommit === assessment.fixCommit
    && item.diffSha256 === assessment.diffSha256);
  const validations = assessment.validationIds.map((id) => {
    const validation = validationMap.get(id);
    return validation ? `${code(id)} ${badge(validation.result)}` : code(id);
  }).join(' ');
  return `<strong>${escapeHtml(text.releaseRisk)}:</strong> ${badge(risk, '', 'risk')} ${code(`${assessment.baseCommit.slice(0, 10)}..${assessment.fixCommit.slice(0, 10)}`)} · ${artifactLink(assessment.diffArtifact, 'readable release diff')} · ${review ? `${badge(review.verdict)} ${artifactLink(review.artifact, 'raw code review')}` : badge('review-pending')}<br /><span class="text-muted">${escapeHtml(assessment.rationale)} Findings: ${escapeHtml(assessment.findingIds.join(', '))}. Checks: ${validations}</span>`;
}

/** Renders the validated report data into the template-owned content region. */
function renderReport(report, derived, diffContents) {
  const text = labels(report);
  const summary = derived.summary;
  const reportStatus = deriveReportStatus(report);
  const targetMap = new Map(report.targets.map((item) => [item.id, item]));
  const deploymentMap = new Map(report.deployments.map((item) => [item.id, item]));
  const validationMap = new Map(report.validations.map((item) => [item.id, item]));
  const captureMap = new Map(report.captures.map((item) => [item.id, item]));
  const bindingMap = new Map(report.evidenceBindings.map((item) => [item.id, item]));
  const inlineDiffOwners = new Map();
  const finalReview = report.reviews.finalReport;
  const finalFindingReviewMap = new Map((finalReview?.findingReviews || []).map((item) => [item.findingId, item]));
  const maps = {
    targetMap,
    deploymentMap,
    validationMap,
    captureMap,
    bindingMap,
    codeRiskReviews: report.reviews.codeRisk,
    diffContents,
    inlineDiffOwners,
  };
  const repoName = report.run.repository ? path.basename(report.run.repository) : 'UI';
  const finalDeployment = report.deployments
    .filter((item) => item.stage === 'fix'
      && item.status === 'published'
      && (!report.run.finalCommit || item.buildCommit === report.run.finalCommit))
    .sort((left, right) => Date.parse(left.publishedAt) - Date.parse(right.publishedAt))
    .at(-1);
  const overviewRows = report.findings.map((finding) => {
    const status = deriveFindingStatus(finding);
    const risk = effectiveRisk(finding);
    const review = finalFindingReviewMap.get(finding.id);
    return `<tr><td><a href="#${escapeHtml(finding.id)}">${escapeHtml(finding.id)}</a></td><td><a href="#${escapeHtml(finding.id)}" data-finding-modal="${escapeHtml(finding.id)}">${escapeHtml(finding.title)}</a><div class="text-muted mt-1">${escapeHtml(finding.sourceAttribution.rationale)}</div></td><td>${risk ? badge(risk, '', 'risk') : '—'}</td><td>${badge(status)}</td><td>${review ? badge(review.verdict) : badge('pending')}</td><td><textarea class="form-control" data-feedback-id="${escapeHtml(finding.id)}" placeholder="${escapeHtml(text.feedback)}"></textarea></td></tr>`;
  }).join('');
  const findingCards = report.findings.map((finding) => renderFinding(finding, maps, text, finalFindingReviewMap.get(finding.id))).join('');
  const coverageLimits = report.coverage.filter((item) => item.status !== 'covered');
  const coverageLimitRows = coverageLimits.map((item) => `<tr><td>${code(item.id)}</td><td>${escapeHtml(item.label)}</td><td>${badge(item.status)}</td><td>${code(item.url)}</td><td>${escapeHtml(item.action)}</td><td>${code(item.rendererKey)}</td><td>${escapeHtml(item.equivalenceRationale || item.reason || 'No reason recorded.')}</td></tr>`).join('');
  const excludedRoots = report.coverageInventory?.excludedRoots || [];
  const excludedRootList = excludedRoots.length
    ? `<div class="mb-3"><h3 class="h6 text-uppercase">${escapeHtml(text.excludedRoots)} (${excludedRoots.length})</h3><ul class="mb-0">${excludedRoots.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
    : '';
  const blockers = report.observations.filter((item) => item.kind === 'blocker');
  const nonI18n = report.observations.filter((item) => item.kind === 'non-i18n');
  const admittedCaptures = report.captures.filter((item) => item.admission.status === 'admitted');
  const appendix = admittedCaptures.map((capture) => renderAppendixCapture(capture, capture.deploymentId ? deploymentMap.get(capture.deploymentId) : null)).join('');
  const reviewSummary = finalReview
    ? `${badge(finalReview.verdict)} ${escapeHtml(finalReview.reviewerId)} · r${finalReview.reportRevision}`
    : badge('pending');
  const targetSummary = report.targets.map((target) => `${target.locale} @ ${formatViewport(target.viewport)}`).join('; ');
  const inventorySummary = report.coverageInventory
    ? `${report.coverageInventory.scopedRootCount} scoped of ${report.coverageInventory.discoveredRootCount} source-discovered roots; ${escapeHtml(report.coverageInventory.methodology)}; source ${report.coverageInventory.sourceRefs.map((item) => code(item)).join(', ')}; ${artifactLink(report.coverageInventory.artifact, 'raw inventory')}`
    : 'No source-backed coverage inventory recorded.';
  const reportValidationSummary = report.validations
    .filter((item) => item.scope === 'report')
    .map((item) => `${code(item.id)} ${badge(item.result)}${item.artifact ? ` ${artifactLink(item.artifact, 'raw output')}` : ''}`)
    .join(' · ') || 'not recorded';

  return `${CONTENT_START}
  <header class="hero-card">
    <div class="hero-grid">
      <div><h1>${escapeHtml(repoName)} ${escapeHtml(text.title)}</h1><p>Claim-level evidence, exact Preview provenance, code-risk review, and human-readable acceptance results.</p></div>
      <div class="report-meta-row"><div><span>Target</span><strong>${escapeHtml(targetSummary)}</strong></div><div><span>Branch</span><strong>${escapeHtml(report.run.branch || 'not recorded')}</strong></div><div><span>Final commit</span><strong>${report.run.finalCommit ? code(report.run.finalCommit.slice(0, 12)) : 'not recorded'}</strong></div><div><span>Report status</span><strong>${escapeHtml(reportStatus)}</strong></div><div><span>Human review</span><strong>${reviewSummary}</strong></div></div>
      <div class="metric-strip"><div class="metric-card" data-tone="danger"><span>${escapeHtml(text.found)}</span><strong>${summary.issues.found}</strong><small>Runtime-admitted i18n findings</small></div><div class="metric-card" data-tone="success"><span>${escapeHtml(text.fixed)}</span><strong>${summary.issues.fixed}</strong><small>All acceptance gates passed</small></div><div class="metric-card" data-tone="warning"><span>${escapeHtml(text.attention)}</span><strong>${summary.issues.needAttention}</strong><small>Open, deferred, blocked, or confirmation required</small></div></div>
    </div>
  </header>
  <div class="alert alert-light border mt-3 mb-0"><strong>Verification deployment URL:</strong> ${finalDeployment ? `<a class="text-break" href="${escapeHtml(finalDeployment.previewUrl)}" target="_blank" rel="noopener">${escapeHtml(finalDeployment.previewUrl)}</a>` : 'No final fix deployment recorded.'}<br /><strong>Release provenance:</strong> ${finalDeployment ? `<a href="${escapeHtml(finalDeployment.previewUrl)}" target="_blank" rel="noopener">${escapeHtml(finalDeployment.id)}</a> uses ${code(finalDeployment.buildCommit)}; ${escapeHtml(finalDeployment.evidence.resultSummary)}; ${artifactLink(finalDeployment.evidence.artifact, 'raw publish evidence')}` : 'No final fix deployment recorded.'}<br />${renderReleaseAssessment(report, validationMap, text)}<br /><strong>Report validation:</strong> ${reportValidationSummary}<br /><strong>Final human review:</strong> ${finalReview ? `${badge(finalReview.verdict)} ${escapeHtml(finalReview.reviewerId)} · session ${code(finalReview.reviewSessionId)} · ${artifactLink(finalReview.artifact, 'raw review')}` : 'not recorded'}<br /><strong>Review digest:</strong> ${code(derived.reviewableContentSha256)}</div>
  <nav class="nav quick-nav" aria-label="Report sections"><a class="nav-link active" href="#finding-overview">${escapeHtml(text.overview)}</a><a class="nav-link" href="#findings">${escapeHtml(text.findings)}</a><a class="nav-link" href="#coverage-limitations">${escapeHtml(text.coverageLimits)}</a><a class="nav-link" href="#blockers">${escapeHtml(text.blockers)}</a><a class="nav-link" href="#non-i18n">${escapeHtml(text.nonI18n)}</a><a class="nav-link" href="#appendix">${escapeHtml(text.appendix)}</a></nav>
  <section class="report-card" id="finding-overview"><div class="section-head"><div><h2>${escapeHtml(text.overview)}</h2><p>Rows and detail cards are derived from the same validated record.</p></div></div><div class="feedback-actions"><button class="btn btn-primary" id="copyFeedback" type="button">${escapeHtml(text.copyFeedback)}</button><span class="text-muted" id="copyStatus" aria-live="polite"></span></div>${report.findings.length ? `<div class="table-wrap"><table class="table table-sm table-hover"><thead><tr><th>ID</th><th>Title / attribution</th><th>${escapeHtml(text.risk)}</th><th>Status</th><th>Human review</th><th>${escapeHtml(text.feedback)}</th></tr></thead><tbody>${overviewRows}</tbody></table></div>` : `<div class="alert alert-success mb-0">${escapeHtml(text.noFindings)}</div>`}</section>
  <section id="findings"><h2 class="findings-title">${escapeHtml(text.findings)}</h2>${findingCards || `<div class="report-card"><div class="alert alert-success mb-0">${escapeHtml(text.noFindings)}</div></div>`}</section>
  <section class="report-card" id="coverage-limitations"><div class="section-head"><div><h2>${escapeHtml(text.coverageLimits)}</h2><p>${inventorySummary}. Covered-state URLs and actions remain in the screenshot appendix; sampled equivalents remain visible here.</p></div></div>${excludedRootList}${coverageLimits.length ? `<div class="table-wrap"><table class="table table-sm"><thead><tr><th>ID</th><th>Scope</th><th>Status</th><th>URL</th><th>Action</th><th>Renderer</th><th>Reason</th></tr></thead><tbody>${coverageLimitRows}</tbody></table></div>` : `<div class="alert alert-success mb-0">${escapeHtml(text.noCoverageLimits)}</div>`}</section>
  <section class="report-card" id="blockers"><div class="section-head"><div><h2>${escapeHtml(text.blockers)}</h2><p>Coverage failures remain separate from i18n findings.</p></div></div><div class="observation-grid">${blockers.length ? blockers.map((item) => renderObservation(item, maps, text)).join('') : `<div class="alert alert-success mb-0">${escapeHtml(text.noBlockers)}</div>`}</div></section>
  <section class="report-card" id="non-i18n"><div class="section-head"><div><h2>${escapeHtml(text.nonI18n)}</h2><p>Visible exclusions are evidence-backed without inflating finding counts.</p></div></div><div class="observation-grid">${nonI18n.length ? nonI18n.map((item) => renderObservation(item, maps, text)).join('') : `<div class="alert alert-light mb-0">${escapeHtml(text.noNonI18n)}</div>`}</div></section>
  <section class="report-card" id="appendix"><div class="section-head"><div><h2>${escapeHtml(text.appendix)}</h2><p>Only immutable, admitted saved pixels appear here. Images remain at original pixels inside scroll containers.</p></div></div><div class="appendix-grid">${appendix || '<div class="alert alert-light mb-0">No admitted screenshots.</div>'}</div></section>
  ${CONTENT_END}`;
}

/** Runs this script's command-line workflow. */
async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  const args = parseArgs(argv);
  if (!args['report-json'] || !args.output) {
    throw new Error(USAGE);
  }
  const reportPath = path.resolve(args['report-json']);
  const outputPath = path.resolve(args.output);
  const templatePath = path.resolve(args.template || outputPath);
  const [reportText, template] = await Promise.all([
    fs.readFile(reportPath, 'utf8'),
    fs.readFile(templatePath, 'utf8').catch((error) => {
      throw new Error(`Run-local report template is missing at ${templatePath}. Copy ui-inspection-report-wireframe.html there before rendering. ${error.message}`);
    }),
  ]);
  const report = JSON.parse(reportText);
  const validation = await assertValidUiInspectionReport(report, {
    reportPath,
    repositoryPath: path.resolve(args.repository || report.run.repository || '.'),
    verifyAssets: true,
  });
  const reportRoot = path.dirname(reportPath);
  const diffContents = new Map();
  for (const finding of report.findings) {
    const artifact = finding.remediation.fixAssessment?.diffArtifact;
    if (!artifact || diffContents.has(artifact.sha256)) continue;
    const artifactPath = path.resolve(reportRoot, artifact.path);
    diffContents.set(artifact.sha256, await fs.readFile(artifactPath, 'utf8'));
  }
  const startIndex = template.indexOf(CONTENT_START);
  const endIndex = template.indexOf(CONTENT_END);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error('Run-local report template does not contain the required content markers.');
  }
  const content = renderReport(report, validation.derived, diffContents);
  const populated = `${template.slice(0, startIndex)}${content}${template.slice(endIndex + CONTENT_END.length)}`;
  await fs.writeFile(outputPath, populated);
  process.stdout.write(`${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
