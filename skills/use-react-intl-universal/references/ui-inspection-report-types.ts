/**
 * Type contract for the machine-readable `report.json` produced by UI
 * inspection mode.
 *
 * `inspection-log.md` is the raw chronological source of evidence, while
 * `report.html` is the human-readable final report. This JSON contract captures
 * stable summary statistics, finding metadata, screenshot links, and
 * fix/verification status so agents, CI jobs, dashboards, or follow-up tasks
 * can consume inspection results without parsing prose.
 *
 * Complete `report.json` example:
 *
 * ```json
 * {
 *   "schemaVersion": "1.0",
 *   "startedAt": "2026-07-02T10:00:00+08:00",
 *   "inspectionStatus": "completedWithIssues",
 *   "reportDisplayLanguage": "zh-CN",
 *   "inspectionLogPath": "tmp/i18n-ui-inspection-20260702-100000/inspection-log.md",
 *   "reportHtmlPath": "tmp/i18n-ui-inspection-20260702-100000/report.html",
 *   "screenshotDirectory": "tmp/i18n-ui-inspection-20260702-100000/screenshots",
 *   "targets": [
 *     {
 *       "url": "https://example.com/orders"
 *     }
 *   ],
 *   "coverageEvidence": [
 *     {
 *       "label": "Orders list",
 *       "url": "https://example.com/orders",
 *       "action": "Opened the page from left navigation",
 *       "status": "covered",
 *       "screenshotRef": "screenshots/001-orders-list.png",
 *       "caption": "Orders list page after initial load"
 *     }
 *   ],
 *   "screenshotAnnotations": [
 *     {
 *       "screenshotRef": "screenshots/002-filter-overlap-before.png",
 *       "boxes": [
 *         {
 *           "x": 61.5,
 *           "y": 24.0,
 *           "width": 18.0,
 *           "height": 7.5,
 *           "label": "overlapping filter button"
 *         }
 *       ]
 *     }
 *   ],
 *   "visualReviewReports": [
 *     {
 *       "reportPath": "visual-reviews/001-orders-list.md",
 *       "scopeLabel": "Orders list",
 *       "screenshotRefs": ["screenshots/001-orders-list.png"],
 *       "result": "issuesFound",
 *       "triageStatus": "accepted",
 *       "findingIds": ["I18N-001"],
 *       "notes": "Reviewer finding VR-001 was accepted and converted to I18N-001."
 *     }
 *   ],
 *   "summary": {
 *     "coverage": {
 *       "urlCount": 1
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
 *       "byFixVerification": {
 *         "high": 1,
 *         "medium": 0,
 *         "low": 0
 *       },
 *       "byFixRisk": {
 *         "high": 0,
 *         "medium": 0,
 *         "low": 1
 *       },
 *       "byUrl": {
 *         "https://example.com/orders": 1
 *       }
 *     }
 *   },
 *   "findings": [
 *     {
 *       "id": "I18N-001",
 *       "severity": "high",
 *       "status": "verifiedFixed",
 *       "fixVerification": "high",
 *       "fixRisk": "low",
 *       "title": "Filter button text overlaps the icon",
 *       "screenshotRefs": ["screenshots/002-filter-overlap-before.png"],
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
 *         "notes": "The German label now wraps without shifting neighboring controls.",
 *         "codeDiffs": [
 *           {
 *             "filePath": "src/pages/orders/FilterBar.module.css",
 *             "description": "Allow the local filter button label to wrap without covering the icon.",
 *             "diff": "@@\\n-.filterButton { white-space: nowrap; }\\n+.filterButton { white-space: normal; }\\n"
 *           }
 *         ]
 *       }
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
 *
 * - open: issue is still present and not fixed.
 * - fixed: fix was made but exact UI state has not been re-inspected.
 * - verifiedFixed: fix was confirmed with replacement screenshot evidence.
 * - deferred: real issue postponed by the team.
 * - wontFix: real issue that the team does not plan to fix.
 * - needs-product-confirmation: expected behavior, product wording, data
 *   ownership, or route ownership must be confirmed before fixing.
 * - non-i18n: out-of-scope product issue or coverage blocker that is not
 *   treated as normal localization debt.
 */
