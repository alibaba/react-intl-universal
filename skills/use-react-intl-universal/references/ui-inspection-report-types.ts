/**
 * Type contract for the machine-readable `report.json` produced by UI
 * inspection mode.
 *
 * `inspection-log.md` is the raw chronological source of evidence, while
 * `report.html` is the human-readable final report. This JSON contract captures
 * stable summary statistics, finding metadata, screenshot links, root-cause
 * routing, and fix/verification status so agents, CI jobs, dashboards, or
 * follow-up tasks can consume inspection results without parsing prose.
 *
 * Complete `report.json` example:
 *
 * ```json
 * {
 *   "schemaVersion": "1.0",
 *   "startedAt": "2026-07-02T10:00:00+08:00",
 *   "inspectionStatus": "completedWithIssues",
 *   "inspectionLogPath": "tmp/i18n-ui-inspection-20260702-100000/inspection-log.md",
 *   "reportHtmlPath": "tmp/i18n-ui-inspection-20260702-100000/report.html",
 *   "screenshotDirectory": "tmp/i18n-ui-inspection-20260702-100000/screenshots",
 *   "targets": [
 *     {
 *       "url": "https://example.com/orders"
 *     }
 *   ],
 *   "summary": {
 *     "coverage": {
 *       "urlCount": 1,
 *       "blockerCount": 0
 *     },
 *     "issues": {
 *       "total": 1,
 *       "bySeverity": {
 *         "critical": 0,
 *         "high": 1,
 *         "medium": 0,
 *         "low": 0
 *       },
 *       "byStatus": {
 *         "open": 0,
 *         "fixed": 0,
 *         "verifiedFixed": 1,
 *         "deferred": 0,
 *         "wontFix": 0
 *       },
 *       "byFixConfidence": {
 *         "high": 1,
 *         "medium": 0,
 *         "low": 0
 *       },
 *       "byCategory": {
 *         "languageQuality": 0,
 *         "truncation": 0,
 *         "overflow": 0,
 *         "overlap": 1,
 *         "misalignment": 0,
 *         "untranslatedText": 0,
 *         "rawPlaceholderTag": 0,
 *         "terminologyInconsistency": 0,
 *         "interactionDefect": 0
 *       },
 *       "byRootCause": {
 *         "frontendApplication": 1,
 *         "backendApi": 0,
 *         "externalDependency": 0,
 *         "unknownNeedsInvestigation": 0
 *       },
 *       "byOwner": {
 *         "currentRepository": 1,
 *         "backendApi": 0,
 *         "sharedComponentPackage": 0,
 *         "moduleFederationRemote": 0,
 *         "thirdPartyVendor": 0,
 *         "unknown": 0
 *       },
 *       "byUrl": {
 *         "https://example.com/orders": 1
 *       }
 *     },
 *     "translationQuality": {
 *       "accuracy": 0,
 *       "fluency": 0,
 *       "terminology": 0,
 *       "localeConvention": 0
 *     }
 *   },
 *   "findings": [
 *     {
 *       "id": "I18N-001",
 *       "severity": "high",
 *       "status": "verifiedFixed",
 *       "fixConfidence": "high",
 *       "title": "Filter button text overlaps the icon",
 *       "affectedState": {
 *         "url": "https://example.com/orders",
 *         "state": "advanced filter drawer open",
 *         "locale": "de-DE",
 *         "viewport": {
 *           "width": 1280,
 *           "height": 800,
 *           "label": "desktop"
 *         }
 *       },
 *       "screenshotRefs": ["screenshots/002-filter-overlap-before.png"],
 *       "category": "overlap",
 *       "translationQualityCategory": "notApplicable",
 *       "likelyRootCause": "frontendApplication",
 *       "recommendedOwner": "currentRepository",
 *       "fixRecommendation": "Allow the filter button label to wrap or increase the button min-width with a shared responsive rule.",
 *       "humanAttention": {
 *         "required": false,
 *         "reason": "The fix was verified with a replacement screenshot and only changes the local responsive layout rule.",
 *         "risk": "Low compatibility risk because neighboring controls were checked after the fix.",
 *         "suggestedAction": "No human review is required unless the shared button style is reused in an unknown compact layout."
 *       },
 *       "fixEvidence": {
 *         "fixedBy": "Updated the filter button layout styles.",
 *         "verifiedAt": "2026-07-02T10:17:30+08:00",
 *         "verificationScreenshotRefs": ["screenshots/004-filter-overlap-after.png"],
 *         "notes": "The German label now wraps without shifting neighboring controls."
 *       }
 *     }
 *   ],
 *   "blockers": [],
 *   "untestedAreas": [
 *     {
 *       "id": "UNTESTED-001",
 *       "url": "https://example.com/orders",
 *       "locale": "de-DE",
 *       "reason": "Delete confirmation was not submitted because destructive actions were out of scope.",
 *       "risk": "Confirmation dialog copy could still contain layout or translation issues."
 *     }
 *   ]
 * }
 * ```
 */

