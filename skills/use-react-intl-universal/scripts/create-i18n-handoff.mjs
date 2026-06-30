#!/usr/bin/env node

/*
 * Purpose:
 * Build a final i18n handoff report from the evidence files produced by this
 * skill's helper scripts.
 *
 * The report is meant for agents before they claim an i18n task is complete.
 * It combines project discovery, locale contract audit, hardcoded CJK scan,
 * export verification, fix task manifests, translation task manifests,
 * changed-key audits, and translation
 * delta review/merge results into one concise summary with explicit blockers
 * and review items.
 */

import fs from "node:fs";
import path from "node:path";
import {
  flattenStringMessages,
  parseCliArgs,
  readLocaleFile,
  relativePath,
  resolveFromCwd,
} from "./lib/i18n-audit.mjs";

const HARD_BLOCKER_TYPES = new Set([
  "invalid-json",
  "conflicting-default-message",
  "missing-locale-key",
  "locale-contract-mismatch",
  "non-string-locale-message",
]);

function printHelp() {
  console.log(`Usage:
  node skills/use-react-intl-universal/scripts/create-i18n-handoff.mjs --audit tmp/i18n-audit.json --discovery tmp/i18n-discovery.json

Options:
  --discovery PATH     Optional. JSON report from discover-project-i18n.mjs --json.
  --export-verify PATH Optional. JSON report from verify-locale-export.mjs --json.
  --audit PATH         Optional. JSON report from audit-i18n-contract.mjs --json.
  --hardcoded PATH     Optional. JSON report from find-hardcoded-cjk.mjs --json.
  --audit-fix-tasks PATH
                       Optional. manifest.json from create-audit-fix-tasks.mjs.
  --length-review-tasks PATH
                       Optional. manifest.json from create-audit-fix-tasks.mjs generated for long-translation review tasks.
  --hardcoded-fix-tasks PATH
                       Optional. manifest.json from create-hardcoded-cjk-fix-tasks.mjs.
  --tasks PATH         Optional. manifest.json from create-translation-tasks.mjs.
  --delta-review PATH  Optional. JSON report from review-translation-deltas.mjs --json.
  --translation-review-tasks PATH
                       Optional. manifest.json from create-translation-review-tasks.mjs.
  --apply PATH         Optional. JSON report from apply-translation-deltas.mjs --json.
  --changed-key-audit PATH
                       Optional. JSON report from audit-changed-locale-keys.mjs --json.
  --output PATH        Optional. Write Markdown handoff to this path.
  --json               Print machine-readable JSON instead of Markdown.
  --help               Show this help.
`);
}

