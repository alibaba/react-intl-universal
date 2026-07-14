/** Machine-readable contract for `report.json` produced by UI Inspection Mode. */

export type I18nUiInspectionSeverity = "critical" | "high" | "medium" | "low";

export type I18nUiInspectionFindingStatus =
  | "open"
  | "fixedLocally"
  | "committed"
  | "publishedToPreview"
  | "verifiedFixed"
  | "verificationFailed"
  | "needsHumanConfirmation"
  | "notFixableInCurrentRepo"
  | "deferred"
  | "wontFix";

export type I18nUiInspectionFixVerificationLevel = "high" | "medium" | "low";
export type I18nUiInspectionFixRiskLevel = "high" | "medium" | "low";

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

export type I18nUiInspectionUnexpectedLanguageOrigin =
  | "frontend-source"
  | "frontend-locale-data"
  | "frontend-locale-fallback"
  | "api-system-copy"
  | "api-user-created-data"
  | "external-module"
  | "unknown";

export type I18nUiInspectionUserCreatedDataAssessment =
  "likely" | "unlikely" | "unknown";

export type I18nUiInspectionRunStatus =
  | "completed"
  | "completedWithIssues"
  | "completedWithAttention"
  | "partial"
  | "blocked";

export type I18nUiInspectionCoverageStatus =
  | "pending"
  | "in-progress"
  | "covered"
  | "partial"
  | "blocked"
  | "skipped-risky"
  | "duplicate-sampled"
  | "external-out-of-scope"
  | "not-reached";

export type I18nUiInspectionScreenshotStatus =
  | "coverage"
  | "issueEvidence"
  | "verificationFailed"
  | "verified"
  | "blocked"
  | "nonI18n"
  | "needsHumanConfirmation";

export type I18nUiInspectionCaptureCandidateState =
  | "pendingPixelReview"
  | "admitted"
  | "rejected";

export type I18nUiInspectionCaptureIntendedUse =
  | "coverage"
  | "finding"
  | "verification"
  | "verificationFailed"
  | "blocker"
  | "nonI18n";

export type I18nUiInspectionCaptureRejectionReason =
  | "wrong-state"
  | "wrong-locale"
  | "not-ready"
  | "loading-state"
  | "foreign-overlay"
  | "capture-corruption"
  | "target-not-visible"
  | "insufficient-context"
  | "not-pixel-reviewed";

export type I18nUiInspectionObservationKind = "blocker" | "non-i18n";

export interface I18nUiInspectionTarget {
  url: string;
  locale: string;
  viewport?: string;
}

export interface I18nUiInspectionCoverageEvidence {
  id: string;
  label: string;
  url?: string;
  action: string;
  status: I18nUiInspectionCoverageStatus;
  screenshotRef?: string;
  capturedAt?: string;
  notes?: string;
}

/** Coordinates are percentages of the screenshot's natural pixel size. */
export interface I18nUiInspectionScreenshotAnnotationBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface I18nUiInspectionScreenshotAnnotation {
  screenshotRef: string;
  boxes: I18nUiInspectionScreenshotAnnotationBox[];
}

export interface I18nUiInspectionScreenshotManifestItem {
  id: string;
  screenshotRef: string;
  capturedAt: string;
  locale: string;
  viewport?: string;
  page: string;
  url: string;
  action: string;
  readinessSignal?: string;
  status: I18nUiInspectionScreenshotStatus;
  notes: string;
  releaseCommit?: string;
}

/**
 * Records every saved capture before it can enter screenshotManifest.
 * Only state=admitted may reference admittedScreenshotId.
 */
export interface I18nUiInspectionCaptureCandidate {
  id: string;
  screenshotRef: string;
  capturedAt: string;
  locale: string;
  viewport?: string;
  page: string;
  url: string;
  action: string;
  intendedUse: I18nUiInspectionCaptureIntendedUse;
  state: I18nUiInspectionCaptureCandidateState;
  releaseCommit?: string;
  reviewedAt?: string;
  admittedScreenshotId?: string;
  rejectionReasons: I18nUiInspectionCaptureRejectionReason[];
  notes: string;
}

export interface I18nUiInspectionReleaseEvidence {
  provider: string;
  region?: string;
  publishId?: string;
  buildId?: string;
  cdnVersion?: string;
  previewId?: string;
  previewUrl: string;
  buildLogUrl?: string;
  buildCommit: string;
  status: string;
}

export interface I18nUiInspectionValidationEvidence {
  command: string;
  result: "passed" | "failed" | "failed-pre-existing" | "not-run";
  notes?: string;
}

export interface I18nUiInspectionSourceSearchMatch {
  filePath: string;
  line?: number;
  reason: string;
}

export interface I18nUiInspectionSourceSearchEvidence {
  searchedTerms: string[];
  matched: boolean;
  matches?: I18nUiInspectionSourceSearchMatch[];
  notes?: string;
}