/**
 * User-impact severity for a visible localized UI issue.
 *
 * - critical: blocks a core flow or creates dangerous/misleading behavior.
 * - high: likely causes misunderstanding, wrong action, or missed information.
 * - medium: visible problem, but the user can still complete the flow.
 * - low: minor wording, spacing, alignment, or polish issue.
 */
export type I18nUiInspectionSeverity = "critical" | "high" | "medium" | "low";

/**
 * Finding lifecycle status.
 */
export type I18nUiInspectionFindingStatus =
  | "open"
  | "fixed"
  | "verifiedFixed"
  | "deferred"
  | "wontFix";

/**
 * Confidence that the fix or recommended fix is correct and unlikely to create
 * important side effects.
 *
 * - high: verified or low-risk fix; usually does not need human attention.
 * - medium: likely correct, but the scope, side effects, or compatibility
 *   impact should be reviewed.
 * - low: uncertain fix or high side-effect/compatibility risk; human attention
 *   is required before treating the issue as safely resolved.
 */
export type I18nUiInspectionFixConfidence = "high" | "medium" | "low";

/**
 * Primary visible symptom. Choose one main category for each finding so
 * aggregated statistics stay stable. Put secondary context in the finding
 * description, evidence, or fix rationale.
 */
export type I18nUiInspectionIssueCategory =
  | "languageQuality"
  | "truncation"
  | "overflow"
  | "overlap"
  | "misalignment"
  | "untranslatedText"
  | "rawPlaceholderTag"
  | "terminologyInconsistency"
  | "interactionDefect";

/**
 * Lightweight MQM-inspired wording-quality category. Use `notApplicable` for
 * pure layout or interaction findings.
 */
export type I18nUiInspectionTranslationQualityCategory =
  | "accuracy"
  | "fluency"
  | "terminology"
  | "localeConvention"
  | "notApplicable";

/**
 * Likely technical ownership root cause inferred from browser evidence.
 * Use "likely" language in human reports unless the evidence is conclusive.
 */
export type I18nUiInspectionRootCause =
  | "frontendApplication"
  | "backendApi"
  | "externalDependency"
  | "unknownNeedsInvestigation";

/**
 * Recommended owner for follow-up. This may differ from root cause when the
 * current repository needs to coordinate with another team or package owner.
 */
export type I18nUiInspectionOwner =
  | "currentRepository"
  | "backendApi"
  | "sharedComponentPackage"
  | "moduleFederationRemote"
  | "thirdPartyVendor"
  | "unknown";

/**
 * Overall result of the inspection run, not a per-finding fix status.
 *
 * - completed: requested scope was inspected and no issues were found.
 * - completedWithIssues: requested scope was inspected and issues were found.
 * - partial: only part of the requested scope was inspected.
 * - blocked: inspection could not meaningfully proceed.
 */
export type I18nUiInspectionRunStatus =
  | "completed"
  | "completedWithIssues"
  | "partial"
  | "blocked";

/**
 * Complete count map for findings grouped by severity.
 */
export type I18nUiInspectionSeverityCounts = Record<I18nUiInspectionSeverity, number>;

/**
 * Complete count map for findings grouped by fix lifecycle status.
 */
export type I18nUiInspectionStatusCounts = Record<I18nUiInspectionFindingStatus, number>;

/**
 * Complete count map for findings grouped by fix confidence.
 */
export type I18nUiInspectionFixConfidenceCounts = Record<I18nUiInspectionFixConfidence, number>;

/**
 * Complete count map for findings grouped by primary visible symptom.
 */
export type I18nUiInspectionCategoryCounts = Record<I18nUiInspectionIssueCategory, number>;

/**
 * Complete count map for findings grouped by likely technical root cause.
 */
export type I18nUiInspectionRootCauseCounts = Record<I18nUiInspectionRootCause, number>;

/**
 * Complete count map for findings grouped by recommended follow-up owner.
 */
export type I18nUiInspectionOwnerCounts = Record<I18nUiInspectionOwner, number>;

