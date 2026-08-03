#!/usr/bin/env node

/*
 * Purpose:
 * Turn translation delta review output into focused subjective review tasks.
 *
 * review-translation-deltas.mjs handles deterministic gates such as missing
 * keys, ICU/rich-tag contract mismatches, copied defaults, unexpected CJK, and
 * static UI-fit length warnings. This script creates the next layer: small
 * task files for a human or agent to review naturalness, terminology, and
 * UI-fit risks with source context. It does not decide whether a translation
 * is correct, does not run Browser Use, and does not edit locale files.
 */

import fs from "node:fs";
import path from "node:path";
import {
  estimateDisplayWidth,
  formatList,
  parseCliArgs,
  relativePath,
  resolveFromCwd,
  splitCsv,
  writeJsonFile,
} from "./lib/i18n-audit.mjs";

const SEVERITY_ORDER = { error: 0, high: 1, medium: 2, low: 3 };
const ENGLISH_CASING_GUIDANCE = [
  "- For English target locales, verify casing by UI role and surrounding product convention: Sentence case for sentences, descriptions, validation messages, placeholders, tooltips, empty states, table-cell copy, and most inline UI copy; Title Case for page/modal/section/card/tab titles when the surrounding UI uses title style; preserve proper casing for product names, feature names, brand terms, people, places, countries, nationalities, languages, weekdays, months, organizations, acronyms/initialisms, and the pronoun I; avoid all-caps except for established acronyms, OK, product-defined labels, official all-caps proper names, or explicit design-system conventions.",
];

/** Checks whether a locale identifier represents English. */
function isEnglishLocale(locale) {
  return /^en(?:[-_]|$)/i.test(String(locale ?? ""));
}

/** Prints command-line usage information. */
function printHelp() {
  console.log(`Usage:
  node skills/use-react-intl-universal/scripts/create-translation-review-tasks.mjs --review tmp/i18n-delta-review.json --tasks tmp/i18n-translation-tasks/manifest.json --deltas tmp/i18n-translation-results --output tmp/i18n-translation-review-tasks

Options:
  --review PATH             Required. JSON report from review-translation-deltas.mjs --json.
  --tasks PATH              Required. Translation task JSON file, manifest, or task output directory.
  --deltas PATH             Required. Directory containing returned translation delta JSON files.
  --output PATH             Optional. Output directory. Default: tmp/i18n-translation-review-tasks
  --include-all             Optional. Create review items for every returned translation, not only risky items.
  --include-ui-risk LIST    Optional. Comma-separated uiRisk values to force into review, for example high,medium.
  --max-items-per-task N    Optional. Split review work with at most N items per task. Default: 40.
  --json                    Print machine-readable manifest JSON.
  --help                    Show this help.
`);
}

/** Reads and parses a JSON file. */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** Checks whether an object owns the requested property. */
function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/** Normalizes supported translation-delta shapes into a key/value map. */
function normalizeTranslations(delta) {
  if (delta.translations && typeof delta.translations === "object" && !Array.isArray(delta.translations)) {
    return delta.translations;
  }

  if (Array.isArray(delta.items)) {
    const translations = {};
    for (const item of delta.items) {
      if (item && typeof item.key === "string" && hasOwn(item, "translation")) {
        translations[item.key] = item.translation;
      }
    }
    return translations;
  }

  return null;
}

/** Infers a locale identifier from a delta file's relative path. */
function inferLocaleFromDeltaPath(deltaPath, deltasPath) {
  return path.basename(deltaPath, ".json").replace(/\.part-\d+$/i, "");
}