export interface I18nUiInspectionUnexpectedLanguageEvidence {
  observedText: string;
  expectedLocale: string;
  detectedLanguage?: string;
  origin: I18nUiInspectionUnexpectedLanguageOrigin;
  sourceSearch: I18nUiInspectionSourceSearchEvidence;
  runtimeEvidence?: string;
  userCreatedDataAssessment: I18nUiInspectionUserCreatedDataAssessment;
  ownershipRationale: string;
}

export interface I18nUiInspectionCodeDiff {
  filePath: string;
  description: string;
  diff: string;
}

export interface I18nUiInspectionFixEvidence {
  changedFiles: string[];
  codeDiffs?: I18nUiInspectionCodeDiff[];
  localValidation: string[];
  failedVerificationScreenshotRefs?: string[];
  verificationScreenshotRefs?: string[];
  releaseCommit?: string;
  verifiedAt?: string;
  notes?: string;
}

export interface I18nUiInspectionFinding {
  id: string;
  severity: I18nUiInspectionSeverity;
  status: I18nUiInspectionFindingStatus;
  title: string;
  category: I18nUiInspectionIssueCategory;
  i18nRelevance: "i18n-related";
  targetLocale: string;
  viewport?: string;
  url: string;
  state: string;
  reproductionSteps: string[];
  expected: string;
  actual: string;
  /** Full product-viewport evidence that locates the affected workflow. */
  contextScreenshotRefs?: string[];
  screenshotRefs: string[];
  sourceSearch?: I18nUiInspectionSourceSearchEvidence;
  unexpectedLanguageEvidence?: I18nUiInspectionUnexpectedLanguageEvidence;
  sourceOrigin: I18nUiInspectionUnexpectedLanguageOrigin;
  recommendedOwner: string;
  ownershipRationale: string;
  fixRecommendation: string;
  fixRisk: I18nUiInspectionFixRiskLevel;
  fixVerification: I18nUiInspectionFixVerificationLevel;
  acceptanceCriteria: string[];
  fixEvidence?: I18nUiInspectionFixEvidence;
  feedback?: string;
}

export interface I18nUiInspectionObservation {
  id: string;
  kind: I18nUiInspectionObservationKind;
  title: string;
  category: I18nUiInspectionIssueCategory;
  targetLocale?: string;
  viewport?: string;
  url?: string;
  state?: string;
  action: string;
  observation: string;
  screenshotRefs: string[];
  sourceSearch?: I18nUiInspectionSourceSearchEvidence;
  runtimeEvidence?: string;
  userCreatedDataAssessment?: I18nUiInspectionUserCreatedDataAssessment;
  recommendedOwner?: string;
  outOfScopeReason?: string;
  followUp?: string;
  notes?: string;
}

export interface I18nUiInspectionVisualReviewReport {
  reportPath: string;
  scopeLabel: string;
  screenshotRefs: string[];
  result: "noIssues" | "issuesFound" | "uncertain";
  triageStatus:
    | "accepted"
    | "partiallyAccepted"
    | "dismissed"
    | "needsFollowUp"
    | "noIssues";
  findingIds?: string[];
  notes?: string;
}

export interface I18nUiInspectionSummary {
  coverage: {
    total: number;
    byStatus: Partial<Record<I18nUiInspectionCoverageStatus, number>>;
  };
  issues: {
    found: number;
    fixed: number;
    needAttention: number;
    bySeverity: Partial<Record<I18nUiInspectionSeverity, number>>;
    byStatus: Partial<Record<I18nUiInspectionFindingStatus, number>>;
  };
}

export interface I18nUiInspectionReportJson {
  schemaVersion: "2.1";
  runId: string;
  repository?: string;
  branch?: string;
  baselineCommit?: string;
  finalReleaseCommit?: string;
  startedAt: string;
  updatedAt: string;
  inspectionStatus: I18nUiInspectionRunStatus;
  reportDisplayLanguage: string;
  reportSummary?: string;
  inspectionLogPath: string;
  reportHtmlPath: string;
  screenshotDirectory: string;
  targets: I18nUiInspectionTarget[];
  releaseEvidence?: I18nUiInspectionReleaseEvidence;
  validationEvidence?: I18nUiInspectionValidationEvidence[];
  coverageEvidence: I18nUiInspectionCoverageEvidence[];
  captureLedger: I18nUiInspectionCaptureCandidate[];
  screenshotManifest: I18nUiInspectionScreenshotManifestItem[];
  screenshotAnnotations: I18nUiInspectionScreenshotAnnotation[];
  findings: I18nUiInspectionFinding[];
  blockers: I18nUiInspectionObservation[];
  nonI18nObservations: I18nUiInspectionObservation[];
  visualReviewReports?: I18nUiInspectionVisualReviewReport[];
  summary: I18nUiInspectionSummary;
}
