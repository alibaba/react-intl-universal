#!/usr/bin/env node

/*
 * Purpose:
 * Run a minimal end-to-end smoke test for the use-react-intl-universal helper
 * scripts.
 *
 * This is a maintainer check for the skill itself. It creates a temporary
 * repository fixture, runs representative scripts against real files, and
 * asserts the generated reports contain the expected blockers and task
 * instructions. It does not need third-party dependencies.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLengthRiskWarning } from "./lib/i18n-audit.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const NODE = process.execPath;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function runScript(repoPath, scriptName, args, { expectFailure = false } = {}) {
  const result = spawnSync(NODE, [path.join(SCRIPT_DIR, scriptName), ...args], {
    cwd: repoPath,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (!expectFailure && result.status !== 0) {
    throw new Error(`${scriptName} failed unexpectedly:\n${result.stdout}\n${result.stderr}`);
  }

  if (expectFailure && result.status === 0) {
    throw new Error(`${scriptName} was expected to fail but passed`);
  }

  return result;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "use-react-intl-universal-self-test-"));

  writeText(path.join(root, "package.json"), JSON.stringify({
    scripts: {
      "intl:export": "react-intl-universal-extract --cmd export --export-language en_US,zh_CN --output ./src/locales",
    },
    dependencies: {
      "react-intl-universal": "2.14.0",
      "dayjs": "1.11.0",
    },
  }, null, 2));

  writeText(path.join(root, "node_modules", "dayjs", "locale", "en.js"), "export default 'en';\n");
  writeText(path.join(root, "node_modules", "dayjs", "locale", "zh-cn.js"), "export default 'zh-cn';\n");
  writeText(path.join(root, "node_modules", "dayjs", "package.json"), JSON.stringify({
    name: "dayjs",
    version: "1.11.0",
  }, null, 2));

  writeText(path.join(root, "src", "App.tsx"), `
import intl from "react-intl-universal";

export function App() {
  const username = "Tony";
  const count = 3;
  const hr = 9;
  return (
    <div>
      {intl
        .get("HELLO_USER", {
          username,
          link: chunks => <a href="/docs">{chunks}</a>,
        })
        .d("Hello, {username}. Read the <link>docs</link>.")}
      {intl.get("CHECK_COUNT").d("30 day checks")}
      {intl.get("CHECK_COUNT").d("30 checks")}
      {intl.get("TOTAL_COUNT", { count }).d(\`共\${count}个\`)}
      {intl.get("HOUR_LABEL").d(\`\${hr}点\`)}
      {intl.get("DISPLAY_NAME", { name: username }).d("User: {name}")}
      {intl.get("MV_LEVEL").d("高")}
      {intl.get("MISSING_LABEL").d("Submit request")}
      {intl.getHTML("LEGACY_HTML").d("<b>Legacy</b> message")}
      {/* {intl.get("COMMENTED_LABEL").d("Commented only")} */}
    </div>
  );
}
`);

  writeText(path.join(root, "src", "core", "init.ts"), `
import intl from "react-intl-universal";

const LOCALE = {
  ZH_CN: "zh_CN",
  EN_US: "en_US",
};

function getCurrentLocale() {
  return LOCALE.ZH_CN;
}

const localeData = {
  [LOCALE.ZH_CN]: () => import("../locales/zh_CN.json"),
  [LOCALE.EN_US]: () => import("../locales/en_US.json"),
};

export async function initIntl() {
  const currentLocale = await getCurrentLocale();
  await intl.init({
    currentLocale,
    locales: await localeData[currentLocale](),
  });
}
`);

  writeText(path.join(root, "src", "UnusedProviderImport.tsx"), `
import { ConfigProvider } from "antd";

export function UnusedProviderImport() {
  return <div>provider import is unused here</div>;
}
`);

  writeText(path.join(root, "src", "Hardcoded.tsx"), `
export function Hardcoded() {
  const suggestionLangMap = {
    en: "Add schedule parameter {aaa}",
    zh: "请添加调度参数{aaa}",
  };
  return (
    <div>
      <button>提交</button>
      <input placeholder="请输入名称" />
    </div>
  );
}
`);

  writeText(path.join(root, "src", "modules", "demo", "Demo.tsx"), `