export type I18nUiInspectionFindingStatus =
  | "open"
  | "fixed"
  | "verifiedFixed"
  | "deferred"
  | "wontFix"
  | "needs-product-confirmation"
  | "non-i18n";

/**
 * Verification level showing how well source review and browser/screenshot
 * evidence prove that the fix or recommendation solves this finding. This is
 * not an AI confidence score and not a side-effect risk score; use `fixRisk`
 * for compatibility or regression risk.
 *
 * - high: verified with the relevant UI state and evidence clearly shows the
 *   issue is resolved.
 * - medium: likely correct, but coverage is partial or some assumptions remain.
 * - low: uncertain fix or recommendation; human attention is required before
 *   treating the issue as resolved.
 */
export type I18nUiInspectionFixVerificationLevel = "high" | "medium" | "low";

/**
 * @deprecated Use `I18nUiInspectionFixVerificationLevel`.
 */
export type I18nUiInspectionFixConfidence = I18nUiInspectionFixVerificationLevel;

/**
 * Risk that the fix or recommended fix may cause side effects outside the
 * directly verified finding.
 *
 * - high: likely affects shared components, broad page layout, responsive
 *   grid/column allocation, many routes/locales, critical behavior,
 *   backend/API contracts, default-locale visual layout, product meaning,
 *   design-system rules, or introduces a locale-scoped broad layout branch;
 *   human review is required.
 * - medium: plausible side effects exist, such as route-family or breakpoint
 *   impact; human review is recommended.
 * - low: local, narrow change, such as a small component-level width, spacing,
 *   or wrapping adjustment, with low compatibility or product risk.
 */
export type I18nUiInspectionFixRiskLevel = "high" | "medium" | "low";

/**
 * Primary visible issue category. Use `component visual integrity` when a
 * compact control remains readable and has no overflow, but the component no
 * longer looks like one coherent control because grouped items wrap, borders
 * break, radius is applied to the wrong items, active state detaches, or
 * icon/text/arrow relationships are visually broken. Use
 * `text wrapping / word-break` for unacceptable mid-word breaks such as a table
 * header split into `Associatio` / `n Range`, and use
 * `form label visual integrity` for labels whose colon, required marker, or
 * punctuation is visually orphaned.
 */
export type I18nUiInspectionIssueCategory =
  | "language quality"
  | "truncation"
  | "overflow"
  | "overlap"
  | "misalignment"
  | "component visual integrity"
  | "text wrapping / word-break"
  | "form label visual integrity"
  | "untranslated text"
  | "raw placeholder/tag"
  | "terminology inconsistency"
  | "interaction defect"
  | "page load / blank screen"
  | "non-i18n observation";

/**
 * Whether an observation is part of the i18n/localized UI-fit scope.
 *
 * - i18n-related: caused or exposed by translation, locale, casing,
 *   terminology, fallback, ICU/rich-tag rendering, or language-dependent
 *   layout.
 * - i18n-blocking: not proven to be caused by i18n, but it blocks inspection
 *   coverage, such as a blank page, permissions, route failure, or missing test
 *   data.
 * - non-i18n: useful context or an out-of-scope observation unrelated to
 *   localization. These should not dominate the main finding list.
 */
export type I18nUiInspectionI18nRelevance =
  | "i18n-related"
  | "i18n-blocking"
  | "non-i18n";

export type I18nUiInspectionTranslationQualityCategory =
  | "Accuracy"
  | "Fluency"
  | "Terminology"
  | "Locale convention"
  | "N/A";

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
 * Coverage status for a requested route, menu item, tab, feature entry, or
 * representative detail state.
 */
export type I18nUiInspectionCoverageStatus =
  | "covered"
  | "blocked"
  | "skipped-risky"
  | "external-out-of-scope"
  | "not-reached";

/**
 * Independent screenshot-review result written by a visual-review subagent.
 */
export type I18nUiInspectionVisualReviewResult =
  | "noIssues"
  | "issuesFound"
  | "uncertain";

/**
 * Main-agent triage status for an independent visual-review report.
 *
 * - accepted: at least one reviewer observation became a final finding.
 * - partiallyAccepted: some observations became findings and some were dismissed
 *   or deferred.
 * - dismissed: reviewer observations were reviewed but not accepted as final
 *   findings.
 * - needsFollowUp: the report still requires Browser Use, source review, product
 *   context, or human review.
 * - noIssues: reviewer reported no visible issues and the primary inspection
 *   accepted that result.
 */