/**
 * Count map for wording-quality findings. Pure layout findings use
 * `notApplicable` and are not counted here.
 */
export type I18nUiInspectionTranslationQualityCounts = Record<
  Exclude<I18nUiInspectionTranslationQualityCategory, "notApplicable">,
  number
>;

export interface I18nUiInspectionViewport {
  /**
   * Viewport width in CSS pixels.
   */
  width: number;

  /**
   * Viewport height in CSS pixels.
   */
  height: number;

  /**
   * Optional human label, such as "desktop", "mobile", or "tablet".
   */
  label?: string;
}

export interface I18nUiInspectionTarget {
  /**
   * Full page URL covered by the inspection.
   */
  url: string;
}

export interface I18nUiInspectionCoverageSummary {
  /**
   * Distinct inspected page URLs.
   */
  urlCount: number;

  /**
   * Number of blockers that prevented inspection from continuing or covering a
   * requested area.
   */
  blockerCount: number;
}

export interface I18nUiInspectionIssueSummary {
  /**
   * Total number of findings in this report.
   */
  total: number;

  /**
   * Finding counts by user-impact severity.
   */
  bySeverity: I18nUiInspectionSeverityCounts;

  /**
   * Finding counts by lifecycle/fix status.
   */
  byStatus: I18nUiInspectionStatusCounts;

  /**
   * Finding counts by fix confidence. `report.html` should render high as
   * green, medium as yellow, and low as red.
   */
  byFixConfidence: I18nUiInspectionFixConfidenceCounts;

  /**
   * Finding counts by primary visible symptom.
   */
  byCategory: I18nUiInspectionCategoryCounts;

  /**
   * Finding counts by likely root cause.
   */
  byRootCause: I18nUiInspectionRootCauseCounts;

  /**
   * Finding counts by recommended follow-up owner.
   */
  byOwner: I18nUiInspectionOwnerCounts;

  /**
   * Finding counts by URL, such as {"https://example.com/settings": 2}.
   */
  byUrl: Record<string, number>;
}

export interface I18nUiInspectionSummary {
  /**
   * What was covered and what was blocked or skipped.
   */
  coverage: I18nUiInspectionCoverageSummary;

  /**
   * Finding totals grouped by the dimensions that are useful for dashboards,
   * handoffs, and follow-up planning.
   */
  issues: I18nUiInspectionIssueSummary;

  /**
   * Counts for wording-quality findings only. Do not include `notApplicable`.
   */
  translationQuality: I18nUiInspectionTranslationQualityCounts;
}

export interface I18nUiInspectionBlocker {
  /**
   * Stable blocker ID, such as "BLOCKER-001".
   */
  id: string;

  /**
   * Full page URL where the blocker occurred, when known.
   */
  url?: string;

  /**
   * Locale affected by the blocker, when known.
   */
  locale?: string;

  /**
   * Why the inspection could not continue or could not cover the requested
   * area.
   */
  reason: string;

  /**
   * Minimum access, account, test data, or environment change needed to unblock
   * the inspection.
   */
  requiredAccessOrData?: string;

  /**
   * Screenshot IDs or paths that show the blocker state, when available.
   */
  screenshotRefs?: string[];
}

export interface I18nUiInspectionUntestedArea {
  /**
   * Stable untested-area ID, such as "UNTESTED-001".
   */
  id: string;

  /**
   * Full page URL that was not inspected or only partially inspected.
   */
  url?: string;

  /**
   * Locale that was not inspected or only partially inspected.
   */
  locale?: string;

  /**
   * Why this area was not covered, such as user scope limit, destructive action,
   * missing data, or external dependency failure.
   */
  reason: string;

  /**
   * Potential risk if this untested area contains localized UI issues.
   */
  risk?: string;
}

export interface I18nUiInspectionAffectedState {
  /**
   * Full page URL where the finding appears.
   */
  url: string;

  /**
   * Precise UI state where the finding appears, such as "advanced filter drawer
   * open" or "empty form after validation".
   */
  state: string;

  /**
   * Locale where the finding was observed.
   */
  locale: string;

  /**
   * Viewport where the finding was observed.
   */
  viewport: I18nUiInspectionViewport;
}

export interface I18nUiInspectionFixEvidence {
  /**
   * Short description or reference for the fix, such as a commit, file path,
   * PR, or "translation shortened".
   */
  fixedBy?: string;

  /**
   * ISO timestamp when the fix was re-inspected.
   */
  verifiedAt?: string;