/** Returns sorted translation delta files from the configured directory. */
function readDeltaFiles(deltasPath) {
  if (!fs.existsSync(deltasPath)) {
    return [];
  }

  return fs.readdirSync(deltasPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "manifest.json")
    .map((entry) => path.join(deltasPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

/** Loads and merges translated values from all delta files by locale. */
function loadDeltaTranslations(deltasPath) {
  const translationsByLocale = new Map();

  for (const deltaPath of readDeltaFiles(deltasPath)) {
    const delta = readJson(deltaPath);
    const locale = delta.locale || inferLocaleFromDeltaPath(deltaPath, deltasPath);
    const translations = normalizeTranslations(delta);
    if (!translations) {
      continue;
    }

    const localeTranslations = translationsByLocale.get(locale) ?? new Map();
    for (const [key, value] of Object.entries(translations)) {
      localeTranslations.set(key, {
        value,
        deltaPath: relativePath(deltaPath),
      });
    }
    translationsByLocale.set(locale, localeTranslations);
  }

  return translationsByLocale;
}

/** Finds generated translation task JSON files below a task directory. */
function findTaskJsonPaths(inputPath) {
  const resolved = resolveFromCwd(String(inputPath));
  const stat = fs.existsSync(resolved) ? fs.statSync(resolved) : null;
  const filePath = stat?.isDirectory() ? path.join(resolved, "manifest.json") : resolved;
  const data = readJson(filePath);

  if (Array.isArray(data.taskFiles)) {
    return data.taskFiles
      .map((task) => task.jsonPath)
      .filter(Boolean)
      .map((jsonPath) => {
        const fromCwd = resolveFromCwd(jsonPath);
        return fs.existsSync(fromCwd) ? fromCwd : path.resolve(path.dirname(filePath), jsonPath);
      });
  }

  if (Array.isArray(data.items) && data.locale) {
    return [filePath];
  }

  throw new Error("--tasks must point to a task JSON file, manifest.json, or task output directory");
}

/** Loads translation task items and their source context. */
function loadTaskItems(tasksPath) {
  const byLocale = new Map();
  const taskJsonPaths = findTaskJsonPaths(tasksPath);
  const taskFiles = [];

  for (const taskPath of taskJsonPaths) {
    const task = readJson(taskPath);
    taskFiles.push(relativePath(taskPath));
    const locale = task.locale;
    if (!locale || !Array.isArray(task.items)) {
      continue;
    }

    const items = byLocale.get(locale) ?? new Map();
    for (const item of task.items) {
      if (item && typeof item.key === "string") {
        items.set(item.key, item);
      }
    }
    byLocale.set(locale, items);
  }

  return { byLocale, taskFiles };
}

/** Adds a normalized issue or warning to a review signal bucket. */
function addIssueOrWarning(index, item) {
  if (!item || !item.locale || !item.key) {
    return;
  }

  const id = `${item.locale}\u0000${item.key}`;
  const list = index.get(id) ?? [];
  list.push(item);
  index.set(id, list);
}

/** Indexes audit issues and warnings by locale and translation key. */
function buildReviewSignalIndex(report) {
  const index = new Map();

  for (const issue of report.issues ?? []) {
    addIssueOrWarning(index, issue);
  }

  for (const warning of report.warnings ?? []) {
    addIssueOrWarning(index, warning);
  }

  return index;
}

/** Builds a stable sort key from a source reference. */
function sourceSortKey(item) {
  return `${item.source?.filePath ?? "\uffff"}:${String(item.source?.line ?? Number.MAX_SAFE_INTEGER).padStart(8, "0")}:${item.key}`;
}

/** Returns the numeric sorting rank for a severity. */
function severityRank(signals) {
  return Math.min(...signals.map((signal) => SEVERITY_ORDER[signal.severity] ?? 99), 99);
}

/** Compares estimated display widths of a translation and its source message. */
function getTranslationWidthRatio(defaultMessage, translation) {
  if (typeof defaultMessage !== "string" || typeof translation !== "string" || defaultMessage.length === 0) {
    return null;
  }

  const defaultWidth = estimateDisplayWidth(defaultMessage);
  const translatedWidth = estimateDisplayWidth(translation);
  if (defaultWidth === 0) {
    return null;
  }

  return {
    defaultWidth,
    translatedWidth,
    ratio: Number((translatedWidth / defaultWidth).toFixed(2)),
  };
}

/** Builds the review reasons for one translated message from deterministic signals. */
function createReasonList({ signals, taskItem, includeAll, includeUiRisks, translation }) {
  const reasons = [];

  for (const signal of signals) {
    reasons.push(`${signal.severity === "error" ? "issue" : "warning"}:${signal.type}`);
  }

  if (taskItem?.uiRisk && includeUiRisks.has(taskItem.uiRisk)) {
    reasons.push(`ui-risk:${taskItem.uiRisk}`);
  }

  const width = getTranslationWidthRatio(taskItem?.defaultMessage, translation);
  if (width && taskItem?.uiRisk && includeUiRisks.has(taskItem.uiRisk) && width.ratio >= 1.2) {
    reasons.push(`wide-${taskItem.uiRisk}-ui:${width.ratio}x`);
  }

  if (includeAll && reasons.length === 0) {
    reasons.push("sample:all-returned-translations");
  }

  return { reasons, width };
}

/** Joins translations, source task context, and review signals into review items. */
function createReviewItems({ translationsByLocale, taskItemsByLocale, signalIndex, includeAll, includeUiRisks }) {
  const items = [];

  for (const [locale, translations] of translationsByLocale) {
    const taskItems = taskItemsByLocale.get(locale) ?? new Map();

    for (const [key, translated] of translations) {
      const taskItem = taskItems.get(key) ?? null;
      const signals = signalIndex.get(`${locale}\u0000${key}`) ?? [];
      const { reasons, width } = createReasonList({
        signals,
        taskItem,
        includeAll,
        includeUiRisks,
        translation: translated.value,
      });

      if (reasons.length === 0) {
        continue;
      }

      items.push({
        locale,
        key,
        reasons,
        severityRank: severityRank(signals),
        deltaPath: translated.deltaPath,
        defaultMessage: taskItem?.defaultMessage ?? null,
        previousDefaultMessage: taskItem?.previousDefaultMessage ?? null,
        translation: translated.value,
        referenceTranslations: taskItem?.referenceTranslations ?? [],
        source: taskItem?.source ?? null,
        uiRisk: taskItem?.uiRisk ?? "unknown",
        variables: taskItem?.variables ?? [],
        tags: taskItem?.tags ?? [],
        displayWidth: width,
        signals: signals.map((signal) => ({
          type: signal.type,
          severity: signal.severity,
          message: signal.message,
          lengthRisk: signal.lengthRisk ?? null,
        })),
      });
    }
  }

  return items.sort((a, b) => (
    a.severityRank - b.severityRank
    || a.locale.localeCompare(b.locale)
    || sourceSortKey(a).localeCompare(sourceSortKey(b))
  ));
}

/** Splits items into fixed-size batches. */
function chunkItems(items, maxItemsPerTask) {
  if (!Number.isFinite(maxItemsPerTask) || maxItemsPerTask <= 0 || items.length <= maxItemsPerTask) {
    return [items];
  }

  const chunks = [];
  for (let index = 0; index < items.length; index += maxItemsPerTask) {
    chunks.push(items.slice(index, index + maxItemsPerTask));
  }
  return chunks;
}

/** Returns the file-name suffix for a task batch. */
function getBatchSuffix(batchIndex, batchCount) {
  if (batchCount <= 1) {
    return "";
  }

  return `.part-${String(batchIndex + 1).padStart(3, "0")}`;
}

/** Groups review items by locale for task generation. */
function groupItems(items) {
  const groups = new Map();
  for (const item of items) {
    const groupKey = item.locale;
    const group = groups.get(groupKey) ?? [];
    group.push(item);
    groups.set(groupKey, group);
  }

  return [...groups.entries()]
    .map(([locale, groupItemsForLocale]) => ({ locale, items: groupItemsForLocale }))
    .sort((a, b) => a.locale.localeCompare(b.locale));
}

/** Counts review reasons by type across generated task items. */
function countReasons(items) {
  const counts = {};
  for (const item of items) {
    for (const reason of item.reasons) {
      counts[reason] = (counts[reason] ?? 0) + 1;
    }
  }
  return counts;
}

/** Renders one locale review batch as an actionable Markdown task. */
function createTaskMarkdown(task) {
  const lines = [
    `# Translation quality review: ${task.locale}${task.batchCount > 1 ? ` (${task.batchIndex + 1}/${task.batchCount})` : ""}`,
    "",
    "This is a review task, not an automatic rewrite task.",
    "",
    "Review goals:",
    "- Verify the translation expresses the intended business meaning, not a word-by-word rendering.",
    "- Check that the wording fits the actual product flow in this codebase, using source context rather than the source words alone.",
    "- Treat the default message as the source of product intent, not as a sentence template the target locale must preserve.",
    "- Confirm the target copy says what the user should understand in the actual feature, not dictionary equivalents of the source words.",
    "- Prefer sense-for-sense localization; the target copy may use a different sentence shape when that is more natural for this product context.",
    "- Read the source context when the key, default message, or warning is ambiguous.",
    "- Keep every ICU variable and rich tag exactly equivalent.",
    "- Preserve product and domain terminology used by this project.",
    "- For compact UI, inspect source usage and prefer concise natural wording only when meaning is preserved; if accurate wording cannot be shortened, keep it and consider general layout/CSS instead. For grouped controls such as tabs, segmented controls, button groups, chip groups, pagination, or table actions, absence of overflow is not enough: check or flag component visual integrity.",
  ];

  if (isEnglishLocale(task.locale)) {
    lines.push(...ENGLISH_CASING_GUIDANCE);
  }

  lines.push(
    "",
    `Items in this batch: ${task.itemCount}`,
    `Total items for locale: ${task.totalLocaleItemCount}`,
    "",
    "Items:",
  );

  for (const item of task.items) {
    lines.push("");
    lines.push(`## ${item.key}`);
    lines.push(`Reasons: ${item.reasons.join(", ")}`);
    lines.push(`Delta: ${item.deltaPath}`);
    lines.push(`Default: ${JSON.stringify(item.defaultMessage)}`);
    lines.push(`Translation: ${JSON.stringify(item.translation)}`);
    if (item.previousDefaultMessage != null) {
      lines.push(`Previous default: ${JSON.stringify(item.previousDefaultMessage)}`);
    }
    if (item.referenceTranslations.length > 0) {
      lines.push("Reference translations:");
      for (const reference of item.referenceTranslations) {
        lines.push(`- ${reference.locale}: ${JSON.stringify(reference.value)}`);
      }
    }
    if (item.signals.length > 0) {
      lines.push("Review signals:");
      for (const signal of item.signals) {
        lines.push(`- ${signal.severity ?? "warning"} ${signal.type}: ${signal.message}`);
      }
    }
    lines.push(`Variables: ${formatList(item.variables)}`);
    lines.push(`Rich tags: ${formatList(item.tags)}`);
    lines.push(`UI risk: ${item.uiRisk}`);
    if (item.displayWidth) {
      lines.push(`Display width: default=${item.displayWidth.defaultWidth}, translation=${item.displayWidth.translatedWidth}, ratio=${item.displayWidth.ratio}`);
    }
    if (item.source) {
      lines.push(`Source: ${item.source.filePath}:${item.source.line}`);
      lines.push(`Source line: ${JSON.stringify(item.source.lineText)}`);
      if (item.source.callText && item.source.callText !== item.source.lineText) {
        lines.push(`Source call: ${JSON.stringify(item.source.callText)}`);
      }
      if (item.source.contextSnippet) {
        lines.push(`Source context: ${JSON.stringify(item.source.contextSnippet)}`);
      }
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

/** Runs this script's command-line workflow. */
function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.review || !args.tasks || !args.deltas) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const reviewPath = resolveFromCwd(String(args.review));
  const outputPath = resolveFromCwd(String(args.output ?? "tmp/i18n-translation-review-tasks"));
  const deltasPath = resolveFromCwd(String(args.deltas));
  const maxItemsPerTask = args["max-items-per-task"] ? Number(args["max-items-per-task"]) : 40;
  const includeAll = Boolean(args["include-all"]);
  const includeUiRisks = new Set(splitCsv(args["include-ui-risk"], []));
  let report;
  let taskData;

  try {
    report = readJson(reviewPath);
    taskData = loadTaskItems(args.tasks);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }

  const translationsByLocale = loadDeltaTranslations(deltasPath);
  const signalIndex = buildReviewSignalIndex(report);
  const reviewItems = createReviewItems({
    translationsByLocale,
    taskItemsByLocale: taskData.byLocale,
    signalIndex,
    includeAll,
    includeUiRisks,
  });
  const groups = groupItems(reviewItems);
  const taskFiles = [];

  fs.mkdirSync(outputPath, { recursive: true });

  for (const group of groups) {
    const batches = chunkItems(group.items, maxItemsPerTask);
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batchItems = batches[batchIndex];
      const batchCount = batches.length;
      const suffix = getBatchSuffix(batchIndex, batchCount);
      const task = {
        locale: group.locale,
        reviewPath: relativePath(reviewPath),
        deltasPath: relativePath(deltasPath),
        sourceTaskFiles: taskData.taskFiles,
        includeAll,
        includeUiRisks: [...includeUiRisks],
        batchIndex,
        batchCount,
        itemCount: batchItems.length,
        totalLocaleItemCount: group.items.length,
        instructions: [
          "Review meaning, terminology, naturalness, and static UI fit; do not mechanically rewrite every item.",
          "Check whether the translation fits the actual product flow in this codebase instead of preserving source words literally.",
          "Treat the default message as the source of product intent, not as a sentence template the target locale must preserve.",
          "Confirm the target copy says what the user should understand in the actual feature, not dictionary equivalents of the source words.",
          "Use source context and reference translations to understand business intent.",
          "Preserve every ICU variable and rich tag exactly.",
          "For compact UI, inspect source usage and prefer concise natural target-language wording only when meaning is preserved; if shortening harms meaning, keep accuracy and consider general layout/CSS. For grouped controls, check or flag component visual integrity rather than relying only on no-overflow metrics.",
          ...(isEnglishLocale(group.locale) ? ENGLISH_CASING_GUIDANCE : []),
          "Return either an approved note or a delta JSON patch for the keys that need translation changes.",
        ],
        items: batchItems,
      };
      const jsonPath = path.join(outputPath, `${group.locale}${suffix}.json`);
      const mdPath = path.join(outputPath, `${group.locale}${suffix}.md`);
      writeJsonFile(jsonPath, task);
      fs.writeFileSync(mdPath, createTaskMarkdown(task));
      taskFiles.push({
        locale: group.locale,
        batchIndex,
        batchCount,
        itemCount: batchItems.length,
        jsonPath: relativePath(jsonPath),
        markdownPath: relativePath(mdPath),
      });
    }
  }

  const manifest = {
    reviewPath: relativePath(reviewPath),
    deltasPath: relativePath(deltasPath),
    tasksPath: relativePath(resolveFromCwd(String(args.tasks))),
    outputPath: relativePath(outputPath),
    includeAll,
    includeUiRisks: [...includeUiRisks],
    maxItemsPerTask: Number.isFinite(maxItemsPerTask) ? maxItemsPerTask : 40,
    reviewStatus: report.status ?? "unknown",
    sourceIssueCount: report.issueCount ?? report.issues?.length ?? 0,
    sourceWarningCount: report.warningCount ?? report.warnings?.length ?? 0,
    reviewedDeltaEntryCount: report.reviewedEntryCount ?? 0,
    taskItemCount: reviewItems.length,
    reasonCounts: countReasons(reviewItems),
    taskFileCount: taskFiles.length,
    taskFiles,
  };

  writeJsonFile(path.join(outputPath, "manifest.json"), manifest);

  if (args.json) {
    console.log(JSON.stringify(manifest, null, 2));
  } else {
    console.log(`Review report: ${relativePath(reviewPath)}`);
    console.log(`Review task items: ${manifest.taskItemCount}`);
    console.log(`Task files: ${manifest.taskFileCount}`);
    console.log(`Output: ${relativePath(outputPath)}`);
  }
}

main();
