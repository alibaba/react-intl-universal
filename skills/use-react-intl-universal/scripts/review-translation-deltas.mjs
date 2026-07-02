#!/usr/bin/env node

/*
 * Purpose:
 * Review translation delta JSON files before they are merged into locale files.
 *
 * This script is a quality gate for the subagent workflow:
 * 1. create-translation-tasks.mjs creates focused per-locale task files.
 * 2. Humans or subagents return delta JSON files.
 * 3. This script checks whether the deltas cover the assigned task keys and
 *    whether the translations preserve ICU/rich-tag contracts.
 * 4. apply-translation-deltas.mjs can then merge the reviewed deltas.
 *
 * It does not write locale files and it does not decide subjective writing
 * quality. It flags deterministic risks that agents should review: missing
 * task translations, changed contracts, untranslated copies of the default
 * message, unexpected CJK text in non-CJK locales, and static UI-fit length
 * warnings.
 */

import fs from "node:fs";
import path from "node:path";
import {
  compareMessageContracts,
  formatList,
  getLengthRiskWarning,
  getLocaleName,
  getMessageContract,
  getMessageValue,
  hasContractDiff,
  loadLocaleData,
  loadSourceMessages,
  normalizeMessageForComparison,
  parseCliArgs,
  relativePath,
  resolveFromCwd,
  splitCsv,
  writeJsonFile,
  DEFAULT_SOURCE_EXTENSIONS,
} from "./lib/i18n-audit.mjs";