function readJsonReport(filePath, label) {
  if (!filePath) {
    return { label, filePath: null, ok: false, missing: true, data: null, error: null };
  }

  const resolved = resolveFromCwd(String(filePath));
  try {
    return {
      label,
      filePath: resolved,
      ok: true,
      missing: false,
      data: JSON.parse(fs.readFileSync(resolved, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      label,
      filePath: resolved,
      ok: false,
      missing: false,
      data: null,
      error: error.message,
    };
  }
}

function countBy(items, getKey) {
  const counts = {};
  for (const item of items ?? []) {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function resolveMaybeAbsolute(filePath) {
  if (!filePath) {
    return null;
  }

  return path.isAbsolute(String(filePath))
    ? String(filePath)
    : resolveFromCwd(String(filePath));
}

function getCurrentLocaleMessageCount(filePath) {
  const resolved = resolveMaybeAbsolute(filePath);
  if (!resolved || !fs.existsSync(resolved)) {
    return { currentMessageCount: null, currentParseError: "file missing" };
  }

  const localeFile = readLocaleFile(resolved);
  if (localeFile.parseError) {
    return { currentMessageCount: null, currentParseError: localeFile.parseError.message };
  }

  return {
    currentMessageCount: Object.keys(flattenStringMessages(localeFile.json)).length,
    currentParseError: null,
  };
}

function summarizeLocaleReportFreshness(locale) {
  const current = getCurrentLocaleMessageCount(locale.filePath);
  const stale = (
    current.currentParseError
    || (
      Number.isFinite(locale.messageCount)
      && Number.isFinite(current.currentMessageCount)
      && locale.messageCount !== current.currentMessageCount
    )
  );

  return {
    locale: locale.locale,
    filePath: locale.filePath ? relativePath(resolveMaybeAbsolute(locale.filePath)) : null,
    messageCount: locale.messageCount,
    parseError: locale.parseError ?? null,
    currentMessageCount: current.currentMessageCount,
    currentParseError: current.currentParseError,
    stale: Boolean(stale),
  };
}

function getStaleLocaleReports(summary) {
  return (summary.locales ?? summary.localeSummaries ?? []).filter((locale) => locale.stale);
}

function summarizeDiscovery(report) {
  if (!report.ok) {
    return { available: false, issue: report.missing ? "missing" : report.error };
  }

  const data = report.data;
  const localeSupportChecks = (data.localeSupportChecks ?? []).map((check) => ({
    packageName: check.packageName,
    available: Boolean(check.available),
    source: check.source ? relativePath(check.source) : null,
    supportedLocales: check.supportedLocales ?? [],
    expected: (check.expected ?? []).map((item) => ({
      locale: item.locale,
      packageLocale: item.packageLocale,
      supported: item.supported,
    })),
  }));
  const unsupportedExpectedLocales = localeSupportChecks
    .flatMap((check) => (check.expected ?? [])
      .filter((item) => item.supported === false)
      .map((item) => ({
        packageName: check.packageName,
        locale: item.locale,
        packageLocale: item.packageLocale,
        source: check.source ? relativePath(check.source) : null,
      })));

  return {
    available: true,
    filePath: relativePath(report.filePath),
    dependencies: data.dependencies ?? {},
    scripts: (data.scripts ?? []).map((script) => ({
      name: script.name,
      command: script.command,
      exportLanguages: script.exportLanguages ?? [],
    })),
    commands: data.commands ?? {},
    locales: (data.localeSummaries ?? []).map(summarizeLocaleReportFreshness),
    connectionPointCount: data.connectionPoints?.length ?? 0,
    localeSupportChecks,
    unsupportedExpectedLocales,
    recommendations: data.recommendations ?? [],
  };
}

function summarizeAudit(report) {
  if (!report.ok) {
    return { available: false, issue: report.missing ? "missing" : report.error };
  }

  const data = report.data;
  const issues = data.issues ?? [];
  const warnings = data.warnings ?? [];
  const hardBlockers = issues.filter((issue) => HARD_BLOCKER_TYPES.has(issue.type));
  const warningCounts = countBy(warnings, (warning) => warning.type);
  const highLengthWarnings = warnings.filter((warning) => (
    warning.type === "long-translation"
    && warning.lengthRisk?.severity === "high"
  ));

  return {
    available: true,
    filePath: relativePath(report.filePath),
    defaultLocale: data.defaultLocale ?? null,
    sourceMessageCount: data.sourceMessageCount ?? data.messageCount ?? 0,
    messageCount: data.messageCount ?? 0,
    issueCount: issues.length,
    warningCount: warnings.length,
    issueCounts: countBy(issues, (issue) => issue.type),
    warningCounts,
    hardBlockerCount: hardBlockers.length,
    highLengthWarningCount: highLengthWarnings.length,
    topBlockers: hardBlockers.slice(0, 8).map((issue) => ({
      type: issue.type,
      key: issue.key ?? null,
      locale: issue.locale ?? null,
      filePath: issue.filePath ? relativePath(issue.filePath) : null,
      line: issue.line ?? null,
      message: issue.message,
    })),
  };
}

function summarizeExportVerify(report) {
  if (!report.ok) {
    return { available: false, issue: report.missing ? "missing" : report.error };
  }

  const data = report.data;
  return {
    available: true,
    filePath: relativePath(report.filePath),
    status: data.status ?? "unknown",
    localesPath: data.localesPath ? relativePath(data.localesPath) : null,
    expectedLocales: data.expectedLocales ?? [],
    issueCount: data.issueCount ?? data.issues?.length ?? 0,
    warningCount: data.warningCount ?? data.warnings?.length ?? 0,
    issues: (data.issues ?? []).slice(0, 8).map((issue) => ({
      type: issue.type,
      locale: issue.locale ?? null,
      message: issue.message,
    })),
    localeSummaries: (data.localeSummaries ?? []).map(summarizeLocaleReportFreshness),
  };
}

function normalizeReportPath(filePath) {
  return relativePath(filePath).split(path.sep).join("/");
}

function matchesIgnorePattern(filePath, ignorePatterns) {
  if (!filePath || !ignorePatterns || ignorePatterns.length === 0) {
    return false;
  }

  const normalized = normalizeReportPath(filePath);
  return ignorePatterns.some((pattern) => normalized.includes(pattern));
}

function summarizeHardcoded(report, ignorePatterns = []) {
  if (!report.ok) {
    return { available: false, issue: report.missing ? "missing" : report.error };
  }

  const data = report.data;
  const candidates = data.candidates ?? [];
  const actionableCandidates = ignorePatterns.length > 0
    ? candidates.filter((candidate) => !matchesIgnorePattern(candidate.filePath, ignorePatterns))
    : candidates;
  const toCandidateSummary = (candidate) => ({
    priority: candidate.priority,
    kind: candidate.kind,
    filePath: candidate.filePath ? relativePath(candidate.filePath) : null,
    line: candidate.line,
    text: candidate.text,
  });

  return {
    available: true,
    filePath: relativePath(report.filePath),
    fileCount: data.fileCount ?? 0,
    candidateCount: data.candidateCount ?? candidates.length,
    counts: data.priorityCounts ?? data.counts ?? countBy(candidates, (candidate) => candidate.priority),
    priorityCounts: data.priorityCounts ?? data.counts ?? countBy(candidates, (candidate) => candidate.priority),
    kindCounts: data.kindCounts ?? countBy(candidates, (candidate) => candidate.kind),
    actionableCandidateCount: actionableCandidates.length,
    actionableCounts: countBy(actionableCandidates, (candidate) => candidate.priority),
    ignoredCandidateCount: candidates.length - actionableCandidates.length,
    appliedIgnorePatterns: ignorePatterns,
    topCandidates: actionableCandidates.slice(0, 8).map(toCandidateSummary),
    rawTopCandidates: candidates.slice(0, 8).map(toCandidateSummary),
  };
}

function summarizeAuditFixTasks(report) {
  if (!report.ok) {
    return { available: false, issue: report.missing ? "missing" : report.error };
  }

  const data = report.data;
  const taskFiles = data.taskFiles ?? [];
  return {
    available: true,
    filePath: relativePath(report.filePath),
    auditPath: data.auditPath ?? null,
    outputPath: data.outputPath ?? null,
    sourcePath: data.sourcePath ?? null,
    localesPath: data.localesPath ?? null,
    defaultLocale: data.defaultLocale ?? null,
    issueCount: data.issueCount ?? null,
    warningCount: data.warningCount ?? null,
    issueCounts: data.issueCounts ?? {},
    warningCounts: data.warningCounts ?? {},
    includedWarningTypes: data.includedWarningTypes ?? [],
    warningSeverities: data.warningSeverities ?? [],
    warningsOnly: Boolean(data.warningsOnly),
    hardBlockerIssueCount: data.hardBlockerIssueCount ?? null,
    hardBlockerCoveredIssueCount: data.hardBlockerCoveredIssueCount ?? null,
    hardBlockerCoverageComplete: data.hardBlockerCoverageComplete ?? null,
    typeCoverage: data.typeCoverage ?? {},
    hardBlockerTaskCount: data.hardBlockerTaskCount ?? taskFiles.reduce((total, task) => total + (task.itemCount ?? 0), 0),
    advisoryTaskCount: data.advisoryTaskCount ?? 0,
    taskFileCount: taskFiles.length,
    maxItemsPerTask: data.maxItemsPerTask ?? null,
    taskTypeCounts: countBy(taskFiles, (task) => task.type ?? "unknown"),
    taskFiles: taskFiles.slice(0, 8).map((task) => ({
      type: task.type ?? null,
      batchIndex: task.batchIndex,
      batchCount: task.batchCount,
      itemCount: task.itemCount,
      jsonPath: task.jsonPath,
      markdownPath: task.markdownPath,
    })),
  };
}

function summarizeLengthReviewTasks(report) {
  if (!report.ok) {
    return { available: false, issue: report.missing ? "missing" : report.error };
  }

  const data = report.data;
  const taskFiles = data.taskFiles ?? [];
  const taskTypeCounts = data.taskTypeCounts ?? countBy(taskFiles, (task) => task.type ?? "unknown");
  const longTranslationFiles = taskFiles.filter((task) => task.type === "long-translation");
  const longTranslationCoverage = data.typeCoverage?.["long-translation"] ?? null;
  const longTranslationTaskItemCount = longTranslationCoverage?.taskItemCount
    ?? longTranslationFiles.reduce((total, task) => total + (task.itemCount ?? 0), 0);
  const longTranslationSourceCount = longTranslationCoverage?.sourceCount
    ?? data.warningCounts?.["long-translation"]
    ?? null;
  const longTranslationCoveredCount = longTranslationCoverage?.coveredCount
    ?? (longTranslationSourceCount === null ? null : longTranslationTaskItemCount);

  return {
    available: true,
    filePath: relativePath(report.filePath),
    auditPath: data.auditPath ?? null,
    outputPath: data.outputPath ?? null,
    sourcePath: data.sourcePath ?? null,
    localesPath: data.localesPath ?? null,
    defaultLocale: data.defaultLocale ?? null,
    includedWarningTypes: data.includedWarningTypes ?? [],
    warningSeverities: data.warningSeverities ?? [],
    warningsOnly: Boolean(data.warningsOnly),
    advisoryTaskCount: data.advisoryTaskCount ?? taskFiles.reduce((total, task) => total + (task.itemCount ?? 0), 0),
    taskFileCount: data.taskFileCount ?? taskFiles.length,
    longTranslationTaskFileCount: longTranslationFiles.length,
    maxItemsPerTask: data.maxItemsPerTask ?? null,
    taskTypeCounts,
    longTranslationTaskItemCount,
    longTranslationSourceCount,
    longTranslationCoveredCount,
    coverageComplete: longTranslationCoverage?.coverageComplete ?? null,
    taskFiles: longTranslationFiles.slice(0, 8).map((task) => ({
      type: task.type ?? null,
      batchIndex: task.batchIndex,
      batchCount: task.batchCount,
      itemCount: task.itemCount,
      jsonPath: task.jsonPath,
      markdownPath: task.markdownPath,
    })),
  };
}

function summarizeHardcodedFixTasks(report) {
  if (!report.ok) {
    return { available: false, issue: report.missing ? "missing" : report.error };
  }

  const data = report.data;
  const taskFiles = data.taskFiles ?? [];
  return {
    available: true,
    filePath: relativePath(report.filePath),
    hardcodedPath: data.hardcodedPath ?? null,
    outputPath: data.outputPath ?? null,
    priorities: data.priorities ?? [],
    ignorePatterns: data.ignorePatterns ?? [],
    sourceCandidateCount: data.sourceCandidateCount ?? null,
    taskItemCount: data.taskItemCount ?? taskFiles.reduce((total, task) => total + (task.itemCount ?? 0), 0),
    taskFileCount: data.taskFileCount ?? taskFiles.length,
    maxItemsPerTask: data.maxItemsPerTask ?? null,
    taskFiles: taskFiles.slice(0, 8).map((task) => ({
      filePath: task.filePath ?? null,
      batchIndex: task.batchIndex,
      batchCount: task.batchCount,
      itemCount: task.itemCount,
      jsonPath: task.jsonPath,
      markdownPath: task.markdownPath,
    })),
  };
}

function summarizeTasks(report) {
  if (!report.ok) {
    return { available: false, issue: report.missing ? "missing" : report.error };
  }

  const data = report.data;
  return {
    available: true,
    filePath: relativePath(report.filePath),
    defaultLocale: data.defaultLocale ?? null,
    changedDefaultItemCount: data.changedDefaultItemCount ?? 0,
    targetLocaleCount: data.targetLocaleCount ?? 0,
    taskItemCount: data.taskItemCount ?? (data.taskFiles ?? []).reduce((total, task) => total + (task.itemCount ?? 0), 0),
    maxItemsPerTask: data.maxItemsPerTask ?? null,
    sortMode: data.sortMode ?? null,
    referenceTranslationItemCount: data.referenceTranslationItemCount ?? 0,
    referenceTranslationLocales: data.referenceTranslationLocales ?? [],
    commentedSourceItemCount: data.commentedSourceItemCount ?? 0,
    taskSize: data.taskSize ?? null,
    taskFileCount: data.taskFiles?.length ?? 0,
    taskFiles: (data.taskFiles ?? []).slice(0, 8).map((task) => ({
      locale: task.locale,
      batchIndex: task.batchIndex,
      batchCount: task.batchCount,
      itemCount: task.itemCount,
      jsonPath: task.jsonPath,
      markdownPath: task.markdownPath,
      jsonBytes: task.jsonBytes,
      markdownBytes: task.markdownBytes,
    })),
  };
}

function summarizeTranslationReviewTasks(report) {
  if (!report.ok) {
    return { available: false, issue: report.missing ? "missing" : report.error };
  }

  const data = report.data;
  const taskFiles = data.taskFiles ?? [];
  return {
    available: true,
    filePath: relativePath(report.filePath),
    reviewPath: data.reviewPath ?? null,
    deltasPath: data.deltasPath ?? null,
    outputPath: data.outputPath ?? null,
    reviewStatus: data.reviewStatus ?? "unknown",
    sourceIssueCount: data.sourceIssueCount ?? 0,
    sourceWarningCount: data.sourceWarningCount ?? 0,
    reviewedDeltaEntryCount: data.reviewedDeltaEntryCount ?? 0,
    taskItemCount: data.taskItemCount ?? taskFiles.reduce((total, task) => total + (task.itemCount ?? 0), 0),
    reasonCounts: data.reasonCounts ?? {},
    taskFileCount: data.taskFileCount ?? taskFiles.length,
    includeAll: Boolean(data.includeAll),
    includeUiRisks: data.includeUiRisks ?? [],
    maxItemsPerTask: data.maxItemsPerTask ?? null,
    taskFiles: taskFiles.slice(0, 8).map((task) => ({
      locale: task.locale,
      batchIndex: task.batchIndex,
      batchCount: task.batchCount,
      itemCount: task.itemCount,
      jsonPath: task.jsonPath,
      markdownPath: task.markdownPath,
    })),
  };
}

function summarizeApply(report) {
  if (!report.ok) {
    return { available: false, issue: report.missing ? "missing" : report.error };
  }

  const data = report.data;
  const results = data.results ?? [];
  const skipped = results.flatMap((result) => (
    (result.skipped ?? []).map((item) => ({
      locale: result.locale,
      key: item.key,
      reason: item.reason,
    }))
  ));

  return {
    available: true,
    filePath: relativePath(report.filePath),
    dryRun: Boolean(data.dryRun),
    allowPartial: Boolean(data.allowPartial),
    wroteFiles: Boolean(data.wroteFiles),
    issueCount: data.issues?.length ?? 0,
    skippedCount: skipped.length,
    results: results.map((result) => ({
      locale: result.locale,
      updated: result.updated,
      deleted: result.deleted,
      skipped: result.skipped?.length ?? 0,
      created: Boolean(result.created),
    })),
    skipped: skipped.slice(0, 8),
  };
}

function summarizeDeltaReview(report) {
  if (!report.ok) {
    return { available: false, issue: report.missing ? "missing" : report.error };
  }

  const data = report.data;
  return {
    available: true,
    filePath: relativePath(report.filePath),
    status: data.status ?? "unknown",
    defaultLocale: data.defaultLocale ?? null,
    deltaFileCount: data.deltaFileCount ?? data.deltaFiles?.length ?? 0,
    reviewedEntryCount: data.reviewedEntryCount ?? 0,
    taskFileCount: data.taskFileCount ?? data.taskFiles?.length ?? 0,
    expectedItemCount: data.expectedItemCount ?? 0,
    issueCount: data.issueCount ?? data.issues?.length ?? 0,
    warningCount: data.warningCount ?? data.warnings?.length ?? 0,
    issueCounts: data.issueCounts ?? {},
    warningCounts: data.warningCounts ?? {},
    issues: (data.issues ?? []).slice(0, 8).map((issue) => ({
      type: issue.type,
      locale: issue.locale ?? null,
      key: issue.key ?? null,
      message: issue.message,
    })),
    warnings: (data.warnings ?? []).slice(0, 8).map((warning) => ({
      type: warning.type,
      severity: warning.severity ?? null,
      locale: warning.locale ?? null,
      key: warning.key ?? null,
      message: warning.message,
    })),
  };
}

function summarizeChangedKeyAudit(report) {
  if (!report.ok) {
    return { available: false, issue: report.missing ? "missing" : report.error };
  }

  const data = report.data;
  const keys = data.keys ?? [];
  const issueEntries = [];
  const warningEntries = [];

  for (const key of keys) {
    for (const locale of key.locales ?? []) {
      for (const issue of locale.issues ?? []) {
        issueEntries.push({
          type: issue.type,
          key: key.key,
          keyType: key.type,
          locale: locale.locale,
          filePath: locale.filePath,
          line: locale.line ?? null,
          message: issue.message,
        });
      }
      for (const warning of locale.warnings ?? []) {
        warningEntries.push({
          type: warning.type,
          key: key.key,
          keyType: key.type,
          locale: locale.locale,
          filePath: locale.filePath,
          line: locale.line ?? null,
          message: warning.message,
          severity: warning.lengthRisk?.severity ?? null,
          uiRisk: warning.lengthRisk?.uiRisk ?? null,
          ratio: warning.lengthRisk?.ratio ?? null,
        });
      }
    }
  }

  return {
    available: true,
    filePath: relativePath(report.filePath),
    status: data.status ?? "unknown",
    tasks: data.tasks ?? null,
    localesPath: data.localesPath ?? null,
    defaultLocale: data.defaultLocale ?? null,
    locales: data.locales ?? [],
    changedKeyCount: data.changedKeyCount ?? keys.length,
    issueCount: data.issueCount ?? issueEntries.length,
    warningCount: data.warningCount ?? warningEntries.length,
    issueCounts: countBy(issueEntries, (issue) => issue.type),
    warningCounts: countBy(warningEntries, (warning) => warning.type),
    issueKeyCount: new Set(issueEntries.map((issue) => issue.key)).size,
    warningKeyCount: new Set(warningEntries.map((warning) => warning.key)).size,
    topIssues: issueEntries.slice(0, 8),
    topWarnings: warningEntries.slice(0, 8),
  };
}

function pushAction(actions, priority, action, reason, evidence = []) {
  actions.push({
    priority,
    action,
    reason,
    evidence: evidence.filter(Boolean),
  });
}

function hasLocaleReadinessBlocker({
  discovery,
  exportVerify,
}) {
  return Boolean(
    (exportVerify.available && exportVerify.status === "failed")
    || (discovery.available && discovery.unsupportedExpectedLocales.length > 0)
  );
}

function isMissingDeltasOnly(deltaReview) {
  if (!deltaReview.available || deltaReview.issueCount <= 0) {
    return false;
  }

  return deltaReview.issueCounts["missing-deltas-directory"] === deltaReview.issueCount;
}

function getTranslationTaskReviewMismatch(tasks, deltaReview) {
  if (!tasks.available || !deltaReview.available) {
    return null;
  }

  if (!Number.isFinite(tasks.taskItemCount) || !Number.isFinite(deltaReview.expectedItemCount)) {
    return null;
  }

  return tasks.taskItemCount === deltaReview.expectedItemCount
    ? null
    : {
      taskItemCount: tasks.taskItemCount,
      expectedItemCount: deltaReview.expectedItemCount,
    };
}

function createDeferredStages({ localeReadinessBlocked, deltaReview }) {
  if (!(localeReadinessBlocked && isMissingDeltasOnly(deltaReview))) {
    return [];
  }

  const reason = "Translation deltas are not generated yet; resolve locale export or runtime locale blockers before broad translation work.";
  return [
    {
      stage: "translation-deltas",
      reason,
    },
    {
      stage: "translation-quality-review",
      reason,
    },
    {
      stage: "delta-merge",
      reason,
    },
  ];
}

function selectTaskFileSamplesByType(taskFiles, limit = 3, includeTask = () => true) {
  const candidates = taskFiles.filter((task) => (
    task.markdownPath
    && includeTask(task)
  ));
  const samples = [];
  const sampledTypes = new Set();

  for (const task of candidates) {
    if (sampledTypes.has(task.type)) {
      continue;
    }

    samples.push(task.markdownPath);
    sampledTypes.add(task.type);
    if (samples.length >= limit) {
      return samples;
    }
  }

  for (const task of candidates) {
    if (samples.includes(task.markdownPath)) {
      continue;
    }

    samples.push(task.markdownPath);
    if (samples.length >= limit) {
      return samples;
    }
  }

  return samples;
}

function selectAdvisoryTaskFileSamples(taskFiles, limit = 3) {
  return selectTaskFileSamplesByType(
    taskFiles,
    limit,
    (task) => !HARD_BLOCKER_TYPES.has(task.type)
  );
}

function createNextActions({
  discovery,
  exportVerify,
  audit,
  hardcoded,
  auditFixTasks,
  lengthReviewTasks,
  hardcodedFixTasks,
  tasks,
  deltaReview,
  translationReviewTasks,
  apply,
  changedKeyAudit,
}) {
  const actions = [];
  const localeReadinessBlocked = hasLocaleReadinessBlocker({
    discovery,
    exportVerify,
  });

  if (discovery.available && discovery.unsupportedExpectedLocales.length > 0) {
    pushAction(
      actions,
      "P0",
      "Resolve unsupported runtime locale providers.",
      "Discovery found provider packages that cannot expose the expected locale.",
      discovery.unsupportedExpectedLocales.slice(0, 3).map((item) => `${item.packageName}:${item.locale} source=${item.source ?? "-"}`)
    );
  }

  if (exportVerify.available && exportVerify.status === "failed") {
    pushAction(
      actions,
      "P0",
      "Fix locale export output and rerun export verification.",
      "The expected locale files were not generated, so translation merge and runtime loading cannot be trusted.",
      exportVerify.issues.map((issue) => `${issue.type}:${issue.locale ?? "-"} ${issue.message}`)
    );
  }

  const staleDiscoveryLocales = discovery.available ? getStaleLocaleReports(discovery) : [];
  const staleExportLocales = exportVerify.available ? getStaleLocaleReports(exportVerify) : [];
  if (staleDiscoveryLocales.length > 0 || staleExportLocales.length > 0) {
    pushAction(
      actions,
      "P2",
      "Regenerate stale discovery/export verification reports.",
      "Locale files changed after earlier evidence reports were generated, so counts and downstream decisions may be stale.",
      [
        ...staleDiscoveryLocales.slice(0, 3).map((locale) => `discovery:${locale.locale} report=${locale.messageCount} current=${locale.currentMessageCount ?? locale.currentParseError}`),
        ...staleExportLocales.slice(0, 3).map((locale) => `export:${locale.locale} report=${locale.messageCount} current=${locale.currentMessageCount ?? locale.currentParseError}`),
      ]
    );
  }

  if (audit.available && audit.hardBlockerCount > 0) {
    pushAction(
      actions,
      "P1",
      "Fix locale audit hard blockers using generated audit fix tasks.",
      "Missing keys, conflicting defaults, and contract mismatches can break rendering or extraction.",
      [
        `hardBlockers=${audit.hardBlockerCount}`,
        auditFixTasks.available ? `fixTasks=${auditFixTasks.taskFileCount}` : "audit fix task manifest missing",
        auditFixTasks.available && auditFixTasks.hardBlockerIssueCount !== null
          ? `covered=${auditFixTasks.hardBlockerCoveredIssueCount}/${auditFixTasks.hardBlockerIssueCount}`
          : null,
        ...audit.topBlockers.slice(0, 3).map((item) => `${item.type}:${item.key ?? "-"} ${item.filePath ?? "-"}`),
      ]
    );
  }

  if (auditFixTasks.available && auditFixTasks.advisoryTaskCount > 0) {
    const advisoryTaskFiles = selectAdvisoryTaskFileSamples(auditFixTasks.taskFiles, 3);

    pushAction(
      actions,
      "P3",
      "Review generated advisory i18n tasks.",
      "Advisory warning tasks are not release blockers, but they capture best-practice migrations such as ICU defaults and getHTML removal.",
      [
        `advisoryItems=${auditFixTasks.advisoryTaskCount}`,
        `warningTypes=${auditFixTasks.includedWarningTypes.join(",") || "-"}`,
        `taskFiles=${auditFixTasks.taskFileCount}`,
        ...advisoryTaskFiles,
      ]
    );
  }

  if (lengthReviewTasks.available && lengthReviewTasks.longTranslationTaskItemCount > 0) {
    pushAction(
      actions,
      "P2",
      "Review high-severity translation length tasks before claiming UI quality.",
      "Long-translation warnings need UI-context judgment: shorten non-default locale copy when meaning is preserved, or adjust layout when accurate wording must stay longer.",
      [
        `reviewItems=${lengthReviewTasks.longTranslationTaskItemCount}`,
        lengthReviewTasks.longTranslationSourceCount === null
          ? null
          : `covered=${lengthReviewTasks.longTranslationCoveredCount}/${lengthReviewTasks.longTranslationSourceCount}`,
        `longTranslationTaskFiles=${lengthReviewTasks.longTranslationTaskFileCount}`,
        ...lengthReviewTasks.taskFiles.slice(0, 3).map((task) => task.markdownPath),
      ]
    );
  } else if (
    audit.available
    && audit.highLengthWarningCount > 0
    && !(auditFixTasks.available && auditFixTasks.includedWarningTypes.includes("long-translation"))
  ) {
    pushAction(
      actions,
      "P2",
      "Generate length review tasks for high-severity translation length warnings.",
      "The audit found compact-UI length risks, but no long-translation task manifest was provided for batch review.",
      [
        `highLengthWarnings=${audit.highLengthWarningCount}`,
        "run create-audit-fix-tasks.mjs --include-warnings long-translation --warning-severity high",
      ]
    );
  }

  if (
    audit.available
    && (audit.warningCounts["template-default-message"] ?? 0) > 0
    && !(auditFixTasks.available && auditFixTasks.includedWarningTypes.includes("template-default-message"))
  ) {
    pushAction(
      actions,
      "P3",
      "Generate advisory tasks for JavaScript template interpolation inside .d().",
      ".d(defaultMessage) should use ICU placeholders so extracted default messages and locale-pack messages behave consistently.",
      [
        `templateDefaultWarnings=${audit.warningCounts["template-default-message"]}`,
        "run create-audit-fix-tasks.mjs --include-warnings template-default-message --warnings-only",
      ]
    );
  }

  if (
    audit.available
    && (audit.warningCounts["deprecated-getHTML"] ?? 0) > 0
    && !(auditFixTasks.available && auditFixTasks.includedWarningTypes.includes("deprecated-getHTML"))
  ) {
    pushAction(
      actions,
      "P3",
      "Plan deprecated intl.getHTML migration tasks.",
      "React UI should prefer rich tag formatters with intl.get so translated rich text stays in React components instead of HTML strings.",
      [
        `deprecatedGetHTMLWarnings=${audit.warningCounts["deprecated-getHTML"]}`,
        "run create-audit-fix-tasks.mjs --include-warnings deprecated-getHTML --warnings-only",
      ]
    );
  }

  if (hardcoded.available && (hardcoded.actionableCounts.high ?? hardcoded.counts.high ?? 0) > 0) {
    pushAction(
      actions,
      "P1",
      "Review high-priority hardcoded CJK candidates.",
      "Visible hardcoded CJK text will not participate in locale switching or extraction.",
      [
        `high=${hardcoded.actionableCounts.high ?? hardcoded.counts.high}`,
        hardcodedFixTasks.available ? `fixTasks=${hardcodedFixTasks.taskFileCount}` : "hardcoded fix task manifest missing",
      ]
    );
  }

  const taskReviewMismatch = getTranslationTaskReviewMismatch(tasks, deltaReview);
  if (taskReviewMismatch) {
    pushAction(
      actions,
      "P2",
      "Rerun translation delta review with the current translation task manifest.",
      "The translation task manifest changed after the delta review report was generated, so expected item counts are stale.",
      [
        `taskItems=${taskReviewMismatch.taskItemCount}`,
        `deltaReviewExpectedItems=${taskReviewMismatch.expectedItemCount}`,
      ]
    );
  }

  if (
    tasks.available
    && deltaReview.available
    && deltaReview.issueCounts["missing-deltas-directory"]
    && !localeReadinessBlocked
  ) {
    pushAction(
      actions,
      "P2",
      "Create translation delta JSON files from the generated translation tasks.",
      "No returned delta directory exists yet, so translation review and merge cannot start.",
      [
        `expectedItems=${deltaReview.expectedItemCount}`,
        `taskFiles=${tasks.taskFileCount}`,
        ...tasks.taskFiles.slice(0, 3).map((task) => task.jsonPath),
      ]
    );
  } else if (
    deltaReview.available
    && deltaReview.issueCount > 0
    && !(localeReadinessBlocked && isMissingDeltasOnly(deltaReview))
  ) {
    pushAction(
      actions,
      "P2",
      "Fix translation delta review issues before merge.",
      "Delta issues are deterministic merge blockers.",
      [
        `issues=${deltaReview.issueCount}`,
        `issueTypes=${formatCounts(deltaReview.issueCounts)}`,
      ]
    );
  }

  if (changedKeyAudit.available && changedKeyAudit.issueCount > 0) {
    pushAction(
      actions,
      "P1",
      "Fix changed-key locale synchronization issues.",
      "The post-merge changed-key audit found missing keys, deleted-key residue, invalid locale files, or ICU/rich-tag contract mismatches.",
      [
        `changedKeys=${changedKeyAudit.changedKeyCount}`,
        `issueKeys=${changedKeyAudit.issueKeyCount}`,
        `issues=${formatCounts(changedKeyAudit.issueCounts)}`,
        ...changedKeyAudit.topIssues.slice(0, 3).map((issue) => `${issue.type}:${issue.locale}:${issue.key} ${issue.filePath ?? "-"}`),
      ]
    );
  }

  if (changedKeyAudit.available && changedKeyAudit.warningCount > 0) {
    pushAction(
      actions,
      "P2",
      "Review changed-key compact UI length warnings.",
      "Changed non-default translations may be too long for compact UI; inspect actual source usage before shortening text or changing layout.",
      [
        `warningKeys=${changedKeyAudit.warningKeyCount}`,
        `warnings=${formatCounts(changedKeyAudit.warningCounts)}`,
        ...changedKeyAudit.topWarnings.slice(0, 3).map((warning) => `${warning.type}/${warning.severity ?? "-"}:${warning.locale}:${warning.key} ratio=${warning.ratio ?? "-"}`),
      ]
    );
  }

  if (tasks.available && tasks.taskSize?.warnings?.length > 0) {
    const firstWarning = tasks.taskSize.warnings[0];
    pushAction(
      actions,
      "P3",
      "Regenerate oversized translation tasks with smaller batches before assigning subagents.",
      "Large task files are harder for agents to read and review accurately; smaller batches keep source context while reducing prompt load.",
      [
        `largeMarkdownTaskCount=${tasks.taskSize.largeMarkdownTaskCount}`,
        `maxMarkdownBytes=${tasks.taskSize.maxMarkdownBytes}`,
        `recommendedMaxItemsPerTask=${firstWarning.recommendedMaxItemsPerTask ?? tasks.taskSize.recommendedMaxItemsPerTask ?? "-"}`,
      ]
    );
  }

  if (deltaReview.available && deltaReview.issueCount === 0 && deltaReview.warningCount > 0 && !translationReviewTasks.available) {
    pushAction(
      actions,
      "P2",
      "Generate translation quality review tasks for delta warnings.",
      "Warnings require human or agent judgment for naturalness, terminology, copied defaults, CJK, or UI fit.",
      [`warnings=${deltaReview.warningCount}`, `warningTypes=${formatCounts(deltaReview.warningCounts)}`]
    );
  }

  if (translationReviewTasks.available && translationReviewTasks.taskItemCount > 0) {
    pushAction(
      actions,
      "P2",
      "Complete translation quality review tasks before applying deltas.",
      "The translations need subjective review for meaning, terminology, or compact UI fit.",
      [
        `reviewItems=${translationReviewTasks.taskItemCount}`,
        `reasonCounts=${formatCounts(translationReviewTasks.reasonCounts)}`,
        ...translationReviewTasks.taskFiles.slice(0, 3).map((task) => task.markdownPath),
      ]
    );
  }

  if (apply.available && (apply.issueCount > 0 || apply.skippedCount > 0)) {
    pushAction(
      actions,
      "P1",
      "Resolve delta merge issues and rerun apply-translation-deltas.",
      "Skipped entries or apply issues mean locale files were not safely updated.",
      [`issues=${apply.issueCount}`, `skipped=${apply.skippedCount}`]
    );
  }

  if (actions.length === 0) {
    pushAction(
      actions,
      "P3",
      "Run final project validation and focused UI smoke checks.",
      "No next action was derived from provided reports; final validation is still required before completion.",
      []
    );
  }

  const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return actions.sort((a, b) => (
    (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
  ));
}

function createHandoff(reports) {
  const discovery = summarizeDiscovery(reports.discovery);
  const exportVerify = summarizeExportVerify(reports.exportVerify);
  const audit = summarizeAudit(reports.audit);
  const hardcodedFixTasks = summarizeHardcodedFixTasks(reports.hardcodedFixTasks);
  const hardcoded = summarizeHardcoded(
    reports.hardcoded,
    hardcodedFixTasks.available ? hardcodedFixTasks.ignorePatterns : []
  );
  const auditFixTasks = summarizeAuditFixTasks(reports.auditFixTasks);
  const lengthReviewTasks = summarizeLengthReviewTasks(reports.lengthReviewTasks);
  const tasks = summarizeTasks(reports.tasks);
  const deltaReview = summarizeDeltaReview(reports.deltaReview);
  const translationReviewTasks = summarizeTranslationReviewTasks(reports.translationReviewTasks);
  const apply = summarizeApply(reports.apply);
  const changedKeyAudit = summarizeChangedKeyAudit(reports.changedKeyAudit);
  const blockers = [];
  const reviewItems = [];
  const localeReadinessBlocked = hasLocaleReadinessBlocker({
    discovery,
    exportVerify,
  });
  const deferredStages = createDeferredStages({
    localeReadinessBlocked,
    deltaReview,
  });
  const taskReviewMismatch = getTranslationTaskReviewMismatch(tasks, deltaReview);
  const staleDiscoveryLocales = discovery.available ? getStaleLocaleReports(discovery) : [];
  const staleExportLocales = exportVerify.available ? getStaleLocaleReports(exportVerify) : [];

  if (audit.available && audit.hardBlockerCount > 0) {
    blockers.push(`Audit has ${audit.hardBlockerCount} hard blocker(s): invalid JSON, conflicting defaults, missing locale keys, or contract mismatches.`);
  }

  if (exportVerify.available && exportVerify.status === "failed") {
    blockers.push(`Locale export verification failed with ${exportVerify.issueCount} issue(s).`);
  }

  if (discovery.available && discovery.unsupportedExpectedLocales.length > 0) {
    const details = discovery.unsupportedExpectedLocales
      .map((item) => {
        const source = item.source ? ` source=${item.source}` : "";
        return `${item.packageName}:${item.locale} (${item.packageLocale}${source})`;
      })
      .join(", ");
    blockers.push(`Expected locale support is missing in runtime/provider packages: ${details}.`);
  }

  if (apply.available && (apply.issueCount > 0 || apply.skippedCount > 0)) {
    blockers.push(`Delta merge has ${apply.issueCount} issue(s) and ${apply.skippedCount} skipped entries.`);
  }

  if (changedKeyAudit.available && changedKeyAudit.issueCount > 0) {
    blockers.push(`Changed-key audit failed with ${changedKeyAudit.issueCount} issue(s) across ${changedKeyAudit.issueKeyCount} key(s).`);
  }

  if (deltaReview.available && deltaReview.issueCount > 0) {
    if (localeReadinessBlocked && isMissingDeltasOnly(deltaReview)) {
      reviewItems.push("Translation deltas are not generated yet; defer broad translation until locale export or runtime locale blockers are resolved.");
    } else {
      blockers.push(`Translation delta review failed with ${deltaReview.issueCount} issue(s).`);
    }
  }

  if (deltaReview.available && deltaReview.issueCount === 0 && deltaReview.warningCount > 0) {
    reviewItems.push(`Review ${deltaReview.warningCount} translation delta warning(s) before merging.`);
  }

  if (deltaReview.available && deltaReview.warningCount > 0 && !translationReviewTasks.available) {
    reviewItems.push("Translation delta warnings exist, but no translation quality review task manifest was provided.");
  }

  if (changedKeyAudit.available && changedKeyAudit.issueCount === 0 && changedKeyAudit.warningCount > 0) {
    reviewItems.push(`Review ${changedKeyAudit.warningCount} changed-key warning(s), especially compact UI length risks.`);
  }

  if (staleDiscoveryLocales.length > 0) {
    const details = staleDiscoveryLocales
      .map((locale) => `${locale.locale} report=${locale.messageCount} current=${locale.currentMessageCount ?? locale.currentParseError}`)
      .join(", ");
    reviewItems.push(`Discovery report locale counts are stale: ${details}. Regenerate discover-project-i18n.mjs output after locale files change.`);
  }

  if (staleExportLocales.length > 0) {
    const details = staleExportLocales
      .map((locale) => `${locale.locale} report=${locale.messageCount} current=${locale.currentMessageCount ?? locale.currentParseError}`)
      .join(", ");
    reviewItems.push(`Export verification report locale counts are stale: ${details}. Rerun verify-locale-export.mjs after locale files change.`);
  }

  if (taskReviewMismatch) {
    reviewItems.push(`Translation delta review report is stale: current translation tasks contain ${taskReviewMismatch.taskItemCount} item(s), but the review expected ${taskReviewMismatch.expectedItemCount}. Rerun review-translation-deltas.mjs after regenerating tasks.`);
  }

  if (discovery.available && discovery.recommendations.length > 0) {
    reviewItems.push(...discovery.recommendations);
  }

  if (audit.available && audit.highLengthWarningCount > 0) {
    if (lengthReviewTasks.available && lengthReviewTasks.longTranslationTaskItemCount > 0) {
      reviewItems.push(`Review ${lengthReviewTasks.longTranslationTaskItemCount} generated translation length review task item(s) for compact UI.`);
    } else {
      reviewItems.push(`Review ${audit.highLengthWarningCount} high-severity translation length warning(s) in compact UI.`);
    }
  }

  if (hardcoded.available && (hardcoded.actionableCounts.high ?? hardcoded.counts.high ?? 0) > 0) {
    const highCount = hardcoded.actionableCounts.high ?? hardcoded.counts.high;
    const qualifier = hardcoded.ignoredCandidateCount > 0 ? " actionable" : "";
    reviewItems.push(`Review ${highCount} high-priority${qualifier} hardcoded CJK candidate(s).`);
  }

  if (audit.available && audit.hardBlockerCount > 0 && !auditFixTasks.available) {
    reviewItems.push("Audit hard blockers exist, but no audit fix task manifest was provided.");
  }

  if (hardcoded.available && (hardcoded.counts.high ?? 0) > 0 && !hardcodedFixTasks.available) {
    reviewItems.push("High-priority hardcoded CJK candidates exist, but no hardcoded fix task manifest was provided.");
  }

  if (!discovery.available) {
    reviewItems.push("Project discovery report is missing; extraction scripts and locale files are unverified.");
  }

  if (!audit.available && !changedKeyAudit.available) {
    reviewItems.push("Locale contract audit report is missing; key/variable/tag consistency is unverified.");
  }

  if (tasks.available && apply.available && apply.issueCount === 0 && !changedKeyAudit.available) {
    reviewItems.push("Changed-key audit report is missing; run audit-changed-locale-keys.mjs after merging translation deltas.");
  }

  const nextActions = createNextActions({
    discovery,
    exportVerify,
    audit,
    hardcoded,
    auditFixTasks,
    lengthReviewTasks,
    hardcodedFixTasks,
    tasks,
    deltaReview,
    translationReviewTasks,
    apply,
    changedKeyAudit,
  });

  return {
    generatedAt: new Date().toISOString(),
    status: blockers.length > 0 ? "blocked" : "review-required",
    blockers,
    reviewItems,
    deferredStages,
    nextActions,
    discovery,
    exportVerify,
    audit,
    hardcoded,
    auditFixTasks,
    lengthReviewTasks,
    hardcodedFixTasks,
    tasks,
    deltaReview,
    translationReviewTasks,
    apply,
    changedKeyAudit,
  };
}

function formatCounts(counts = {}) {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return "-";
  }
  return entries.map(([key, value]) => `${key}: ${value}`).join(", ");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "-";
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

function appendSection(lines, title, available, issue) {
  lines.push("");
  lines.push(`## ${title}`);
  if (!available) {
    lines.push(`Report: ${issue}`);
    return false;
  }
  return true;
}

function findDeferredStage(handoff, stage) {
  return (handoff.deferredStages ?? []).find((item) => item.stage === stage);
}

function formatLocaleSummary(locale) {
  const staleSuffix = locale.stale
    ? `, current=${locale.currentMessageCount ?? locale.currentParseError ?? "-"}`
    : "";
  return `${locale.locale} (${locale.messageCount}${staleSuffix})`;
}

function createMarkdown(handoff) {
  const lines = [
    "# i18n Handoff Report",
    "",
    `Generated: ${handoff.generatedAt}`,
    `Status: ${handoff.status}`,
    "",
    "## Blockers",
  ];

  if (handoff.blockers.length === 0) {
    lines.push("- None from the provided reports.");
  } else {
    for (const blocker of handoff.blockers) {
      lines.push(`- ${blocker}`);
    }
  }

  lines.push("");
  lines.push("## Review Items");
  if (handoff.reviewItems.length === 0) {
    lines.push("- None from the provided reports.");
  } else {
    for (const item of handoff.reviewItems) {
      lines.push(`- ${item}`);
    }
  }

  lines.push("");
  lines.push("## Recommended Next Actions");
  for (const action of handoff.nextActions) {
    lines.push(`- [${action.priority}] ${action.action}`);
    lines.push(`  Reason: ${action.reason}`);
    if (action.evidence.length > 0) {
      lines.push(`  Evidence: ${action.evidence.join("; ")}`);
    }
  }

  if (appendSection(lines, "Project Discovery", handoff.discovery.available, handoff.discovery.issue)) {
    lines.push(`- Locales: ${handoff.discovery.locales.map(formatLocaleSummary).join(", ") || "-"}`);
    lines.push(`- Commands: ${Object.entries(handoff.discovery.commands).map(([name, ok]) => `${name}=${ok ? "available" : "missing"}`).join(", ") || "-"}`);
    lines.push(`- i18n scripts: ${handoff.discovery.scripts.map((script) => script.name).join(", ") || "-"}`);
    lines.push(`- Connection points: ${handoff.discovery.connectionPointCount}`);
    if (handoff.discovery.localeSupportChecks.length > 0) {
      lines.push("- Locale package support:");
      for (const check of handoff.discovery.localeSupportChecks) {
        const values = check.expected.map((item) => {
          const status = item.supported === null ? "unknown" : item.supported ? "supported" : "missing";
          return `${item.locale}=${status}${item.supported === false ? ` (${item.packageLocale})` : ""}`;
        }).join(", ");
        const source = check.source ? `; source=${check.source}` : "";
        const supported = check.supportedLocales.length > 0
          ? `; supported=${check.supportedLocales.slice(0, 12).join(",")}${check.supportedLocales.length > 12 ? ",..." : ""}`
          : "";
        lines.push(`  - ${check.packageName}: ${values}${source}${supported}`);
      }
    }
  }

  if (appendSection(lines, "Locale Export Verification", handoff.exportVerify.available, handoff.exportVerify.issue)) {
    lines.push(`- Status: ${handoff.exportVerify.status}`);
    lines.push(`- Expected locales: ${handoff.exportVerify.expectedLocales.join(", ") || "-"}`);
    lines.push(`- Exported locales: ${handoff.exportVerify.localeSummaries.map(formatLocaleSummary).join(", ") || "-"}`);
    lines.push(`- Issues: ${handoff.exportVerify.issueCount}`);
    lines.push(`- Warnings: ${handoff.exportVerify.warningCount}`);
    if (handoff.exportVerify.issues.length > 0) {
      lines.push("- Top issues:");
      for (const issue of handoff.exportVerify.issues) {
        lines.push(`  - [${issue.type}] ${issue.locale ?? "-"} ${issue.message}`);
      }
    }
  }

  if (appendSection(lines, "Locale Audit", handoff.audit.available, handoff.audit.issue)) {
    lines.push(`- Default locale: ${handoff.audit.defaultLocale ?? "-"}`);
    lines.push(`- Source intl.get(...).d(...) messages: ${handoff.audit.sourceMessageCount}`);
    lines.push(`- Issues: ${handoff.audit.issueCount} (${formatCounts(handoff.audit.issueCounts)})`);
    lines.push(`- Warnings: ${handoff.audit.warningCount} (${formatCounts(handoff.audit.warningCounts)})`);
    if (handoff.audit.topBlockers.length > 0) {
      lines.push("- Top blockers:");
      for (const blocker of handoff.audit.topBlockers) {
        const location = blocker.filePath ? `${blocker.filePath}${blocker.line ? `:${blocker.line}` : ""}` : "-";
        lines.push(`  - [${blocker.type}] ${location} ${blocker.key ?? "-"} ${blocker.message}`);
      }
    }
  }

  lines.push("");
  lines.push("## Audit Fix Tasks");
  if (!handoff.auditFixTasks.available && handoff.audit.available && handoff.audit.hardBlockerCount === 0) {
    lines.push("Not required: locale audit has no hard blockers in the provided report.");
    if (handoff.audit.warningCount > 0) {
      lines.push("Optional warning review queues should be generated only for selected warning types, such as long-translation or template-default-message.");
    }
  } else if (!handoff.auditFixTasks.available) {
    lines.push(`Report: ${handoff.auditFixTasks.issue}`);
  } else {
    lines.push(`- Hard blocker task items: ${handoff.auditFixTasks.hardBlockerTaskCount}`);
    if (handoff.auditFixTasks.hardBlockerIssueCount !== null) {
      lines.push(`- Hard blocker issues covered: ${handoff.auditFixTasks.hardBlockerCoveredIssueCount}/${handoff.auditFixTasks.hardBlockerIssueCount}${handoff.auditFixTasks.hardBlockerCoverageComplete === false ? " (incomplete)" : ""}`);
    }
    lines.push(`- Advisory task items: ${handoff.auditFixTasks.advisoryTaskCount}`);
    const groupedCoverage = Object.entries(handoff.auditFixTasks.typeCoverage)
      .filter(([, coverage]) => coverage.grouped)
      .map(([type, coverage]) => `${type}: ${coverage.taskItemCount} task items cover ${coverage.coveredCount} source items`);
    if (groupedCoverage.length > 0) {
      lines.push(`- Grouped coverage: ${groupedCoverage.join("; ")}`);
    }
    if (handoff.auditFixTasks.includedWarningTypes.length > 0) {
      lines.push(`- Included warning types: ${handoff.auditFixTasks.includedWarningTypes.join(", ")}`);
    }
    if (handoff.auditFixTasks.warningSeverities.length > 0) {
      lines.push(`- Warning severities: ${handoff.auditFixTasks.warningSeverities.join(", ")}`);
    }
    lines.push(`- Task files: ${handoff.auditFixTasks.taskFileCount} (${formatCounts(handoff.auditFixTasks.taskTypeCounts)})`);
    lines.push(`- Max items per task: ${handoff.auditFixTasks.maxItemsPerTask ?? "-"}`);
    lines.push(`- Enriched with source: ${handoff.auditFixTasks.sourcePath ? "yes" : "no"}`);
    lines.push(`- Enriched with locales: ${handoff.auditFixTasks.localesPath ? "yes" : "no"}`);
    const taskFileSamples = selectTaskFileSamplesByType(handoff.auditFixTasks.taskFiles, 6);
    if (taskFileSamples.length > 0) {
      lines.push("- Task file samples:");
      for (const taskPath of taskFileSamples) {
        lines.push(`  - ${taskPath}`);
      }
    }
  }

  if (appendSection(lines, "Translation Length Review Tasks", handoff.lengthReviewTasks.available, handoff.lengthReviewTasks.issue)) {
    lines.push(`- Included warning types: ${handoff.lengthReviewTasks.includedWarningTypes.join(", ") || "-"}`);
    lines.push(`- Warning severities: ${handoff.lengthReviewTasks.warningSeverities.join(", ") || "-"}`);
    lines.push(`- Warnings only: ${handoff.lengthReviewTasks.warningsOnly}`);
    lines.push(`- Advisory task items: ${handoff.lengthReviewTasks.advisoryTaskCount}`);
    lines.push(`- Long-translation task items: ${handoff.lengthReviewTasks.longTranslationTaskItemCount}`);
    if (handoff.lengthReviewTasks.longTranslationSourceCount !== null) {
      lines.push(`- Source long-translation warnings covered by this manifest: ${handoff.lengthReviewTasks.longTranslationCoveredCount}/${handoff.lengthReviewTasks.longTranslationSourceCount}`);
    }
    lines.push(`- Long-translation task files: ${handoff.lengthReviewTasks.longTranslationTaskFileCount}`);
    lines.push(`- All manifest task files: ${handoff.lengthReviewTasks.taskFileCount} (${formatCounts(handoff.lengthReviewTasks.taskTypeCounts)})`);
    lines.push(`- Max items per task: ${handoff.lengthReviewTasks.maxItemsPerTask ?? "-"}`);
    if (handoff.lengthReviewTasks.taskFiles.length > 0) {
      lines.push("- Task file samples:");
      for (const task of handoff.lengthReviewTasks.taskFiles) {
        lines.push(`  - items=${task.itemCount} ${task.markdownPath}`);
      }
    }
  }

  if (appendSection(lines, "Hardcoded CJK Scan", handoff.hardcoded.available, handoff.hardcoded.issue)) {
    lines.push(`- Files scanned: ${handoff.hardcoded.fileCount}`);
    lines.push(`- Candidates: ${handoff.hardcoded.candidateCount}`);
    lines.push(`- Priority counts: ${formatCounts(handoff.hardcoded.priorityCounts)}`);
    lines.push(`- Kind counts: ${formatCounts(handoff.hardcoded.kindCounts)}`);
    if (handoff.hardcoded.appliedIgnorePatterns.length > 0) {
      lines.push(`- Ignored by fix-task patterns: ${handoff.hardcoded.ignoredCandidateCount} (${handoff.hardcoded.appliedIgnorePatterns.join(", ")})`);
      lines.push(`- Actionable candidates: ${handoff.hardcoded.actionableCandidateCount} (${formatCounts(handoff.hardcoded.actionableCounts)})`);
    }
    if (handoff.hardcoded.topCandidates.length > 0) {
      lines.push(handoff.hardcoded.appliedIgnorePatterns.length > 0 ? "- Top actionable candidates:" : "- Top candidates:");
      for (const candidate of handoff.hardcoded.topCandidates) {
        lines.push(`  - [${candidate.priority}/${candidate.kind}] ${candidate.filePath}:${candidate.line} ${candidate.text}`);
      }
    }
  }

  if (appendSection(lines, "Hardcoded CJK Fix Tasks", handoff.hardcodedFixTasks.available, handoff.hardcodedFixTasks.issue)) {
    lines.push(`- Source candidates: ${handoff.hardcodedFixTasks.sourceCandidateCount ?? "-"}`);
    lines.push(`- Task items: ${handoff.hardcodedFixTasks.taskItemCount}`);
    lines.push(`- Task files: ${handoff.hardcodedFixTasks.taskFileCount}`);
    lines.push(`- Priorities: ${handoff.hardcodedFixTasks.priorities.join(", ") || "-"}`);
    lines.push(`- Ignored patterns: ${handoff.hardcodedFixTasks.ignorePatterns.join(", ") || "-"}`);
    lines.push(`- Max items per task: ${handoff.hardcodedFixTasks.maxItemsPerTask ?? "-"}`);
  }

  if (appendSection(lines, "Translation Tasks", handoff.tasks.available, handoff.tasks.issue)) {
    lines.push(`- Default locale: ${handoff.tasks.defaultLocale ?? "-"}`);
    lines.push(`- Changed default items: ${handoff.tasks.changedDefaultItemCount}`);
    lines.push(`- Target locales: ${handoff.tasks.targetLocaleCount}`);
    lines.push(`- Task items: ${handoff.tasks.taskItemCount}`);
    lines.push(`- Task files: ${handoff.tasks.taskFileCount}`);
    lines.push(`- Max items per task: ${handoff.tasks.maxItemsPerTask ?? "-"}`);
    lines.push(`- Sort: ${handoff.tasks.sortMode ?? "-"}`);
    lines.push(`- Items with reference translations: ${handoff.tasks.referenceTranslationItemCount}`);
    lines.push(`- Reference locales: ${handoff.tasks.referenceTranslationLocales.join(", ") || "-"}`);
    lines.push(`- Likely commented source items: ${handoff.tasks.commentedSourceItemCount}`);
    if (handoff.tasks.taskSize) {
      lines.push(`- Task size: max markdown ${formatBytes(handoff.tasks.taskSize.maxMarkdownBytes)}, avg markdown/item ${handoff.tasks.taskSize.averageMarkdownBytesPerItem ?? "-"} bytes`);
      if (handoff.tasks.taskSize.warnings?.length > 0) {
        lines.push("- Task size warnings:");
        for (const warning of handoff.tasks.taskSize.warnings) {
          lines.push(`  - [${warning.type}/${warning.severity}] ${warning.message} Recommended --max-items-per-task: ${warning.recommendedMaxItemsPerTask ?? "-"}`);
        }
      }
    }
  }

  if (appendSection(lines, "Translation Delta Review", handoff.deltaReview.available, handoff.deltaReview.issue)) {
    const taskReviewMismatch = getTranslationTaskReviewMismatch(handoff.tasks, handoff.deltaReview);
    lines.push(`- Status: ${handoff.deltaReview.status}`);
    lines.push(`- Default locale: ${handoff.deltaReview.defaultLocale ?? "-"}`);
    lines.push(`- Delta files: ${handoff.deltaReview.deltaFileCount}`);
    lines.push(`- Reviewed entries: ${handoff.deltaReview.reviewedEntryCount}`);
    lines.push(`- Expected task items: ${handoff.deltaReview.expectedItemCount}`);
    if (taskReviewMismatch) {
      lines.push(`- Task mismatch: current translation tasks contain ${taskReviewMismatch.taskItemCount} item(s), but this delta review expected ${taskReviewMismatch.expectedItemCount}. Rerun review-translation-deltas.mjs with the current task manifest.`);
    }
    lines.push(`- Issues: ${handoff.deltaReview.issueCount} (${formatCounts(handoff.deltaReview.issueCounts)})`);
    lines.push(`- Warnings: ${handoff.deltaReview.warningCount} (${formatCounts(handoff.deltaReview.warningCounts)})`);
    if (handoff.deltaReview.issues.length > 0) {
      lines.push("- Top issues:");
      for (const issue of handoff.deltaReview.issues) {
        lines.push(`  - [${issue.type}] ${issue.locale ?? "-"} ${issue.key ?? "-"} ${issue.message}`);
      }
    }
    if (handoff.deltaReview.warnings.length > 0) {
      lines.push("- Top warnings:");
      for (const warning of handoff.deltaReview.warnings) {
        lines.push(`  - [${warning.type}/${warning.severity ?? "-"}] ${warning.locale ?? "-"} ${warning.key ?? "-"} ${warning.message}`);
      }
    }
  }

  const translationQualityDeferred = findDeferredStage(handoff, "translation-quality-review");
  lines.push("");
  lines.push("## Translation Quality Review Tasks");
  if (!handoff.translationReviewTasks.available && translationQualityDeferred) {
    lines.push(`Deferred: ${translationQualityDeferred.reason}`);
  } else if (!handoff.translationReviewTasks.available) {
    lines.push(`Report: ${handoff.translationReviewTasks.issue}`);
  } else {
    lines.push(`- Source review status: ${handoff.translationReviewTasks.reviewStatus}`);
    lines.push(`- Source issues: ${handoff.translationReviewTasks.sourceIssueCount}`);
    lines.push(`- Source warnings: ${handoff.translationReviewTasks.sourceWarningCount}`);
    lines.push(`- Reviewed delta entries: ${handoff.translationReviewTasks.reviewedDeltaEntryCount}`);
    lines.push(`- Task items: ${handoff.translationReviewTasks.taskItemCount} (${formatCounts(handoff.translationReviewTasks.reasonCounts)})`);
    lines.push(`- Task files: ${handoff.translationReviewTasks.taskFileCount}`);
    lines.push(`- Include all: ${handoff.translationReviewTasks.includeAll}`);
    lines.push(`- Include UI risks: ${handoff.translationReviewTasks.includeUiRisks.join(", ") || "-"}`);
    lines.push(`- Max items per task: ${handoff.translationReviewTasks.maxItemsPerTask ?? "-"}`);
    if (handoff.translationReviewTasks.taskFiles.length > 0) {
      lines.push("- Task file samples:");
      for (const task of handoff.translationReviewTasks.taskFiles) {
        lines.push(`  - ${task.locale} items=${task.itemCount} ${task.markdownPath}`);
      }
    }
  }

  const deltaMergeDeferred = findDeferredStage(handoff, "delta-merge");
  lines.push("");
  lines.push("## Delta Merge");
  if (!handoff.apply.available && deltaMergeDeferred) {
    lines.push(`Deferred: ${deltaMergeDeferred.reason}`);
  } else if (!handoff.apply.available) {
    lines.push(`Report: ${handoff.apply.issue}`);
  } else {
    lines.push(`- Dry run: ${handoff.apply.dryRun}`);
    lines.push(`- Wrote files: ${handoff.apply.wroteFiles}`);
    lines.push(`- Issues: ${handoff.apply.issueCount}`);
    lines.push(`- Skipped: ${handoff.apply.skippedCount}`);
    if (handoff.apply.skipped.length > 0) {
      lines.push("- Skipped entries:");
      for (const skipped of handoff.apply.skipped) {
        lines.push(`  - ${skipped.locale} ${skipped.key}: ${skipped.reason}`);
      }
    }
  }

  if (appendSection(lines, "Changed-Key Audit", handoff.changedKeyAudit.available, handoff.changedKeyAudit.issue)) {
    lines.push(`- Status: ${handoff.changedKeyAudit.status}`);
    lines.push(`- Default locale: ${handoff.changedKeyAudit.defaultLocale ?? "-"}`);
    lines.push(`- Locales: ${handoff.changedKeyAudit.locales.join(", ") || "-"}`);
    lines.push(`- Changed keys: ${handoff.changedKeyAudit.changedKeyCount}`);
    lines.push(`- Issues: ${handoff.changedKeyAudit.issueCount} (${formatCounts(handoff.changedKeyAudit.issueCounts)})`);
    lines.push(`- Warnings: ${handoff.changedKeyAudit.warningCount} (${formatCounts(handoff.changedKeyAudit.warningCounts)})`);
    if (handoff.changedKeyAudit.topIssues.length > 0) {
      lines.push("- Top issues:");
      for (const issue of handoff.changedKeyAudit.topIssues) {
        const location = issue.filePath ? `${issue.filePath}${issue.line ? `:${issue.line}` : ""}` : "-";
        lines.push(`  - [${issue.type}] ${issue.locale ?? "-"} ${issue.key ?? "-"} ${location} ${issue.message}`);
      }
    }
    if (handoff.changedKeyAudit.topWarnings.length > 0) {
      lines.push("- Top warnings:");
      for (const warning of handoff.changedKeyAudit.topWarnings) {
        const location = warning.filePath ? `${warning.filePath}${warning.line ? `:${warning.line}` : ""}` : "-";
        lines.push(`  - [${warning.type}/${warning.severity ?? "-"}] ${warning.locale ?? "-"} ${warning.key ?? "-"} ${location} ${warning.message}`);
      }
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const reports = {
    discovery: readJsonReport(args.discovery, "discovery"),
    exportVerify: readJsonReport(args["export-verify"], "export verify"),
    audit: readJsonReport(args.audit, "audit"),
    hardcoded: readJsonReport(args.hardcoded, "hardcoded"),
    auditFixTasks: readJsonReport(args["audit-fix-tasks"], "audit fix tasks"),
    lengthReviewTasks: readJsonReport(args["length-review-tasks"], "length review tasks"),
    hardcodedFixTasks: readJsonReport(args["hardcoded-fix-tasks"], "hardcoded fix tasks"),
    tasks: readJsonReport(args.tasks, "tasks"),
    deltaReview: readJsonReport(args["delta-review"], "delta review"),
    translationReviewTasks: readJsonReport(args["translation-review-tasks"], "translation review tasks"),
    apply: readJsonReport(args.apply, "apply"),
    changedKeyAudit: readJsonReport(args["changed-key-audit"], "changed key audit"),
  };
  const handoff = createHandoff(reports);

  if (args.json) {
    console.log(JSON.stringify(handoff, null, 2));
    return;
  }

  const markdown = createMarkdown(handoff);
  if (args.output) {
    const outputPath = resolveFromCwd(String(args.output));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, markdown);
  } else {
    console.log(markdown);
  }
}

main();