export type I18nUiInspectionVisualReviewTriageStatus =
  | "accepted"
  | "partiallyAccepted"
  | "dismissed"
  | "needsFollowUp"
  | "noIssues";

/**
 * Complete count map for findings grouped by severity.
 */
export type I18nUiInspectionSeverityCounts = Record<I18nUiInspectionSeverity, number>;

/**
 * Complete count map for findings grouped by fix lifecycle status.
 */
export type I18nUiInspectionStatusCounts = Record<I18nUiInspectionFindingStatus, number>;

/**
 * Complete count map for findings grouped by fix verification.
 */
export type I18nUiInspectionFixVerificationCounts = Record<I18nUiInspectionFixVerificationLevel, number>;

/**
 * @deprecated Use `I18nUiInspectionFixVerificationCounts`.
 */
export type I18nUiInspectionFixConfidenceCounts = I18nUiInspectionFixVerificationCounts;

/**
 * Complete count map for findings grouped by fix risk.
 */
export type I18nUiInspectionFixRiskCounts = Record<I18nUiInspectionFixRiskLevel, number>;

export interface I18nUiInspectionTarget {
  /**
   * Full page URL covered by the inspection.
   */
  url: string;
}

export interface I18nUiInspectionCoverageEvidence {
  /**
   * Reader-facing scope label, such as a menu item, route name, tab label, or
   * detail state.
   */
  label: string;

  /**
   * Full URL, route, or state identifier when available.
   */
  url?: string;

  /**
   * Action that produced this evidence, such as opening a menu item, clicking a
   * row detail link, selecting a tab, or skipping a risky action.
   */
  action: string;

  /**
   * Whether this scope item was covered, blocked, skipped as risky, external to
   * the requested scope, or not reached.
   */
  status: I18nUiInspectionCoverageStatus;

  /**
   * Screenshot path for covered items. Blocked, skipped, external, or not-reached
   * items may omit this only when no screenshot could be captured.
   */
  screenshotRef?: string;

  /**
   * Short caption explaining what the screenshot or status proves.
   */
  caption: string;

  /**
   * Optional note for blockers, skipped actions, external links, or unusual
   * states.
   */
  notes?: string;
}

export interface I18nUiInspectionScreenshotAnnotationBox {
  /**
   * Left position as a percentage of the original screenshot's natural pixel
   * width. Compute from screenshot pixels, not from a rendered thumbnail,
   * cropped preview, viewport, card, or lightbox wrapper.
   */
  x: number;

  /**
   * Top position as a percentage of the original screenshot's natural pixel
   * height. `report.html` must render this against the actual image stage, not
   * against a fixed-aspect wrapper that can letterbox or crop the image.
   */
  y: number;

  /**
   * Box width as a percentage of the original screenshot's natural pixel width.
   */
  width: number;

  /**
   * Box height as a percentage of the original screenshot's natural pixel
   * height.
   */
  height: number;

  /**
   * Short visible label for the red-box annotation, such as "truncated label",
   * "broken border", "wrong unit", or "untranslated text". `report.html`
   * should render this label visibly as a callout or nearby caption; do not
   * expose it only through `title` or `alt` text.
   */
  label?: string;
}

export interface I18nUiInspectionScreenshotAnnotation {
  /**
   * Screenshot ID or path that this annotation belongs to. This should match a
   * screenshot path used by coverage evidence, finding evidence, fix evidence,
   * or the screenshot appendix.
   */
  screenshotRef: string;

  /**
   * One or more red-box regions to render over this screenshot. Coordinates are
   * screenshot-relative percentages so `report.html` can reuse them in finding
   * cards, screenshot appendix items, and enlarged lightbox previews. Renderers
   * must preserve the screenshot image coordinate system: place boxes in a
   * positioned image stage whose size/aspect ratio matches the rendered image,
   * and avoid attaching boxes to wrappers using unrelated aspect ratios,
   * `object-fit`, cropped thumbnails, or page/backdrop coordinates.
   */
  boxes: I18nUiInspectionScreenshotAnnotationBox[];
}