  /**
   * Screenshot IDs or paths showing the fixed state.
   */
  verificationScreenshotRefs?: string[];

  /**
   * Additional fix or verification notes that do not fit other fields.
   */
  notes?: string;
}

export interface I18nUiInspectionHumanAttention {
  /**
   * Whether this finding still needs human review or decision-making after the
   * agent's fix/recommendation.
   */
  required: boolean;

  /**
   * Short reason explaining why human attention is or is not needed.
   */
  reason: string;

  /**
   * Side-effect, compatibility, regression, or product-risk note. Include this
   * when the fix could affect other layouts, locales, routes, shared components,
   * backend contracts, or external dependencies.
   */
  risk?: string;

  /**
   * Concrete human follow-up action, such as reviewing a shared component,
   * checking an affected route family, or confirming product terminology.
   */
  suggestedAction?: string;
}

export interface I18nUiInspectionFinding {
  /**
   * Stable finding ID, such as "I18N-001".
   */
  id: string;

  /**
   * User-impact severity for this finding.
   */
  severity: I18nUiInspectionSeverity;

  /**
   * Fix lifecycle for this finding. Initial inspection findings usually start
   * as `open`. Use `verifiedFixed` only after re-inspection evidence exists.
   */
  status: I18nUiInspectionFindingStatus;

  /**
   * Confidence that the fix or recommended fix is correct and low-risk.
   * `report.html` should color high as green, medium as yellow, and low as red.
   */
  fixConfidence: I18nUiInspectionFixConfidence;

  /**
   * Short human-readable finding title.
   */
  title: string;

  /**
   * Exact URL, locale, viewport, and UI state affected by this finding.
   */
  affectedState: I18nUiInspectionAffectedState;

  /**
   * Screenshot IDs or paths showing the issue. Before-fix issue screenshots
   * should appear here.
   */
  screenshotRefs: string[];

  /**
   * Primary visible symptom category for this finding.
   */
  category: I18nUiInspectionIssueCategory;

  /**
   * Wording-quality category when relevant, or `notApplicable` for pure layout
   * or interaction findings.
   */
  translationQualityCategory: I18nUiInspectionTranslationQualityCategory;

  /**
   * Likely technical root cause inferred from the available evidence.
   */
  likelyRootCause: I18nUiInspectionRootCause;

  /**
   * Recommended team, repository, package, or vendor that should own follow-up.
   */
  recommendedOwner: I18nUiInspectionOwner;

  /**
   * Concrete next fix to try, or next investigation/owner path when the issue
   * does not appear fixable in the current repository.
   */
  fixRecommendation: string;

  /**
   * Human attention and risk explanation, especially for medium/low confidence
   * findings or fixes that may affect compatibility, shared UI, other locales,
   * or neighboring flows.
   */
  humanAttention: I18nUiInspectionHumanAttention;

  /**
   * Evidence that a fix was attempted or verified, present only when the finding
   * moved beyond `open`.
   */
  fixEvidence?: I18nUiInspectionFixEvidence;
}

export interface I18nUiInspectionReportJson {
  /**
   * Schema version for future-compatible parsing.
   */
  schemaVersion: "1.0";

  /**
   * ISO timestamp when inspection work started, if known.
   */
  startedAt?: string;

  /**
   * Overall result of this inspection run. This is separate from each finding's
   * fix status.
   */
  inspectionStatus: I18nUiInspectionRunStatus;

  /**
   * Path to the raw chronological inspection log. Prefer a path relative to the
   * repository root when possible.
   */
  inspectionLogPath: string;

  /**
   * Path to the polished human-readable HTML report. Prefer a path relative to
   * the repository root when possible.
   */
  reportHtmlPath: string;

  /**
   * Path to the directory containing all referenced screenshots. Prefer a path
   * relative to the repository root when possible.
   */
  screenshotDirectory: string;

  /**
   * Every page URL covered by this run.
   */
  targets: I18nUiInspectionTarget[];

  /**
   * Aggregated counts derived from the rest of this report. These numbers should
   * not introduce facts that are absent from targets, findings, blockers, or
   * untestedAreas.
   */
  summary: I18nUiInspectionSummary;

  /**
   * Visible localized UI or language-quality issues observed during this run.
   */
  findings: I18nUiInspectionFinding[];

  /**
   * Hard blockers that prevented meaningful inspection progress or coverage.
   */
  blockers: I18nUiInspectionBlocker[];

  /**
   * Areas not covered or only partially covered.
   */
  untestedAreas: I18nUiInspectionUntestedArea[];
}