function printHelp() {
  console.log(`Usage:
  node skills/use-react-intl-universal/scripts/review-translation-deltas.mjs --locales src/locales --default-locale zh_CN --deltas tmp/i18n-translation-results --tasks tmp/i18n-translation-tasks/manifest.json

Options:
  --locales PATH             Required. Directory containing locale JSON files.
  --default-locale LOCALE    Required. Default/source locale used for contract checks.
  --deltas PATH              Required. Directory containing translation delta JSON files.
  --tasks PATH               Optional. A translation task JSON file, task manifest, or task output directory.
  --source PATH              Optional. Source path used for source context and length-risk hints.
  --target-locales LIST      Optional. Comma-separated locale names to review.
  --allow-unknown-keys       Optional. Warn instead of error when a delta key is not in the default locale.
  --strict                   Optional. Exit non-zero when review warnings exist.
  --extensions LIST          Optional. Comma-separated source extensions. Default: .js,.jsx,.ts,.tsx
  --ignore LIST              Optional. Comma-separated path substrings to skip.
  --output PATH              Optional. Write the JSON review report to this path.
  --json                     Print machine-readable JSON.
  --help                     Show this help.
`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function readDeltaFiles(deltasPath) {
  if (!fs.existsSync(deltasPath)) {
    return [];
  }

  return fs.readdirSync(deltasPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "manifest.json")
    .map((entry) => path.join(deltasPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

// Match apply-translation-deltas.mjs so both scripts accept the same delta
// shapes. The compact translations object is preferred for reviewability.
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

function inferLocaleFromDeltaPath(deltaPath, deltasPath) {
  const name = getLocaleName(deltaPath, deltasPath);
  return name.replace(/\.part-\d+$/i, "");
}

function createContractMismatchMessage(diff) {
  return `missing vars [${formatList(diff.missingVariables)}], extra vars [${formatList(diff.extraVariables)}], missing tags [${formatList(diff.missingTags)}], extra tags [${formatList(diff.extraTags)}]`;
}

function containsCjk(text) {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(String(text));
}

function isCjkLocale(locale) {
  const normalized = String(locale).toLowerCase().replace(/_/g, "-");
  return normalized.startsWith("zh") || normalized.startsWith("ja") || normalized.startsWith("ko");
}

function addCount(counts, key) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function findTaskJsonPaths(inputPath) {
  if (!inputPath) {
    return [];
  }

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
        if (fs.existsSync(fromCwd)) {
          return fromCwd;
        }
        return path.resolve(path.dirname(filePath), jsonPath);
      });
  }

  if (Array.isArray(data.items) && data.locale) {
    return [filePath];
  }

  throw new Error("--tasks must point to a task JSON file, manifest.json, or task output directory");
}

function loadExpectedTaskItems(tasksPath, issues) {
  const byLocale = new Map();
  const taskFiles = [];

  if (!tasksPath) {
    return { byLocale, taskFiles };
  }

  let taskJsonPaths = [];
  try {
    taskJsonPaths = findTaskJsonPaths(tasksPath);
  } catch (error) {
    issues.push({
      type: "invalid-task-input",
      severity: "error",
      message: error.message,
    });
    return { byLocale, taskFiles };
  }

  for (const taskPath of taskJsonPaths) {
    try {
      const task = readJson(taskPath);
      taskFiles.push(relativePath(taskPath));
      const locale = task.locale;
      if (!locale || !Array.isArray(task.items)) {
        issues.push({
          type: "invalid-task-file",
          severity: "error",
          filePath: relativePath(taskPath),
          message: "task file must contain locale and items",
        });
        continue;
      }

      const items = byLocale.get(locale) ?? new Map();
      for (const item of task.items) {
        if (item && typeof item.key === "string") {
          items.set(item.key, item);
        }
      }
      byLocale.set(locale, items);
    } catch (error) {
      issues.push({
        type: "invalid-task-file",
        severity: "error",
        filePath: relativePath(taskPath),
        message: error.message,
      });
    }
  }

  return { byLocale, taskFiles };
}

function getSourceMessageByKey(sourceMessages) {
  const map = new Map();
  for (const message of sourceMessages) {
    if (!map.has(message.key)) {
      map.set(message.key, message);
    }
  }
  return map;
}

function buildDeltaIndex({ deltasPath, targetLocales, issues }) {
  const translationsByLocale = new Map();
  const deltaFiles = [];
  const paths = readDeltaFiles(deltasPath);

  if (!fs.existsSync(deltasPath)) {
    issues.push({
      type: "missing-deltas-directory",
      severity: "error",
      message: `deltas directory does not exist: ${relativePath(deltasPath)}`,
    });
    return { translationsByLocale, deltaFiles };
  }

  if (paths.length === 0) {
    issues.push({
      type: "missing-delta-files",
      severity: "error",
      message: `no delta JSON files found in ${relativePath(deltasPath)}`,
    });
    return { translationsByLocale, deltaFiles };
  }

  for (const deltaPath of paths) {
    let delta;
    try {
      delta = readJson(deltaPath);
    } catch (error) {
      issues.push({
        type: "invalid-delta-json",
        severity: "error",
        deltaPath: relativePath(deltaPath),
        message: error.message,
      });
      continue;
    }

    const locale = delta.locale || inferLocaleFromDeltaPath(deltaPath, deltasPath);
    if (targetLocales.size > 0 && !targetLocales.has(locale)) {
      continue;
    }

    const translations = normalizeTranslations(delta);
    if (!translations) {
      issues.push({
        type: "invalid-delta-shape",
        severity: "error",
        locale,
        deltaPath: relativePath(deltaPath),
        message: "delta must contain translations object or items with translation fields",
      });
      continue;
    }

    const localeTranslations = translationsByLocale.get(locale) ?? new Map();
    for (const [key, value] of Object.entries(translations)) {
      const previous = localeTranslations.get(key);
      if (previous && previous.value !== value) {
        issues.push({
          type: "duplicate-delta-key",
          severity: "error",
          locale,
          key,
          deltaPath: relativePath(deltaPath),
          message: `key was already provided by ${previous.deltaPath} with a different value`,
        });
      }
      localeTranslations.set(key, { value, deltaPath: relativePath(deltaPath) });
    }
    translationsByLocale.set(locale, localeTranslations);
    deltaFiles.push({ locale, deltaPath: relativePath(deltaPath), itemCount: Object.keys(translations).length });
  }

  return { translationsByLocale, deltaFiles };
}

function reviewTaskCoverage({ expectedByLocale, translationsByLocale, issues, warnings }) {
  for (const [locale, expectedItems] of expectedByLocale) {
    const translations = translationsByLocale.get(locale) ?? new Map();

    for (const [key, item] of expectedItems) {
      const translated = translations.get(key);
      if (!translated) {
        issues.push({
          type: "missing-task-translation",
          severity: "error",
          locale,
          key,
          message: item.type === "deleted"
            ? "task expects this removed key to be returned as null"
            : "task expects a translation for this key",
        });
        continue;
      }

      if (item.type === "deleted" && translated.value !== null) {
        issues.push({
          type: "delete-task-not-null",
          severity: "error",
          locale,
          key,
          deltaPath: translated.deltaPath,
          message: "deleted task items must be returned as null",
        });
      }
    }

    for (const [key, translated] of translations) {
      if (!expectedItems.has(key)) {
        warnings.push({
          type: "extra-delta-key",
          severity: "medium",
          locale,
          key,
          deltaPath: translated.deltaPath,
          message: "delta includes a key that was not assigned in the provided translation task set",
        });
      }
    }
  }
}

function reviewTranslationValues({
  translationsByLocale,
  defaultLocale,
  defaultLocaleFile,
  allowUnknownKeys,
  sourceMessageByKey,
  issues,
  warnings,
}) {
  for (const [locale, translations] of translationsByLocale) {
    if (locale === defaultLocale) {
      issues.push({
        type: "default-locale-delta",
        severity: "error",
        locale,
        message: "translation deltas must not target the default locale",
      });
      continue;
    }

    for (const [key, translated] of translations) {
      const value = translated.value;
      const defaultValueInfo = getMessageValue(defaultLocaleFile.json, key);

      if (value === null) {
        if (defaultValueInfo.exists) {
          issues.push({
            type: "invalid-delete",
            severity: "error",
            locale,
            key,
            deltaPath: translated.deltaPath,
            message: "delta deletes a key that still exists in the default locale",
          });
        }
        continue;
      }

      if (typeof value !== "string") {
        issues.push({
          type: "non-string-translation",
          severity: "error",
          locale,
          key,
          deltaPath: translated.deltaPath,
          message: `translation must be string or null, got ${typeof value}`,
        });
        continue;
      }

      if (value.trim() === "") {
        issues.push({
          type: "empty-translation",
          severity: "error",
          locale,
          key,
          deltaPath: translated.deltaPath,
          message: "translation is empty",
        });
        continue;
      }

      if (!defaultValueInfo.exists) {
        const item = {
          type: "unknown-delta-key",
          severity: allowUnknownKeys ? "medium" : "error",
          locale,
          key,
          deltaPath: translated.deltaPath,
          message: "delta key is missing from the default locale",
        };
        if (allowUnknownKeys) {
          warnings.push(item);
        } else {
          issues.push(item);
        }
        continue;
      }

      if (typeof defaultValueInfo.value !== "string") {
        issues.push({
          type: "non-string-default",
          severity: "error",
          locale,
          key,
          deltaPath: translated.deltaPath,
          message: `default locale value should be a string, got ${typeof defaultValueInfo.value}`,
        });
        continue;
      }

      const defaultContract = getMessageContract(defaultValueInfo.value);
      const translatedContract = getMessageContract(value);
      const diff = compareMessageContracts(defaultContract, translatedContract);
      if (hasContractDiff(diff)) {
        issues.push({
          type: "contract-mismatch",
          severity: "error",
          locale,
          key,
          deltaPath: translated.deltaPath,
          message: createContractMismatchMessage(diff),
          diff,
        });
      }

      if (normalizeMessageForComparison(value) === normalizeMessageForComparison(defaultValueInfo.value)) {
        warnings.push({
          type: containsCjk(defaultValueInfo.value) ? "copied-cjk-default" : "same-as-default",
          severity: containsCjk(defaultValueInfo.value) ? "high" : "medium",
          locale,
          key,
          deltaPath: translated.deltaPath,
          message: "translation is identical to the default message; confirm this is intentional",
        });
      }

      if (!isCjkLocale(locale) && containsCjk(value)) {
        warnings.push({
          type: "unexpected-cjk",
          severity: "high",
          locale,
          key,
          deltaPath: translated.deltaPath,
          message: "translation for a non-CJK locale contains CJK characters",
        });
      }

      const lengthRisk = getLengthRiskWarning({
        key,
        locale,
        defaultMessage: defaultValueInfo.value,
        translatedMessage: value,
        sourceMessage: sourceMessageByKey.get(key),
      });
      if (lengthRisk && lengthRisk.severity !== "low") {
        warnings.push({
          type: "length-risk",
          severity: lengthRisk.severity,
          locale,
          key,
          deltaPath: translated.deltaPath,
          message: `static UI-fit length warning for ${lengthRisk.uiRisk} UI: estimated display-width ratio=${lengthRisk.ratio}; inspect source usage before shortening text`,
          lengthRisk,
        });
      }
    }
  }
}

function countBy(items) {
  const counts = {};
  for (const item of items) {
    addCount(counts, item.type ?? "unknown");
  }
  return counts;
}

function createReport({
  defaultLocale,
  deltaFiles,
  taskFiles,
  expectedByLocale,
  translationsByLocale,
  issues,
  warnings,
}) {
  const reviewedEntryCount = [...translationsByLocale.values()]
    .reduce((total, translations) => total + translations.size, 0);
  const expectedItemCount = [...expectedByLocale.values()]
    .reduce((total, items) => total + items.size, 0);
  const status = issues.length > 0
    ? "failed"
    : warnings.length > 0
      ? "review-required"
      : "passed";

  return {
    generatedAt: new Date().toISOString(),
    status,
    defaultLocale,
    deltaFileCount: deltaFiles.length,
    reviewedEntryCount,
    taskFileCount: taskFiles.length,
    expectedItemCount,
    issueCount: issues.length,
    warningCount: warnings.length,
    issueCounts: countBy(issues),
    warningCounts: countBy(warnings),
    deltaFiles,
    taskFiles,
    issues,
    warnings,
  };
}

function printTextReport(report) {
  console.log(`Status: ${report.status}`);
  console.log(`Delta files: ${report.deltaFileCount}`);
  console.log(`Reviewed entries: ${report.reviewedEntryCount}`);
  console.log(`Expected task items: ${report.expectedItemCount}`);
  console.log(`Issues: ${report.issueCount}`);
  console.log(`Warnings: ${report.warningCount}`);

  for (const issue of report.issues.slice(0, 12)) {
    console.log(`issue [${issue.type}] ${issue.locale ?? "-"} ${issue.key ?? "-"} ${issue.message}`);
  }
  for (const warning of report.warnings.slice(0, 12)) {
    console.log(`warning [${warning.type}] ${warning.locale ?? "-"} ${warning.key ?? "-"} ${warning.message}`);
  }
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.locales || !args.deltas || !args["default-locale"]) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const localesPath = resolveFromCwd(String(args.locales));
  const deltasPath = resolveFromCwd(String(args.deltas));
  const defaultLocale = String(args["default-locale"]);
  const ignorePatterns = splitCsv(args.ignore, []);
  const extensions = splitCsv(args.extensions, DEFAULT_SOURCE_EXTENSIONS);
  const targetLocales = new Set(splitCsv(args["target-locales"], []));
  const allowUnknownKeys = Boolean(args["allow-unknown-keys"]);
  const strict = Boolean(args.strict);
  const issues = [];
  const warnings = [];

  const localeData = loadLocaleData(localesPath, ignorePatterns);
  const defaultLocaleData = localeData.find((item) => item.locale === defaultLocale);
  if (!defaultLocaleData) {
    issues.push({
      type: "missing-default-locale",
      severity: "error",
      locale: defaultLocale,
      message: `default locale file not found in ${relativePath(localesPath)}`,
    });
  } else if (defaultLocaleData.localeFile.parseError) {
    issues.push({
      type: "invalid-default-locale-json",
      severity: "error",
      locale: defaultLocale,
      filePath: relativePath(defaultLocaleData.filePath),
      message: defaultLocaleData.localeFile.parseError.message,
    });
  }

  let sourceMessageByKey = new Map();
  if (args.source) {
    const sourceMessages = loadSourceMessages(resolveFromCwd(String(args.source)), extensions, ignorePatterns).sourceMessages;
    sourceMessageByKey = getSourceMessageByKey(sourceMessages);
  }

  const { byLocale: expectedByLocale, taskFiles } = loadExpectedTaskItems(args.tasks, issues);
  const { translationsByLocale, deltaFiles } = buildDeltaIndex({ deltasPath, targetLocales, issues });

  if (defaultLocaleData && !defaultLocaleData.localeFile.parseError && deltaFiles.length > 0) {
    reviewTaskCoverage({ expectedByLocale, translationsByLocale, issues, warnings });
    reviewTranslationValues({
      translationsByLocale,
      defaultLocale,
      defaultLocaleFile: defaultLocaleData.localeFile,
      allowUnknownKeys,
      sourceMessageByKey,
      issues,
      warnings,
    });
  }

  const report = createReport({
    defaultLocale,
    deltaFiles,
    taskFiles,
    expectedByLocale,
    translationsByLocale,
    issues,
    warnings,
  });

  if (args.output) {
    writeJsonFile(resolveFromCwd(String(args.output)), report);
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }

  if (issues.length > 0 || (strict && warnings.length > 0)) {
    process.exitCode = 1;
  }
}

main();