export interface I18nUiInspectionVisualReviewReport {
  /**
   * Markdown report path under `visual-reviews/`, preferably relative to the
   * inspection folder or repository root.
   */
  reportPath: string;

  /**
   * Reader-facing scope label, such as a route, menu item, module, tab, or
   * detail state.
   */
  scopeLabel?: string;

  /**
   * Screenshot IDs or paths reviewed by the independent visual reviewer.
   */
  screenshotRefs: string[];

  /**
   * Raw reviewer result from the Markdown report.
   */
  result: I18nUiInspectionVisualReviewResult;

  /**
   * Main-agent triage result after reading the reviewer Markdown report.
   */
  triageStatus: I18nUiInspectionVisualReviewTriageStatus;

  /**
   * Final finding IDs created from reviewer observations, when any were
   * accepted.
   */
  findingIds?: string[];

  /**
   * Short notes for dismissed observations, uncertainty, missing subagent
   * capability, or follow-up needed.
   */
  notes?: string;
}

export interface I18nUiInspectionCoverageSummary {
  /**
   * Distinct page URLs that the run attempted to inspect. For partial or
   * blocked runs, explain the uncovered areas in `inspection-log.md` and
   * `report.html` rather than expanding this compact JSON object.
   */
  urlCount: number;
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
   * Finding counts by fix verification. `report.html` should render high as
   * green, medium as yellow, and low as red.
   */
  byFixVerification: I18nUiInspectionFixVerificationCounts;

  /**
   * @deprecated Older reports used this name for fix verification.
   */
  byFixConfidence?: I18nUiInspectionFixConfidenceCounts;

  /**
   * Finding counts by fix risk. `report.html` should render high as red,
   * medium as yellow, and low as green.
   */
  byFixRisk: I18nUiInspectionFixRiskCounts;

  /**
   * Finding counts by URL, such as {"https://example.com/settings": 2}.
   */
  byUrl: Record<string, number>;

  /**
   * Optional finding counts by i18n relevance. Useful for keeping real i18n
   * issues separate from coverage blockers and out-of-scope product issues.
   */
  byI18nRelevance?: Record<I18nUiInspectionI18nRelevance, number>;
}

export interface I18nUiInspectionCodeDiff {
  /**
   * Repository-relative path for the changed file when available.
   */
  filePath: string;

  /**
   * Short description of why this hunk matters for the finding.
   */
  description?: string;

  /**
   * Concise unified diff for the relevant hunk only. Avoid dumping unrelated
   * changes; the human-readable report should make the fix understandable, not
   * replace code review. This should be non-empty and should contain at least
   * one meaningful hunk; omit the whole code-diff entry when no local
   * source/style/config/locale change was made.
   */
  diff: string;
}

export interface I18nUiInspectionSummary {
  /**
   * Compact coverage counters. Detailed coverage limits, blockers, skipped
   * risky actions, and tooling limitations belong in `inspection-log.md` and
   * `report.html`.
   */
  coverage: I18nUiInspectionCoverageSummary;

  /**
   * Finding totals grouped by the dimensions that are useful for dashboards,
   * handoffs, and follow-up planning.
   */
  issues: I18nUiInspectionIssueSummary;
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
   * Concise source/style/config/locale diffs relevant to this finding. Include
   * only meaningful hunks, and omit when the finding was not fixed locally or
   * no code/config/locale file changed. `report.html` should render these below
   * the finding's screenshot evidence as a contained left/right diff. If this
   * array is empty or every diff parses to no hunk, omit the entire diff area
   * rather than showing a blank panel.
   */
  codeDiffs?: I18nUiInspectionCodeDiff[];

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
   * Verification level showing whether the fix or recommended fix solves this
   * finding.
   * `report.html` should color high as green, medium as yellow, and low as red.
   */
  fixVerification: I18nUiInspectionFixVerificationLevel;

  /**
   * @deprecated Older reports used this name for fix verification.
   */
  fixConfidence?: I18nUiInspectionFixConfidence;

  /**
   * Side-effect, compatibility, regression, or product-risk level for the fix
   * or recommended fix. This is separate from `fixVerification`: a fix can be
   * highly likely to solve the visible issue but still be high risk if it
   * changes shared layout, responsive allocation, shared components, backend
   * contracts, default-locale visual layout, product meaning, or adds a
   * locale-scoped broad layout branch.
   */
  fixRisk: I18nUiInspectionFixRiskLevel;

