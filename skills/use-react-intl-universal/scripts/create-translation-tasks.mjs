#!/usr/bin/env node

/*
 * Purpose:
 * Create per-locale translation task files from the default-locale JSON diff.
 *
 * The intended workflow is:
 * 1. Developers update intl.get(...).d(...).
 * 2. react-intl-universal-extract regenerates the default locale.
 * 3. This script compares the current default locale with --base-ref.
 * 4. It writes one JSON/Markdown task per non-default locale.
 *    Large tasks can be split into batch files with --max-items-per-task.
 *
 * The script does not translate text and does not edit locale files. Subagents
 * or humans should return delta JSON, and the main agent should merge those
 * deltas with apply-translation-deltas.mjs.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  classifyUiCopyRisk,
  compareMessageContracts,
  estimateDisplayWidth,
  flattenStringMessages,
  formatList,
  getLengthRiskWarning,
  getMessageContract,
  getMessageValue,
  hasContractDiff,
  loadLocaleData,
  loadSourceMessages,
  parseCliArgs,
  relativePath,
  resolveFromCwd,
  splitCsv,
  writeJsonFile,
  inferDefaultLocale,
  DEFAULT_SOURCE_EXTENSIONS,
} from "./lib/i18n-audit.mjs";

const DEFAULT_TASK_SIZE_WARNING_BYTES = 300_000;
const DEFAULT_TASK_SIZE_TARGET_BYTES = 200_000;
const MAX_CONTEXT_ASSET_CHARS = 20_000;
const ENGLISH_CASING_GUIDANCE = [
  "For English target locales, follow professional casing rules:",
  "- Use Sentence case for sentences, descriptions, validation messages, placeholders, tooltips, empty states, and most inline UI copy.",
  "- Use Title Case for page titles, modal titles, section/card titles, and other title-like UI when the surrounding product UI uses title style. Capitalize major words; keep a/an/the, coordinating conjunctions, and prepositions of four letters or fewer lowercase unless they are the first or last word.",
  "- Preserve product names, feature names, brand terms, acronyms, countries, languages, weekdays, months, and the pronoun I in their proper casing.",
  "- Avoid all-caps except for established acronyms such as API, SQL, product-defined labels, OK, or an explicit design-system convention.",
];

function isEnglishLocale(locale) {
  return /^en(?:[-_]|$)/i.test(String(locale ?? ""));
}

function printHelp() {
  console.log(`Usage:
  node skills/use-react-intl-universal/scripts/create-translation-tasks.mjs --locales src/locales --default-locale en-US --base-ref origin/master --output tmp/i18n-translation-tasks

Options:
  --locales PATH             Required. Directory containing locale JSON files.
  --default-locale LOCALE    Default/source locale. Required unless --infer-default-locale is used with --source.
  --source PATH              Optional. Source path used for default-locale inference and source metadata.
  --infer-default-locale     Infer default locale from source .d() messages.
  --base-ref REF             Optional. Git ref used to read previous locale JSON files. If omitted, all current default keys are treated as new.
  --output PATH              Optional. Output directory. Default: tmp/i18n-translation-tasks
  --target-locales LIST      Optional. Comma-separated target locale names.
  --max-items-per-task N     Optional. Split each locale into batch files with at most N items.
  --sort key|source          Optional. Task item order. Default: key.
  --extensions LIST          Optional. Comma-separated source extensions. Default: .js,.jsx,.ts,.tsx
  --ignore LIST              Optional. Comma-separated path substrings to skip.
  --context-file PATH        Optional. User-provided glossary, style guide, product note, screenshot note, or page-context file to include in Markdown tasks. Repeatable.
  --task-size-warning-bytes N Optional. Warn when a Markdown task file is larger than N bytes. Default: ${DEFAULT_TASK_SIZE_WARNING_BYTES}.
  --task-size-target-bytes N Optional. Target Markdown task size used for recommended max-items-per-task. Default: ${DEFAULT_TASK_SIZE_TARGET_BYTES}.
  --json                     Print machine-readable manifest JSON.
  --help                     Show this help.
`);
}

function readJsonFromGit(ref, filePath) {
  if (!ref) {
    return null;
  }

  try {
    const gitPath = relativePath(filePath).split(path.sep).join("/");
    const text = execFileSync("git", ["show", `${ref}:${gitPath}`], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// User-provided context assets are optional but useful for terminology and
// product-writing decisions. Keep each file bounded so generated task files
// remain small enough for agent handoff.
function loadContextAssets(rawValue) {
  if (!rawValue) {
    return [];
  }

  const values = Array.isArray(rawValue) ? rawValue : [rawValue];

  return values.map((value) => {
    const filePath = resolveFromCwd(String(value));
    const text = fs.readFileSync(filePath, "utf8");
    const truncated = text.length > MAX_CONTEXT_ASSET_CHARS;

    return {
      path: relativePath(filePath),
      byteLength: Buffer.byteLength(text, "utf8"),
      truncated,
      maxChars: MAX_CONTEXT_ASSET_CHARS,
      content: truncated ? text.slice(0, MAX_CONTEXT_ASSET_CHARS) : text,
    };
  });
}

// Build the minimum work set. Only keys whose default-locale message is new,
// changed, or deleted become translation tasks. Without --base-ref this becomes
// a full initialization task where every current default key is treated as new.
function getChangedDefaultItems(currentDefaultJson, previousDefaultJson) {
  const current = flattenStringMessages(currentDefaultJson);
  const previous = flattenStringMessages(previousDefaultJson ?? {});
  const keys = [...new Set([...Object.keys(current), ...Object.keys(previous)])].sort((a, b) => a.localeCompare(b));
  const items = [];

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(current, key)) {
      items.push({
        key,
        type: "deleted",
        defaultMessage: null,
        previousDefaultMessage: previous[key],
      });
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(previous, key)) {
      items.push({
        key,
        type: "new",
        defaultMessage: current[key],
        previousDefaultMessage: null,
      });
      continue;
    }

    if (current[key] !== previous[key]) {
      items.push({
        key,
        type: "changed",
        defaultMessage: current[key],
        previousDefaultMessage: previous[key],
      });
    }
  }

  return items;
}

function findLocale(localeData, localeName) {
  return localeData.find((item) => item.locale === localeName);
}

function createEmptyLocaleTarget(localesPath, locale) {
  return {
    locale,
    filePath: path.join(localesPath, `${locale}.json`),
    missingFile: true,
    localeFile: {
      filePath: path.join(localesPath, `${locale}.json`),
      text: "{}",
      json: {},
      parseError: null,
      propertyLocations: [],
      duplicateProperties: [],
    },
  };
}

// Source metadata is optional. When available, it lets task files include UI
// context and length-risk hints for better translation decisions.
function getSourceMessageByKey(sourceMessages) {
  const map = new Map();

  for (const message of sourceMessages) {
    const existing = map.get(message.key);
    if (!existing || (existing.isLikelyCommented && !message.isLikelyCommented)) {
      map.set(message.key, message);
    }
  }

  return map;
}

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

function getBatchSuffix(batchIndex, batchCount) {
  if (batchCount <= 1) {
    return "";
  }

  return `.part-${String(batchIndex + 1).padStart(3, "0")}`;
}

function summarizeContextSnippet(snippet) {
  if (typeof snippet !== "string") {
    return null;
  }

  const normalized = snippet.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > 360 ? `${normalized.slice(0, 357)}...` : normalized;
}

function getPositiveNumber(value, fallback) {
  if (value == null) {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function createTaskSizeSummary(taskFiles, warningBytes, targetBytes) {
  const markdownFiles = taskFiles.filter((task) => Number.isFinite(task.markdownBytes));
  const totalMarkdownBytes = markdownFiles.reduce((total, task) => total + task.markdownBytes, 0);
  const totalItems = markdownFiles.reduce((total, task) => total + (task.itemCount ?? 0), 0);
  const maxMarkdownBytes = Math.max(0, ...markdownFiles.map((task) => task.markdownBytes));
  const maxJsonBytes = Math.max(0, ...taskFiles.map((task) => task.jsonBytes ?? 0));
  const maxItemCount = Math.max(0, ...taskFiles.map((task) => task.itemCount ?? 0));
  const averageMarkdownBytesPerItem = totalItems > 0
    ? Number((totalMarkdownBytes / totalItems).toFixed(1))
    : 0;
  const largeMarkdownTaskCount = markdownFiles.filter((task) => task.markdownBytes > warningBytes).length;
  const recommendedMaxItemsPerTask = averageMarkdownBytesPerItem > 0
    ? Math.max(1, Math.floor(targetBytes / averageMarkdownBytesPerItem))
    : null;
  const warnings = [];

  if (largeMarkdownTaskCount > 0) {
    warnings.push({
      type: "large-translation-task",
      severity: "medium",
      message: "Some translation task Markdown files are large for agent handoff. Split into smaller batches before assigning to subagents.",
      largeMarkdownTaskCount,
      maxMarkdownBytes,
      warningBytes,
      targetBytes,
      recommendedMaxItemsPerTask,
    });
  }

  return {
    warningBytes,
    targetBytes,
    totalMarkdownBytes,
    maxMarkdownBytes,
    maxJsonBytes,
    maxItemCount,
    averageMarkdownBytesPerItem,
    largeMarkdownTaskCount,
    recommendedMaxItemsPerTask,
    warnings,
  };
}

function sortTaskItems(items, sortMode) {
  if (sortMode === "key") {
    return [...items].sort((a, b) => a.key.localeCompare(b.key));
  }

  if (sortMode === "source") {
    return [...items].sort((a, b) => {
      const sourceA = a.source?.filePath ?? "\uffff";
      const sourceB = b.source?.filePath ?? "\uffff";
      return sourceA.localeCompare(sourceB)
        || (a.source?.line ?? Number.MAX_SAFE_INTEGER) - (b.source?.line ?? Number.MAX_SAFE_INTEGER)
        || a.key.localeCompare(b.key);
    });
  }

  return items;
}

// Existing non-target translations are useful translation memory. They can
// reveal product terminology and tone, but the default message contract remains
// authoritative for variables and rich tags.
function getReferenceTranslations(localeData, defaultLocale, targetLocale, key) {
  return localeData
    .filter((item) => (
      item.locale !== defaultLocale
      && item.locale !== targetLocale
      && !item.localeFile.parseError
    ))
    .map((item) => {
      const valueInfo = getMessageValue(item.localeFile.json, key);
      return valueInfo.exists && typeof valueInfo.value === "string"
        ? { locale: item.locale, value: valueInfo.value }
        : null;
    })
    .filter(Boolean);
}

// Markdown task files are optimized for human/subagent reading. JSON task files
// are optimized for deterministic downstream processing.
function createTaskMarkdown(task) {
  const lines = [
    `# Translation task: ${task.locale}${task.batchCount > 1 ? ` (${task.batchIndex + 1}/${task.batchCount})` : ""}`,
    "",
    "Translate only the keys in this task. Translate the intended business meaning, not the source words one by one. Identify the user action, subject, object, status, and surrounding workflow before writing the target-language copy. Understand what the text means in this codebase's product flow, then localize that meaning naturally. Treat the default message as the source of product intent, not as a sentence template to preserve. Prefer sense-for-sense localization; the target copy does not need to mirror the source sentence structure when a native product writer would phrase the same business intent differently.",
    "",
    "Use the key, source location, component name, route/module name, adjacent labels, enum names, table columns, validation logic, and business domain to write natural product copy for this locale. Translate what the user should understand in the actual feature, not dictionary equivalents of the source words. If the task context is not enough, inspect the source file around the reported line before translating; do not rely on locale JSON keys alone.",
    "",
    "When translating between any source and target locale, do not translate word by word. Use nearby code and UI context to express the same product intent naturally in the target language, even when the target wording needs different word order, phrasing, or sentence structure. Keep every ICU variable and rich tag exactly equivalent to the default message. Prefer concise wording for UI labels, placeholders, buttons, tabs, menus, badges, and table headers when meaning and naturalness are preserved. For tabs, segmented controls, button groups, chip groups, pagination, and table action groups, also consider component visual integrity: a wrapped grouped control can be broken even when text does not overflow.",
    "",
    "Use reference translations only as terminology and tone hints. The default message is still the source of truth for ICU variables, rich tags, and current product meaning.",
  ];

  if (task.contextAssets.length > 0) {
    lines.push(
      "",
      "Additional user-provided context assets:",
      "",
      "Use these assets as glossary, style-guide, product-documentation, screenshot, or page-context evidence when they are relevant to a key. They help terminology and wording decisions, but they do not override the default message contract for ICU variables and rich tags.",
    );
    for (const asset of task.contextAssets) {
      lines.push(
        "",
        `### ${asset.path}${asset.truncated ? ` (truncated to ${asset.maxChars} characters)` : ""}`,
        "",
        "```text",
        asset.content,
        "```",
      );
    }
  }

  if (isEnglishLocale(task.locale)) {
    lines.push("", ...ENGLISH_CASING_GUIDANCE);
  }

  lines.push(
    "",
    "Return a delta JSON object in this shape:",
    "",
    "```json",
    JSON.stringify({
      locale: task.locale,
      translations: {
        EXAMPLE_KEY: "Translated message with {variable} and <tag>rich text</tag>",
      },
    }, null, 2),
    "```",
    "",
    `Task batch: ${task.batchIndex + 1}/${task.batchCount}`,
    `Sort: ${task.sortMode}`,
    `Items in this batch: ${task.itemCount}`,
    "",
    "Items:",
  );

  for (const item of task.items) {
    lines.push("");
    lines.push(`## ${item.key} (${item.type})`);
    lines.push(`Default: ${JSON.stringify(item.defaultMessage)}`);
    if (item.previousDefaultMessage != null) {
      lines.push(`Previous default: ${JSON.stringify(item.previousDefaultMessage)}`);
    }
    if (item.previousTranslation != null) {
      lines.push(`Previous translation: ${JSON.stringify(item.previousTranslation)}`);
    }
    if (item.referenceTranslations.length > 0) {
      lines.push("Reference translations:");
      for (const reference of item.referenceTranslations) {
        lines.push(`- ${reference.locale}: ${JSON.stringify(reference.value)}`);
      }
    }
    lines.push(`Variables: ${formatList(item.variables)}`);
    lines.push(`Rich tags: ${formatList(item.tags)}`);
    lines.push(`Default display width: ${item.defaultDisplayWidth}`);
    lines.push(`UI risk: ${item.uiRisk}`);
    if (item.source) {
      lines.push(`Source: ${item.source.filePath}:${item.source.line}`);
      if (item.source.isLikelyCommented) {
        lines.push("Source note: this intl call appears to be inside a comment. Verify the key is still used before translating.");
      }
      lines.push(`Source line: ${JSON.stringify(item.source.lineText)}`);
      if (item.source.callText && item.source.callText !== item.source.lineText) {
        lines.push(`Source call: ${JSON.stringify(item.source.callText)}`);
      }
      if (item.source.contextSnippet) {
        lines.push(`Source context: ${JSON.stringify(item.source.contextSnippet)}`);
      }
    }
    if (item.lengthRisk) {
      lines.push(`Static UI-fit note: ${item.lengthRisk.severity} length warning, current translation display-width ratio ${item.lengthRisk.ratio}. Inspect source usage before shortening text; no-overflow metrics alone do not prove component visual integrity.`);
      if (item.lengthRisk.visualIntegrityRisk) {
        lines.push(`Component visual-integrity note: ${item.lengthRisk.visualIntegrityRisk.message}`);
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

  if (!args.locales) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const localesPath = resolveFromCwd(String(args.locales));
  const outputPath = resolveFromCwd(String(args.output ?? "tmp/i18n-translation-tasks"));
  const ignorePatterns = splitCsv(args.ignore, []);
  const extensions = splitCsv(args.extensions, DEFAULT_SOURCE_EXTENSIONS);
  const maxItemsPerTask = args["max-items-per-task"] ? Number(args["max-items-per-task"]) : 0;
  const taskSizeWarningBytes = getPositiveNumber(args["task-size-warning-bytes"], DEFAULT_TASK_SIZE_WARNING_BYTES);
  const taskSizeTargetBytes = getPositiveNumber(args["task-size-target-bytes"], DEFAULT_TASK_SIZE_TARGET_BYTES);
  const sortMode = String(args.sort ?? "key");
  if (!["key", "source"].includes(sortMode)) {
    console.error("--sort must be \"key\" or \"source\".");
    process.exitCode = 2;
    return;
  }
  let contextAssets = [];
  try {
    contextAssets = loadContextAssets(args["context-file"]);
  } catch (error) {
    console.error(`Failed to read --context-file: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  const localeData = loadLocaleData(localesPath, ignorePatterns);
  let sourceMessages = [];

  // Source scanning is optional because task generation can operate purely from
  // default locale JSON. When source is available, it improves context and
  // enables default-locale inference.
  if (args.source) {
    sourceMessages = loadSourceMessages(resolveFromCwd(String(args.source)), extensions, ignorePatterns).sourceMessages;
  }

  let defaultLocale = args["default-locale"] ? String(args["default-locale"]) : null;
  let inference = null;
  if (!defaultLocale && args["infer-default-locale"]) {
    if (!args.source) {
      console.error("--source is required with --infer-default-locale");
      process.exitCode = 2;
      return;
    }
    inference = inferDefaultLocale(sourceMessages, localeData);
    defaultLocale = inference.defaultLocale;
  }

  if (!defaultLocale) {
    console.error("Default locale is required. Pass --default-locale or use --infer-default-locale with --source.");
    process.exitCode = 2;
    return;
  }

  const defaultLocaleData = findLocale(localeData, defaultLocale);
  if (!defaultLocaleData) {
    console.error(`Default locale file not found for "${defaultLocale}" in ${localesPath}`);
    process.exitCode = 2;
    return;
  }

  if (defaultLocaleData.localeFile.parseError) {
    console.error(`Default locale JSON is invalid: ${defaultLocaleData.localeFile.parseError.message}`);
    process.exitCode = 2;
    return;
  }

  const previousDefaultJson = readJsonFromGit(args["base-ref"] ? String(args["base-ref"]) : null, defaultLocaleData.filePath);
  const changedItems = getChangedDefaultItems(defaultLocaleData.localeFile.json, previousDefaultJson);
  const sourceMessageByKey = getSourceMessageByKey(sourceMessages);
  const targetLocales = new Set(splitCsv(args["target-locales"], []));
  const existingTargets = localeData.filter((item) => (
    item.locale !== defaultLocale
    && !item.localeFile.parseError
    && (targetLocales.size === 0 || targetLocales.has(item.locale))
  ));
  const existingTargetNames = new Set(existingTargets.map((item) => item.locale));
  const missingTargets = targetLocales.size === 0
    ? []
    : [...targetLocales]
      .filter((locale) => locale !== defaultLocale && !existingTargetNames.has(locale))
      // Missing target locale files are valid for new-language initialization.
      // The task still includes every changed/new default item, and
      // apply-translation-deltas.mjs can create the locale JSON later.
      .map((locale) => createEmptyLocaleTarget(localesPath, locale));
  const targets = [...existingTargets, ...missingTargets];

  fs.mkdirSync(outputPath, { recursive: true });
  const taskFiles = [];
  let referenceTranslationItemCount = 0;
  const referenceTranslationLocales = new Set();
  let commentedSourceItemCount = 0;

  // Create one isolated task per target locale. This shape is safe for parallel
  // subagents because they only produce delta files; the main agent does the
  // actual merge later to avoid concurrent writes to locale JSON files.
  for (const target of targets) {
    const previousTargetJson = readJsonFromGit(args["base-ref"] ? String(args["base-ref"]) : null, target.filePath);
    const items = changedItems.map((item) => {
      const currentTranslationInfo = getMessageValue(target.localeFile.json, item.key);
      const previousTranslationInfo = getMessageValue(previousTargetJson, item.key);
      const referenceTranslations = getReferenceTranslations(localeData, defaultLocale, target.locale, item.key);
      if (referenceTranslations.length > 0) {
        referenceTranslationItemCount += 1;
        for (const reference of referenceTranslations) {
          referenceTranslationLocales.add(reference.locale);
        }
      }
      const contract = getMessageContract(item.defaultMessage ?? item.previousDefaultMessage ?? "");
      const sourceMessage = sourceMessageByKey.get(item.key);
      const currentTranslation = currentTranslationInfo.exists ? currentTranslationInfo.value : null;
      const currentContract = getMessageContract(currentTranslation);
      const contractDiff = currentTranslationInfo.exists && currentContract.isString
        ? compareMessageContracts(contract, currentContract)
        : null;
      const source = sourceMessage
        ? {
          filePath: relativePath(sourceMessage.filePath),
          line: sourceMessage.line,
          lineText: sourceMessage.lineText,
          callText: sourceMessage.callText,
          contextSnippet: summarizeContextSnippet(sourceMessage.contextSnippet),
          isLikelyCommented: Boolean(sourceMessage.isLikelyCommented),
        }
        : null;
      if (source?.isLikelyCommented) {
        commentedSourceItemCount += 1;
      }
      const uiRisk = classifyUiCopyRisk(item.key, sourceMessage);

      return {
        ...item,
        defaultDisplayWidth: item.defaultMessage == null ? 0 : estimateDisplayWidth(item.defaultMessage),
        previousTranslation: previousTranslationInfo.exists ? previousTranslationInfo.value : null,
        currentTranslation,
        referenceTranslations,
        source,
        uiRisk,
        variables: contract.variables,
        tags: contract.tags,
        contractMismatch: contractDiff && hasContractDiff(contractDiff) ? contractDiff : null,
        // If an existing translation is much wider than the default message,
        // flag it in the task as a static UI-fit review prompt. This is still
        // advisory; accuracy wins when the text cannot be shortened safely.
        lengthRisk: item.defaultMessage != null && typeof currentTranslation === "string"
          ? getLengthRiskWarning({
            key: item.key,
            locale: target.locale,
            defaultMessage: item.defaultMessage,
            translatedMessage: currentTranslation,
            sourceMessage,
          })
          : null,
      };
    });

    const sortedItems = sortTaskItems(items, sortMode);
    const batches = chunkItems(sortedItems, maxItemsPerTask);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batchItems = batches[batchIndex];
      const batchCount = batches.length;
      const suffix = getBatchSuffix(batchIndex, batchCount);
      const task = {
        locale: target.locale,
        localeFile: relativePath(target.filePath),
        missingLocaleFile: Boolean(target.missingFile),
        defaultLocale,
        defaultLocaleFile: relativePath(defaultLocaleData.filePath),
        baseRef: args["base-ref"] ? String(args["base-ref"]) : null,
        batchIndex,
        batchCount,
        maxItemsPerTask: maxItemsPerTask > 0 ? maxItemsPerTask : null,
        sortMode,
        contextAssets,
        itemCount: batchItems.length,
        totalLocaleItemCount: sortedItems.length,
        instructions: [
          "Translate only non-default locale messages.",
          "Translate the intended business meaning, not the source words one by one; identify the user action, subject, object, status, and surrounding workflow before writing the target-language copy. Understand what the text means in this codebase's product flow, then prefer sense-for-sense localization over mirroring the source sentence structure.",
          "Treat the default message as the source of product intent, not as a sentence template to preserve.",
          "Use source file paths, component names, keys, route/module names, adjacent labels, enum names, table columns, validation logic, and business domain to choose natural wording for this locale.",
          "Translate what the user should understand in the actual feature, not dictionary equivalents of the source words.",
          "If the task item is ambiguous, inspect the source file around the reported line before translating; do not rely on locale JSON keys alone.",
          "When translating between any source and target locale, do not translate word by word. Use nearby code and UI context to express the same product intent naturally in the target language, even when the target wording needs different word order, phrasing, or sentence structure.",
          "Avoid stiff literal translations; do not force the source language's word order, sentence shape, or punctuation into the target language.",
          "The result should read like product copy written by a native speaker for the target locale.",
          "Use referenceTranslations as terminology and tone hints only; the default message remains the source of truth for ICU variables, rich tags, and current product meaning.",
          ...(contextAssets.length > 0 ? [
            "Use contextAssets as user-provided glossary, style-guide, product-documentation, screenshot, or page-context evidence when relevant to a key. Do not let those assets override ICU variables, rich tags, or the current default message meaning.",
          ] : []),
          ...(isEnglishLocale(target.locale) ? ENGLISH_CASING_GUIDANCE : []),
          "Preserve product names, technical terms, and domain terms when the target locale commonly uses them in English unless the project has a clear localized convention.",
          "Do not modify the default locale message for length reasons.",
          "Keep all ICU variables and rich tags exactly equivalent to the default message.",
          "Prefer concise wording for compact UI copy when meaning and naturalness are preserved; if accurate wording must be longer, keep accuracy and let the main agent consider a general layout adjustment. For grouped controls, preserve component visual integrity rather than relying only on absence of overflow.",
          "Return delta JSON only; do not edit locale files directly when working as a subagent.",
        ],
        items: batchItems,
      };

      const jsonPath = path.join(outputPath, `${target.locale}${suffix}.json`);
      const mdPath = path.join(outputPath, `${target.locale}${suffix}.md`);
      writeJsonFile(jsonPath, task);
      fs.writeFileSync(mdPath, createTaskMarkdown(task));
      const jsonBytes = fs.statSync(jsonPath).size;
      const markdownBytes = fs.statSync(mdPath).size;
      taskFiles.push({
        locale: target.locale,
        batchIndex,
        batchCount,
        jsonPath: relativePath(jsonPath),
        markdownPath: relativePath(mdPath),
        itemCount: batchItems.length,
        totalLocaleItemCount: items.length,
        jsonBytes,
        markdownBytes,
      });
    }
  }

  const taskSize = createTaskSizeSummary(taskFiles, taskSizeWarningBytes, taskSizeTargetBytes);
  const taskItemCount = taskFiles.reduce((total, task) => total + (task.itemCount ?? 0), 0);
  const manifest = {
    defaultLocale,
    defaultLocaleFile: relativePath(defaultLocaleData.filePath),
    baseRef: args["base-ref"] ? String(args["base-ref"]) : null,
    changedDefaultItemCount: changedItems.length,
    targetLocaleCount: targets.length,
    taskItemCount,
    outputPath: relativePath(outputPath),
    maxItemsPerTask: maxItemsPerTask > 0 ? maxItemsPerTask : null,
    sortMode,
    inference,
    referenceTranslationItemCount,
    referenceTranslationLocales: [...referenceTranslationLocales].sort((a, b) => a.localeCompare(b)),
    contextAssetCount: contextAssets.length,
    contextAssets: contextAssets.map((asset) => ({
      path: asset.path,
      byteLength: asset.byteLength,
      truncated: asset.truncated,
      maxChars: asset.maxChars,
    })),
    commentedSourceItemCount,
    taskSize,
    taskFiles,
  };

  writeJsonFile(path.join(outputPath, "manifest.json"), manifest);

  if (args.json) {
    console.log(JSON.stringify(manifest, null, 2));
  } else {
    console.log(`Default locale: ${defaultLocale}`);
    console.log(`Changed default items: ${changedItems.length}`);
    console.log(`Target locales: ${targets.map((target) => target.locale).join(", ") || "-"}`);
    console.log(`Output: ${relativePath(outputPath)}`);
  }
}

main();