export function Demo() {
  return <div>演示中文</div>;
}
`);

  writeJson(path.join(root, "src", "locales", "en_US.json"), {
    HELLO_USER: "Hello, {username}. Read the <link>docs</link>.",
    CHECK_COUNT: "30 day checks",
    TOTAL_COUNT: "{count} total",
    HOUR_LABEL: "{hr}",
    DISPLAY_NAME: "User: {name}",
    MV_LEVEL: "Highly Recommend",
    COMMENTED_LABEL: "Commented only",
    STALE_ONLY: "No active source",
  });

  writeJson(path.join(root, "src", "locales", "zh_CN.json"), {
    HELLO_USER: "你好，{user}。阅读<link>文档</link>。",
    CHECK_COUNT: "30天内校验数",
    TOTAL_COUNT: "共{count}个",
    HOUR_LABEL: "{hr}点",
    DISPLAY_NAME: "用户：${userName}",
    MV_LEVEL: "高",
    COMMENTED_LABEL: "仅在注释中使用",
    STALE_ONLY: "没有活跃源码",
  });

  writeJson(path.join(root, "tmp", "export", "en_US.json"), {
    HELLO_USER: "Hello, {username}. Read the <link>docs</link>.",
    CHECK_COUNT: "30 day checks",
  });

  writeJson(path.join(root, "tmp", "deltas", "ja_JP.json"), {
    locale: "ja_JP",
    translations: {
      HELLO_USER: "<link>ドキュメント</link>を読んでください。",
    },
  });

  return root;
}

function main() {
  const root = createFixture();
  const keep = process.argv.includes("--keep");

  try {
    assert(
      getLengthRiskWarning({
        key: "mv_rec_level_High",
        locale: "en_US",
        defaultMessage: "高",
        translatedMessage: "High",
      }) === null,
      "length risk should ignore short natural enum translations"
    );
    const longEnumRisk = getLengthRiskWarning({
      key: "mv_rec_level_High",
      locale: "en_US",
      defaultMessage: "高",
      translatedMessage: "Highly Recommend",
      sourceMessage: {
        lineText: "{ value: MvRecommendLevel.High, label: intl.get('mv_rec_level_High').d('高') }",
      },
    });
    assert(longEnumRisk?.severity === "high", "length risk should still report verbose compact enum translations");

    const discoveryResult = runScript(root, "discover-project-i18n.mjs", [
      "--source", "src",
      "--locales", "src/locales",
      "--expected-locales", "en_US,zh_CN,ja_JP",
      "--json",
    ]);
    const discoveryReport = JSON.parse(discoveryResult.stdout);
    assert(discoveryReport.missingExpectedLocales.includes("ja_JP"), "discovery should report missing expected locale files");
    assert(discoveryReport.scripts.some((script) => script.name === "intl:export" && !script.exportLanguages.includes("ja_JP")), "discovery should preserve export-language lists for export diagnostics");
    assert(discoveryReport.localeSupportChecks.some((check) => (
      check.packageName === "dayjs"
      && check.expected.some((item) => item.locale === "ja_JP" && item.supported === false)
    )), "discovery should report unsupported expected locales in dayjs");
    assert(discoveryReport.connectionPoints.some((point) => (
      point.filePath.endsWith("UnusedProviderImport.tsx")
      && point.taskRelevant === false
      && point.role === "import-only"
    )), "discovery should mark import-only ConfigProvider matches as low-relevance evidence");
    writeJson(path.join(root, "tmp", "discovery.json"), discoveryReport);

    const exportResult = runScript(root, "verify-locale-export.mjs", [
      "--locales", "tmp/export",
      "--expected-locales", "en_US,ja_JP",
      "--reference-locale", "en_US",
      "--json",
    ], { expectFailure: true });
    const exportReport = JSON.parse(exportResult.stdout);
    assert(exportReport.status === "failed", "export verification should fail");
    assert(exportReport.issues.some((issue) => issue.type === "missing-locale-file" && issue.locale === "ja_JP"), "export report should mention missing ja_JP");
    writeJson(path.join(root, "tmp", "export-verify.json"), exportReport);

    const translationTaskResult = runScript(root, "create-translation-tasks.mjs", [
      "--source", "src",
      "--locales", "src/locales",
      "--default-locale", "en_US",
      "--target-locales", "ja_JP",
      "--output", "tmp/tasks",
      "--sort", "source",
      "--task-size-warning-bytes", "1000",
      "--task-size-target-bytes", "700",
      "--json",
    ]);
    const translationTaskManifest = JSON.parse(translationTaskResult.stdout);
    assert(translationTaskManifest.sortMode === "source", "translation task manifest should record source sorting");
    assert(translationTaskManifest.referenceTranslationItemCount > 0, "translation task manifest should count items with reference translations");
    assert(translationTaskManifest.referenceTranslationLocales.includes("zh_CN"), "translation task manifest should list reference translation locales");
    assert(translationTaskManifest.commentedSourceItemCount > 0, "translation task manifest should count likely commented source items");
    assert(translationTaskManifest.taskItemCount > 0, "translation task manifest should record total task item count");
    assert(translationTaskManifest.taskSize?.largeMarkdownTaskCount > 0, "translation task manifest should warn when task files are too large");
    assert(translationTaskManifest.taskSize?.warnings?.some((warning) => warning.type === "large-translation-task"), "translation task manifest should include large task warning details");
    assert(Number.isFinite(translationTaskManifest.taskSize?.recommendedMaxItemsPerTask), "translation task manifest should recommend a smaller max-items-per-task");
    const taskMarkdown = fs.readFileSync(path.join(root, "tmp", "tasks", "ja_JP.md"), "utf8");
    assert(taskMarkdown.includes("Sort: source"), "translation task markdown should show source sort mode");
    assert(taskMarkdown.includes("Translate the intended business meaning"), "translation task should ask for meaning-based translation");
    assert(taskMarkdown.includes("this codebase's product flow"), "translation task should require current codebase business context");
    assert(taskMarkdown.includes("Prefer sense-for-sense localization"), "translation task should require sense-for-sense localization");
    assert(taskMarkdown.includes("user action, subject, object, status"), "translation task should ask translators to identify business context before translating");
    assert(taskMarkdown.includes("When translating between any source and target locale"), "translation task should warn against word-by-word translation across any locale pair");
    assert(taskMarkdown.includes("different word order, phrasing, or sentence structure"), "translation task should allow natural target-locale structure");
    assert(taskMarkdown.includes("Reference translations:"), "translation task markdown should include existing non-target locale references");
    assert(taskMarkdown.includes("Use reference translations only as terminology and tone hints"), "translation task should explain how reference translations may be used");
    assert(taskMarkdown.includes("inspect the source file around the reported line"), "translation task should ask translators to inspect source context when ambiguous");
    assert(taskMarkdown.includes("native product writer"), "translation task should require natural product-copy wording");
    assert(taskMarkdown.includes("Source call:") && taskMarkdown.includes("HELLO_USER"), "translation task should include a compressed source call for multiline intl.get chains");
    assert(taskMarkdown.includes("Source context:") && taskMarkdown.includes("const username"), "translation task should include nearby source context for business meaning");
    assert(taskMarkdown.includes("appears to be inside a comment"), "translation task markdown should flag likely commented source calls");
    const translationTask = readJson(path.join(root, "tmp", "tasks", "ja_JP.json"));
    const helloTaskItem = translationTask.items.find((item) => item.key === "HELLO_USER");
    assert(helloTaskItem?.referenceTranslations?.some((item) => item.locale === "zh_CN" && item.value.includes("你好")), "translation task JSON should include existing non-target locale reference translations");
    assert(helloTaskItem?.source?.contextSnippet?.includes("const username"), "translation task JSON should include nearby source context");
    const commentedTaskItem = translationTask.items.find((item) => item.key === "COMMENTED_LABEL");
    assert(commentedTaskItem?.source?.isLikelyCommented === true, "translation task JSON should flag likely commented source calls");

    runScript(root, "create-translation-tasks.mjs", [
      "--source", "src",
      "--locales", "src/locales",
      "--default-locale", "zh_CN",
      "--target-locales", "en_US",
      "--output", "tmp/tasks-en",
      "--json",
    ]);
    const englishTaskMarkdown = fs.readFileSync(path.join(root, "tmp", "tasks-en", "en_US.md"), "utf8");
    assert(englishTaskMarkdown.includes("For English target locales, follow professional casing rules"), "English translation tasks should include casing guidance");
    assert(englishTaskMarkdown.includes("Title Case") && englishTaskMarkdown.includes("Sentence case"), "English translation task guidance should distinguish Title Case and Sentence case");
    const englishTask = readJson(path.join(root, "tmp", "tasks-en", "en_US.json"));
    assert(englishTask.instructions.some((instruction) => instruction.includes("For English target locales")), "English task JSON instructions should include casing guidance");
    const englishReviewKey = englishTask.items[0].key;
    writeJson(path.join(root, "tmp", "deltas-en", "en_US.json"), {
      locale: "en_US",
      translations: {
        [englishReviewKey]: "English review sample",
      },
    });
    writeJson(path.join(root, "tmp", "english-delta-review.json"), {
      status: "passed",
      issues: [],
      warnings: [],
      issueCount: 0,
      warningCount: 0,
      reviewedEntryCount: 1,
    });
    runScript(root, "create-translation-review-tasks.mjs", [
      "--review", "tmp/english-delta-review.json",
      "--tasks", "tmp/tasks-en/manifest.json",
      "--deltas", "tmp/deltas-en",
      "--include-all",
      "--output", "tmp/translation-review-en",
      "--json",
    ]);
    const englishReviewMarkdown = fs.readFileSync(path.join(root, "tmp", "translation-review-en", "en_US.md"), "utf8");
    assert(englishReviewMarkdown.includes("verify professional casing"), "English translation review tasks should include casing review guidance");

    const changedKeyAuditResult = runScript(root, "audit-changed-locale-keys.mjs", [
      "--tasks", "tmp/tasks/manifest.json",
      "--locales", "src/locales",
      "--default-locale", "en_US",
      "--json",
    ], { expectFailure: true });
    const changedKeyAuditReport = JSON.parse(changedKeyAuditResult.stdout);
    assert(changedKeyAuditReport.status === "failed", "changed-key audit should fail when changed keys are not synchronized");
    assert(changedKeyAuditReport.locales.includes("ja_JP"), "changed-key audit should include task target locales even when the locale file is missing");
    assert(changedKeyAuditReport.keys.some((item) => (
      item.key === "HELLO_USER"
      && item.locales.some((locale) => (
        locale.locale === "zh_CN"
        && locale.issues.some((issue) => issue.type === "locale-contract-mismatch")
      ))
    )), "changed-key audit should report existing locale contract mismatches");
    assert(changedKeyAuditReport.keys.some((item) => (
      item.locales.some((locale) => (
        locale.locale === "ja_JP"
        && locale.issues.some((issue) => issue.type === "missing-locale-file")
      ))
    )), "changed-key audit should report missing task target locale files");
    writeJson(path.join(root, "tmp", "changed-key-audit.json"), changedKeyAuditReport);

    writeJson(path.join(root, "tmp", "review-deltas", "ja_JP.json"), {
      locale: "ja_JP",
      translations: {
        HELLO_USER: "Hello, {username}. Read the <link>docs</link>.",
      },
    });
    const deltaReviewResult = runScript(root, "review-translation-deltas.mjs", [
      "--source", "src",
      "--locales", "src/locales",
      "--default-locale", "en_US",
      "--tasks", "tmp/tasks/manifest.json",
      "--deltas", "tmp/review-deltas",
      "--json",
    ], { expectFailure: true });
    const deltaReviewReport = JSON.parse(deltaReviewResult.stdout);
    assert(deltaReviewReport.status === "failed", "delta review should fail when assigned task keys are missing");
    assert(deltaReviewReport.issues.some((issue) => issue.type === "missing-task-translation"), "delta review should report missing task translations");
    assert(deltaReviewReport.warnings.some((warning) => warning.type === "same-as-default"), "delta review should flag translations copied from the default message");
    writeJson(path.join(root, "tmp", "delta-review.json"), deltaReviewReport);

    const missingDeltasReviewResult = runScript(root, "review-translation-deltas.mjs", [
      "--source", "src",
      "--locales", "src/locales",
      "--default-locale", "en_US",
      "--tasks", "tmp/tasks/manifest.json",
      "--deltas", "tmp/missing-deltas",
      "--json",
    ], { expectFailure: true });
    const missingDeltasReviewReport = JSON.parse(missingDeltasReviewResult.stdout);
    assert(missingDeltasReviewReport.issueCounts["missing-deltas-directory"] === 1, "delta review should report a missing deltas directory separately");
    writeJson(path.join(root, "tmp", "missing-deltas-review.json"), missingDeltasReviewReport);

    const translationReviewTaskResult = runScript(root, "create-translation-review-tasks.mjs", [
      "--review", "tmp/delta-review.json",
      "--tasks", "tmp/tasks/manifest.json",
      "--deltas", "tmp/review-deltas",
      "--output", "tmp/translation-review",
      "--json",
    ]);
    const translationReviewTaskManifest = JSON.parse(translationReviewTaskResult.stdout);
    assert(translationReviewTaskManifest.taskItemCount === 1, "translation review tasks should include warning-backed returned translations");
    assert(translationReviewTaskManifest.reasonCounts["warning:same-as-default"] === 1, "translation review tasks should count warning reasons");
    const translationReviewTask = readJson(path.join(root, "tmp", "translation-review", "ja_JP.json"));
    assert(translationReviewTask.items[0].key === "HELLO_USER", "translation review task should preserve the warning key");
    assert(translationReviewTask.items[0].source?.callText?.includes("HELLO_USER"), "translation review task should preserve source call context");
    assert(translationReviewTask.items[0].source?.contextSnippet?.includes("const username"), "translation review task should preserve nearby source context");
    const translationReviewMarkdown = fs.readFileSync(path.join(root, "tmp", "translation-review", "ja_JP.md"), "utf8");
    assert(translationReviewMarkdown.includes("not an automatic rewrite task"), "translation review markdown should explain the review boundary");
    assert(translationReviewMarkdown.includes("intended business meaning"), "translation review markdown should require meaning review");
    assert(translationReviewMarkdown.includes("actual product flow in this codebase"), "translation review markdown should require codebase-specific business-context review");
    assert(translationReviewMarkdown.includes("sense-for-sense localization"), "translation review markdown should require natural localization review");
    assert(translationReviewMarkdown.includes("Source context:") && translationReviewMarkdown.includes("const username"), "translation review markdown should include nearby source context");

    writeJson(path.join(root, "tmp", "review-deltas-complete", "ja_JP.json"), {
      locale: "ja_JP",
      translations: {
        HELLO_USER: "{username}さん、<link>docs</link>をご確認ください。",
        CHECK_COUNT: "30日間のチェック",
        TOTAL_COUNT: "合計{count}",
        HOUR_LABEL: "{hr}時",
        DISPLAY_NAME: "ユーザー: {name}",
        MV_LEVEL: "高",
        COMMENTED_LABEL: "コメント内のみ",
        STALE_ONLY: "有効なソースなし",
      },
    });
    const deltaReviewPassResult = runScript(root, "review-translation-deltas.mjs", [
      "--source", "src",
      "--locales", "src/locales",
      "--default-locale", "en_US",
      "--tasks", "tmp/tasks/manifest.json",
      "--deltas", "tmp/review-deltas-complete",
      "--json",
    ]);
    const deltaReviewPassReport = JSON.parse(deltaReviewPassResult.stdout);
    assert(deltaReviewPassReport.status === "passed", "delta review should pass complete contract-safe translations");
    writeJson(path.join(root, "tmp", "delta-review-pass.json"), deltaReviewPassReport);

    const translationReviewAllResult = runScript(root, "create-translation-review-tasks.mjs", [
      "--review", "tmp/delta-review-pass.json",
      "--tasks", "tmp/tasks/manifest.json",
      "--deltas", "tmp/review-deltas-complete",
      "--include-all",
      "--output", "tmp/translation-review-all",
      "--json",
    ]);
    const translationReviewAllManifest = JSON.parse(translationReviewAllResult.stdout);
    assert(translationReviewAllManifest.taskItemCount === deltaReviewPassReport.reviewedEntryCount, "translation review tasks should support include-all full subjective review");
    assert(translationReviewAllManifest.reasonCounts["sample:all-returned-translations"] >= 1, "include-all review tasks should mark ordinary sample reasons");

    const applyResult = runScript(root, "apply-translation-deltas.mjs", [
      "--locales", "src/locales",
      "--deltas", "tmp/deltas",
      "--default-locale", "en_US",
      "--dry-run",
      "--json",
    ], { expectFailure: true });
    const applyReport = JSON.parse(applyResult.stdout);
    assert(applyReport.results[0].skipped.some((item) => item.reason.includes("missing vars")), "delta merge should reject missing ICU variables");
    writeJson(path.join(root, "tmp", "apply-result.json"), applyReport);

    const auditResult = runScript(root, "audit-i18n-contract.mjs", [
      "--source", "src",
      "--locales", "src/locales",
      "--default-locale", "en_US",
      "--json",
    ], { expectFailure: true });
    const auditReport = JSON.parse(auditResult.stdout);
    assert(auditReport.issues.some((issue) => issue.type === "locale-contract-mismatch"), "audit should detect locale contract mismatch");
    assert(auditReport.warnings.some((warning) => warning.type === "deprecated-getHTML"), "audit should warn about getHTML");
    assert(auditReport.warnings.some((warning) => warning.type === "template-default-message" && warning.key === "TOTAL_COUNT"), "audit should warn about template defaults");
    writeJson(path.join(root, "tmp", "audit.json"), auditReport);
    writeJson(path.join(root, "tmp", "audit-no-hard-blockers.json"), {
      ...auditReport,
      issues: [],
    });
    const noHardBlockerHandoff = runScript(root, "create-i18n-handoff.mjs", [
      "--audit", "tmp/audit-no-hard-blockers.json",
    ]).stdout;
    assert(noHardBlockerHandoff.includes("## Audit Fix Tasks"), "handoff markdown should include audit fix task section");
    assert(noHardBlockerHandoff.includes("Not required: locale audit has no hard blockers"), "handoff should not require audit fix tasks when there are no audit hard blockers");
    assert(!noHardBlockerHandoff.includes("## Audit Fix Tasks\nReport: missing"), "handoff should not report missing audit fix tasks when audit has no hard blockers");
    assert(noHardBlockerHandoff.includes("Generate advisory tasks for JavaScript template interpolation inside .d()."), "handoff should recommend template-default advisory tasks when those warnings are uncovered");
    assert(noHardBlockerHandoff.includes("Plan deprecated intl.getHTML migration tasks."), "handoff should recommend getHTML migration tasks when those warnings are uncovered");

    const lengthAuditResult = runScript(root, "audit-i18n-contract.mjs", [
      "--source", "src",
      "--locales", "src/locales",
      "--default-locale", "zh_CN",
      "--length-warnings",
      "--json",
    ], { expectFailure: true });
    const lengthAuditReport = JSON.parse(lengthAuditResult.stdout);
    const mvLevelWarning = lengthAuditReport.warnings.find((warning) => (
      warning.type === "long-translation" && warning.key === "MV_LEVEL" && warning.locale === "en_US"
    ));
    assert(mvLevelWarning?.source?.lineText?.includes("MV_LEVEL"), "length warning should include source usage context");
    writeJson(path.join(root, "tmp", "length-audit.json"), lengthAuditReport);

    const auditSummaryResult = runScript(root, "summarize-i18n-audit.mjs", [
      "--report", "tmp/length-audit.json",
      "--json",
    ]);
    const auditSummary = JSON.parse(auditSummaryResult.stdout);
    assert(auditSummary.groups.some((group) => group.type === "locale-contract-mismatch"), "audit summary should group contract mismatches");
    assert(auditSummary.groups.some((group) => (
      group.type === "long-translation"
      && group.examples.some((example) => example.key === "MV_LEVEL" && example.source?.lineText?.includes("MV_LEVEL"))
    )), "audit summary should preserve source usage for length warnings");

    runScript(root, "create-audit-fix-tasks.mjs", [
      "--audit", "tmp/length-audit.json",
      "--source", "src",
      "--locales", "src/locales",
      "--default-locale", "zh_CN",
      "--include-warnings", "long-translation",
      "--warning-severity", "high",
      "--warnings-only",
      "--output", "tmp/length-review",
      "--json",
    ]);
    const lengthReviewManifest = readJson(path.join(root, "tmp", "length-review", "manifest.json"));
    assert(lengthReviewManifest.warningsOnly === true, "long-translation review tasks should support warnings-only mode");
    assert(lengthReviewManifest.hardBlockerTaskCount === 0, "warnings-only length review tasks should not include hard blocker tasks");
    assert(lengthReviewManifest.taskFiles.every((file) => file.type === "long-translation"), "warnings-only length review task files should only include long-translation batches");
    const lengthReviewTask = readJson(path.join(root, "tmp", "length-review", "long-translation.json"));
    const mvLevelLengthItem = lengthReviewTask.items.find((item) => item.key === "MV_LEVEL");
    assert(mvLevelLengthItem, "long-translation tasks should include high-severity length warnings");
    assert(mvLevelLengthItem.lengthRisk?.severity === "high", "long-translation tasks should preserve length-risk severity");
    assert(mvLevelLengthItem.sourceOccurrence?.lineText?.includes("MV_LEVEL"), "long-translation tasks should include source usage context");
    assert(
      lengthReviewTask.instructions.some((instruction) => instruction.includes("warning is a review queue")),
      "long-translation tasks should tell agents not to mechanically shorten every warning"
    );

    const auditFixResult = runScript(root, "create-audit-fix-tasks.mjs", [
      "--audit", "tmp/audit.json",
      "--source", "src",
      "--locales", "src/locales",
      "--default-locale", "en_US",
      "--include-warnings", "template-default-message,deprecated-getHTML",
      "--output", "tmp/audit-fix",
      "--json",
    ]);
    const auditFixManifest = JSON.parse(auditFixResult.stdout);
    assert(auditFixManifest.hardBlockerTaskCount > 0, "audit fix tasks should cover hard blockers");
    assert(auditFixManifest.hardBlockerIssueCount > 0, "audit fix tasks should count source hard blocker issues");
    assert(auditFixManifest.hardBlockerCoveredIssueCount >= auditFixManifest.hardBlockerIssueCount, "audit fix tasks should report full hard blocker issue coverage");
    assert(auditFixManifest.typeCoverage["missing-locale-key"].grouped === true, "audit fix task coverage should mark grouped missing-locale-key tasks");
    assert(auditFixManifest.advisoryTaskCount > 0, "audit fix tasks should optionally cover advisory warnings");
    assert(auditFixManifest.taskFiles.some((file) => file.type === "template-default-message"), "audit fix tasks should include template-default-message tasks when requested");
    assert(auditFixManifest.taskFiles.some((file) => file.type === "deprecated-getHTML"), "audit fix tasks should include deprecated-getHTML tasks when requested");
    const conflictTask = readJson(path.join(root, "tmp", "audit-fix", "conflicting-default-message.json"));
    assert(
      conflictTask.instructions.some((instruction) => instruction.includes("existing sibling keys")),
      "conflicting-default-message tasks should ask agents to check existing sibling keys before creating new keys"
    );
    const contractTask = readJson(path.join(root, "tmp", "audit-fix", "locale-contract-mismatch.json"));
    assert(contractTask.items.some((item) => (
      item.key === "HELLO_USER"
      && item.suggestedLocaleValue?.includes("{username}")
    )), "locale-contract-mismatch tasks should suggest preserving translated text while fixing ICU variable names");
    assert(contractTask.items.some((item) => (
      item.key === "DISPLAY_NAME"
      && item.suggestedLocaleValue === "用户：{name}"
    )), "locale-contract-mismatch tasks should remove template-style $ when fixing locale JSON ICU variables");
    const missingTask = readJson(path.join(root, "tmp", "audit-fix", "missing-locale-key.json"));
    const missingLabelItem = missingTask.items.find((item) => item.key === "MISSING_LABEL");
    assert(missingLabelItem, "audit fix tasks should include missing locale keys");
    assert(missingLabelItem.suggestedMissingLocaleValues.some((item) => (
      item.locale === "en_US"
      && item.suggestedValue === "Submit request"
      && item.needsTranslation === false
    )), "missing-locale-key tasks should suggest .d() source text for a missing default-locale value");
    assert(missingLabelItem.suggestedMissingLocaleValues.some((item) => (
      item.locale === "zh_CN"
      && item.needsTranslation === true
      && item.sourceDefaultMessage === "Submit request"
    )), "missing-locale-key tasks should ask translated locales to translate from the source meaning");
    const templateTask = readJson(path.join(root, "tmp", "audit-fix", "template-default-message.json"));
    assert(templateTask.items.some((item) => item.callText?.includes("HOUR_LABEL")), "audit fix tasks should include a compressed source call for template warnings");
    assert(templateTask.items.some((item) => (
      item.key === "HOUR_LABEL"
      && item.missingValueVariables?.includes("hr")
    )), "template-default-message tasks should flag variables missing from intl.get values");
    const deprecatedGetHTMLTask = readJson(path.join(root, "tmp", "audit-fix", "deprecated-getHTML.json"));
    assert(
      deprecatedGetHTMLTask.instructions.some((instruction) => instruction.includes("rich tag formatters")),
      "deprecated-getHTML tasks should instruct migration to rich tag formatters"
    );
    assert(
      deprecatedGetHTMLTask.items.some((item) => item.lineText?.includes("getHTML")),
      "deprecated-getHTML tasks should include source line context"
    );

    const hardcodedResult = runScript(root, "find-hardcoded-cjk.mjs", [
      "--source", "src",
      "--json",
    ]);
    const hardcodedReport = JSON.parse(hardcodedResult.stdout);
    assert(hardcodedReport.candidateCount === hardcodedReport.candidates.length, "hardcoded CJK scan should report candidateCount explicitly");
    assert(hardcodedReport.priorityCounts.high >= 1, "hardcoded CJK scan should report priorityCounts separately");
    assert(hardcodedReport.kindCounts["raw-jsx-text"] >= 1, "hardcoded CJK scan should report kindCounts separately");
    assert(hardcodedReport.kindCounts["language-map-string"] >= 1, "hardcoded CJK scan should classify explicit local language maps separately");
    assert(hardcodedReport.candidates.some((candidate) => candidate.kind === "raw-jsx-text"), "hardcoded CJK scan should detect raw JSX text");
    writeJson(path.join(root, "tmp", "hardcoded.json"), hardcodedReport);

    const hardcodedFixResult = runScript(root, "create-hardcoded-cjk-fix-tasks.mjs", [
      "--hardcoded", "tmp/hardcoded.json",
      "--output", "tmp/hardcoded-fix",
      "--ignore", "src/modules/demo",
      "--json",
    ]);
    const hardcodedFixManifest = JSON.parse(hardcodedFixResult.stdout);
    assert(hardcodedFixManifest.taskItemCount > 0, "hardcoded CJK fix tasks should cover scan candidates");
    assert(hardcodedFixManifest.ignorePatterns.includes("src/modules/demo"), "hardcoded CJK fix tasks should preserve ignored path patterns");
    const hardcodedFixMarkdown = fs.readFileSync(path.join(root, hardcodedFixManifest.taskFiles[0].markdownPath), "utf8");
    assert(hardcodedFixMarkdown.includes("Preserve the full user-facing business meaning"), "hardcoded CJK fix tasks should warn against fragment-only extraction");
    assert(hardcodedFixMarkdown.includes("natural target-locale product copy"), "hardcoded CJK fix tasks should require natural translated-locale wording");

    const handoffArgs = [
      "--discovery", "tmp/discovery.json",
      "--export-verify", "tmp/export-verify.json",
      "--audit", "tmp/audit.json",
      "--hardcoded", "tmp/hardcoded.json",
      "--audit-fix-tasks", "tmp/audit-fix/manifest.json",
      "--length-review-tasks", "tmp/length-review/manifest.json",
      "--hardcoded-fix-tasks", "tmp/hardcoded-fix/manifest.json",
      "--tasks", "tmp/tasks/manifest.json",
      "--delta-review", "tmp/delta-review.json",
      "--translation-review-tasks", "tmp/translation-review/manifest.json",
      "--apply", "tmp/apply-result.json",
      "--changed-key-audit", "tmp/changed-key-audit.json",
    ];
    const handoffResult = runScript(root, "create-i18n-handoff.mjs", [
      ...handoffArgs,
      "--json",
    ]);
    const handoff = JSON.parse(handoffResult.stdout);
    assert(handoff.status === "blocked", "handoff should be blocked");
    assert(handoff.blockers.some((item) => item.includes("Locale export verification failed")), "handoff should include export blocker");
    assert(handoff.blockers.some((item) => item.includes("Expected locale support is missing")), "handoff should include runtime/provider locale support blocker");
    assert(handoff.blockers.some((item) => item.includes("locale")), "handoff provider blocker should include source evidence");
    assert(handoff.discovery.unsupportedExpectedLocales.some((item) => (
      item.packageName === "dayjs"
      && item.locale === "ja_JP"
      && item.packageLocale === "ja"
      && item.source?.includes("locale")
    )), "handoff should preserve unsupported provider locale source details");
    assert(handoff.auditFixTasks.hardBlockerIssueCount > 0, "handoff should summarize audit fix source hard blocker issues");
    assert(handoff.auditFixTasks.hardBlockerCoveredIssueCount >= handoff.auditFixTasks.hardBlockerIssueCount, "handoff should preserve audit fix issue coverage");
    assert(handoff.lengthReviewTasks.longTranslationTaskItemCount > 0, "handoff should summarize translation length review tasks");
    assert(handoff.lengthReviewTasks.taskFiles.some((task) => task.markdownPath?.includes("long-translation")), "handoff should expose long-translation task file samples");
    assert(handoff.tasks.referenceTranslationItemCount > 0, "handoff should summarize translation task reference coverage");
    assert(handoff.tasks.commentedSourceItemCount > 0, "handoff should summarize likely commented source task items");
    assert(handoff.translationReviewTasks.taskItemCount === 1, "handoff should summarize translation quality review tasks");
    assert(handoff.translationReviewTasks.reasonCounts["warning:same-as-default"] === 1, "handoff should preserve translation review task reasons");
    assert(handoff.hardcoded.ignoredCandidateCount > 0, "handoff should summarize hardcoded CJK candidates ignored by fix-task patterns");
    assert(handoff.hardcoded.actionableCandidateCount < handoff.hardcoded.candidateCount, "handoff should distinguish actionable hardcoded CJK candidates from raw scan candidates");
    assert(handoff.hardcoded.priorityCounts.high >= 1, "handoff should preserve hardcoded priority counts");
    assert(handoff.hardcoded.kindCounts["raw-jsx-text"] >= 1, "handoff should preserve hardcoded kind counts");
    assert(!handoff.hardcoded.topCandidates.some((item) => item.filePath?.includes("src/modules/demo")), "handoff top hardcoded candidates should follow fix-task ignore patterns");
    assert(handoff.deltaReview.issueCount > 0, "handoff should summarize delta review issues");
    assert(handoff.blockers.some((item) => item.includes("Translation delta review failed")), "handoff should include real delta review blockers even when locale readiness is blocked");
    assert(handoff.changedKeyAudit.issueCount > 0, "handoff should summarize changed-key audit issues");
    assert(handoff.blockers.some((item) => item.includes("Changed-key audit failed")), "handoff should block when changed-key sync fails");
    assert(handoff.nextActions.some((item) => item.action.includes("Fix changed-key locale synchronization issues")), "handoff should recommend fixing changed-key sync issues");
    assert(handoff.nextActions[0].action.includes("Resolve unsupported runtime locale providers"), "handoff should prioritize runtime locale blockers before translation work");
    assert(handoff.nextActions.some((item) => item.action.includes("Fix locale export output")), "handoff should recommend fixing locale export output");
    assert(handoff.nextActions.some((item) => item.action.includes("Fix translation delta review issues")), "handoff should recommend fixing real delta review issues");
    assert(handoff.nextActions.some((item) => item.action.includes("Review high-severity translation length tasks")), "handoff should recommend reviewing generated length tasks");
    const advisoryAction = handoff.nextActions.find((item) => item.action.includes("Review generated advisory i18n tasks"));
    assert(advisoryAction?.priority === "P3", "handoff should recommend reviewing generated advisory warning tasks as P3");
    assert(advisoryAction.evidence.some((item) => item.includes("template-default-message")), "handoff advisory action should include covered warning types");
    assert(advisoryAction.evidence.some((item) => item.includes("deprecated-getHTML") && item.endsWith(".md")), "handoff advisory action should sample a deprecated-getHTML task file when available");
    const handoffMarkdown = runScript(root, "create-i18n-handoff.mjs", handoffArgs).stdout;
    assert(handoffMarkdown.includes("## Audit Fix Tasks"), "handoff markdown should include audit fix task details");
    assert(handoffMarkdown.includes("## Changed-Key Audit"), "handoff markdown should include changed-key audit details");
    assert(handoffMarkdown.includes("Source intl.get(...).d(...) messages:"), "handoff markdown should label audit source message count clearly");
    assert(handoffMarkdown.includes("- Task file samples:"), "handoff markdown audit fix section should include task file samples");
    assert(handoffMarkdown.includes("deprecated-getHTML") && handoffMarkdown.includes(".md"), "handoff markdown audit fix samples should include deprecated-getHTML task files when available");
    const staleDiscoveryReport = JSON.parse(JSON.stringify(discoveryReport));
    staleDiscoveryReport.localeSummaries[0].messageCount = 0;
    writeJson(path.join(root, "tmp", "stale-discovery-report.json"), staleDiscoveryReport);
    const staleExportReport = JSON.parse(JSON.stringify(exportReport));
    staleExportReport.localeSummaries[0].messageCount = 0;
    writeJson(path.join(root, "tmp", "stale-export-report.json"), staleExportReport);
    const staleEvidenceHandoffResult = runScript(root, "create-i18n-handoff.mjs", [
      "--discovery", "tmp/stale-discovery-report.json",
      "--export-verify", "tmp/stale-export-report.json",
      "--json",
    ]);
    const staleEvidenceHandoff = JSON.parse(staleEvidenceHandoffResult.stdout);
    assert(staleEvidenceHandoff.reviewItems.some((item) => item.includes("Discovery report locale counts are stale")), "handoff should flag stale discovery locale counts");
    assert(staleEvidenceHandoff.reviewItems.some((item) => item.includes("Export verification report locale counts are stale")), "handoff should flag stale export verification locale counts");
    assert(staleEvidenceHandoff.nextActions.some((item) => item.action.includes("Regenerate stale discovery/export verification reports")), "handoff should recommend regenerating stale evidence reports");
    const staleEvidenceMarkdown = runScript(root, "create-i18n-handoff.mjs", [
      "--discovery", "tmp/stale-discovery-report.json",
      "--export-verify", "tmp/stale-export-report.json",
    ]).stdout;
    assert(staleEvidenceMarkdown.includes("current="), "handoff markdown should show current locale counts when report counts are stale");
    const nextActionPriorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    assert(handoff.nextActions.every((item, index, items) => (
      index === 0
      || nextActionPriorityOrder[items[index - 1].priority] <= nextActionPriorityOrder[item.priority]
    )), "handoff next actions should be sorted by priority");

    const missingDeltasBlockedHandoffResult = runScript(root, "create-i18n-handoff.mjs", [
      "--discovery", "tmp/discovery.json",
      "--export-verify", "tmp/export-verify.json",
      "--tasks", "tmp/tasks/manifest.json",
      "--delta-review", "tmp/missing-deltas-review.json",
      "--json",
    ]);
    const missingDeltasBlockedHandoff = JSON.parse(missingDeltasBlockedHandoffResult.stdout);
    assert(!missingDeltasBlockedHandoff.blockers.some((item) => item.includes("Translation delta review failed")), "handoff should defer missing translation deltas when locale readiness is blocked");
    assert(missingDeltasBlockedHandoff.reviewItems.some((item) => item.includes("defer broad translation")), "handoff should explain that translation deltas are deferred until locale readiness blockers are resolved");
    assert(missingDeltasBlockedHandoff.deferredStages.some((item) => item.stage === "translation-quality-review"), "handoff should mark translation quality review as deferred when broad translation is deferred");
    assert(missingDeltasBlockedHandoff.deferredStages.some((item) => item.stage === "delta-merge"), "handoff should mark delta merge as deferred when broad translation is deferred");
    assert(!missingDeltasBlockedHandoff.nextActions.some((item) => item.action.includes("Create translation delta JSON")), "handoff should not recommend broad translation while locale readiness is blocked");
    assert(missingDeltasBlockedHandoff.nextActions.some((item) => item.action.includes("Regenerate oversized translation tasks")), "handoff should recommend smaller translation task batches when task files are too large");
    const missingDeltasBlockedMarkdown = runScript(root, "create-i18n-handoff.mjs", [
      "--discovery", "tmp/discovery.json",
      "--export-verify", "tmp/export-verify.json",
      "--tasks", "tmp/tasks/manifest.json",
      "--delta-review", "tmp/missing-deltas-review.json",
    ]).stdout;
    assert(missingDeltasBlockedMarkdown.includes("## Translation Quality Review Tasks"), "handoff markdown should include the translation quality review section");
    assert(missingDeltasBlockedMarkdown.includes("## Delta Merge"), "handoff markdown should include the delta merge section");
    assert(missingDeltasBlockedMarkdown.includes("Deferred: Translation deltas are not generated yet"), "handoff markdown should explain deferred downstream translation stages");
    assert(missingDeltasBlockedMarkdown.includes("Task size warnings:"), "handoff markdown should include translation task size warnings");
    assert(missingDeltasBlockedMarkdown.includes("Recommended --max-items-per-task"), "handoff markdown should show recommended smaller task batches");

    writeJson(path.join(root, "tmp", "stale-delta-review.json"), {
      ...missingDeltasReviewReport,
      expectedItemCount: Math.max(0, missingDeltasReviewReport.expectedItemCount - 1),
    });
    const staleDeltaReviewHandoffResult = runScript(root, "create-i18n-handoff.mjs", [
      "--tasks", "tmp/tasks/manifest.json",
      "--delta-review", "tmp/stale-delta-review.json",
      "--json",
    ]);
    const staleDeltaReviewHandoff = JSON.parse(staleDeltaReviewHandoffResult.stdout);
    assert(staleDeltaReviewHandoff.reviewItems.some((item) => item.includes("Translation delta review report is stale")), "handoff should report stale delta review task counts");
    assert(staleDeltaReviewHandoff.nextActions.some((item) => item.action.includes("Rerun translation delta review")), "handoff should recommend rerunning stale delta review reports");
    const staleDeltaReviewMarkdown = runScript(root, "create-i18n-handoff.mjs", [
      "--tasks", "tmp/tasks/manifest.json",
      "--delta-review", "tmp/stale-delta-review.json",
    ]).stdout;
    assert(staleDeltaReviewMarkdown.includes("Task mismatch:"), "handoff markdown should show task/review expected-item mismatch");

    const translationReadyHandoffResult = runScript(root, "create-i18n-handoff.mjs", [
      "--tasks", "tmp/tasks/manifest.json",
      "--delta-review", "tmp/missing-deltas-review.json",
      "--json",
    ]);
    const translationReadyHandoff = JSON.parse(translationReadyHandoffResult.stdout);
    assert(translationReadyHandoff.blockers.some((item) => item.includes("Translation delta review failed")), "handoff should block on missing translation deltas when locale readiness is not blocked");
    assert(translationReadyHandoff.nextActions.some((item) => item.action.includes("Create translation delta JSON")), "handoff should recommend translation deltas after locale readiness blockers are absent");

    console.log(JSON.stringify({
      ok: true,
      fixture: keep ? root : null,
      checks: [
        "discover-project-i18n locale file discovery",
        "verify-locale-export failure",
        "create-translation-tasks instructions",
        "English locale casing guidance in translation tasks",
        "review-translation-deltas quality gate",
        "create-translation-review-tasks output",
        "English locale casing guidance in translation review tasks",
        "apply-translation-deltas contract validation",
        "audit-changed-locale-keys focused post-merge audit",
        "audit-i18n-contract blockers",
        "summarize-i18n-audit grouping",
        "create-audit-fix-tasks output",
        "find-hardcoded-cjk candidates",
        "create-hardcoded-cjk-fix-tasks output",
        "length-risk short enum calibration",
        "changed-key audit handoff summary",
        "create-i18n-handoff blockers",
      ],
    }, null, 2));
  } finally {
    if (!keep) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
}

main();