  /**
   * Short human-readable finding title.
   */
  title: string;

  /**
   * Primary visible issue category. Older reports may omit this field.
   */
  category?: I18nUiInspectionIssueCategory;

  /**
   * Whether this finding belongs to the i18n/localized UI-fit scope, only
   * blocks i18n coverage, or is a non-i18n observation. New reports should set
   * this explicitly so `report.html` can keep non-i18n issues from dominating
   * the i18n finding list.
   */
  i18nRelevance?: I18nUiInspectionI18nRelevance;

  /**
   * Optional compatibility field for simple consumers that only need a boolean.
   * Prefer `i18nRelevance` for new reports.
   */
  isI18nRelated?: boolean;

  /**
   * Required when `i18nRelevance` is `i18n-blocking` or `non-i18n`, or when the
   * finding status is `non-i18n`. Explain why the observation is not being
   * treated as a normal localization defect.
   */
  outOfScopeReason?: string;

  /**
   * Optional user feedback captured or initialized by `report.html`'s finding
   * overview table. Reports may leave this empty and store live user edits in
   * page memory or localStorage; the field exists so follow-up tools can carry
   * feedback forward when desired.
   */
  feedback?: string;

  /**
   * Optional subtype for `component visual integrity`, such as
   * "grouped-control wrapping/broken border".
   */
  componentVisualIntegritySubtype?: string;

  /**
   * Optional wording-quality category. Use "N/A" for pure layout or component
   * visual-integrity findings.
   */
  translationQualityCategory?: I18nUiInspectionTranslationQualityCategory;

  /**
   * Screenshot IDs or paths showing the issue. Before-fix issue screenshots
   * should appear here. In `report.html`, these must be rendered as visible
   * finding screenshot cards, not only as text links. When the problem location
   * is hard to see, add matching entries to `screenshotAnnotations`.
   */
  screenshotRefs: string[];

  /**
   * Human attention and risk explanation, especially for medium/low verification
   * findings or fixes that may affect compatibility, shared UI, other locales,
   * or neighboring flows.
   */
  humanAttention: I18nUiInspectionHumanAttention;

  /**
   * Evidence that a fix was attempted or verified, present only when the finding
   * moved beyond `open`. When both `screenshotRefs` and
   * `fixEvidence.verificationScreenshotRefs` exist, `report.html` should render
   * them as a two-column before/after comparison: issue screenshot on the left,
   * verified-fix screenshot on the right.
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
   * Display language used for the human-readable `report.html`, such as
   * `zh-CN` or `en-US`. This follows the language used by the user's
   * inspection request by default and may differ from the inspected UI target
   * locale.
   */
  reportDisplayLanguage?: string;

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
   * Every page URL covered by the inspection scope.
   */
  targets: I18nUiInspectionTarget[];

  /**
   * Audit trail proving requested scope coverage. Broad route, left-navigation,
   * or full-product inspections should include one entry per requested route,
   * menu item, tab, feature entry, and representative detail state.
   */
  coverageEvidence?: I18nUiInspectionCoverageEvidence[];

  /**
   * Optional red-box annotations for screenshots where the issue or verified fix
   * is hard to locate. `report.html` should render these as HTML/CSS overlays in
   * image cards/thumbnails and in the enlarged preview while keeping the
   * original screenshot files unchanged.
   */
  screenshotAnnotations?: I18nUiInspectionScreenshotAnnotation[];

  /**
   * Independent screenshot-review Markdown reports and the primary-inspection
   * triage result for each report. Broad/full-product inspections should
   * populate this when subagents are available; otherwise explain the limitation in
   * `inspection-log.md` and `report.html`.
   */
  visualReviewReports?: I18nUiInspectionVisualReviewReport[];

  /**
   * Aggregated counts derived from the inspection log, targets, and findings.
   * These numbers should not introduce facts that are absent from the inspection
   * artifacts.
   */
  summary: I18nUiInspectionSummary;

  /**
   * Visible localized UI or language-quality issues observed during inspection.
   */
  findings: I18nUiInspectionFinding[];
}
