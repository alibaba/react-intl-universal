#!/usr/bin/env node

/*
 * Purpose:
 * Audit the contract between source intl.get(...).d(...) messages and locale
 * JSON files.
 *
 * The script checks missing keys, conflicting source defaults, ICU variable
 * mismatches, rich-tag mismatches, deprecated getHTML usage, and optional
 * non-default translation length risks. It is designed as the final validation
 * step after extraction and translation delta merge.
 */

import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_SOURCE_EXTENSIONS,
  collectLocaleFiles,
  collectSourceFiles,
  compareMessageContracts,
  extractIntlMessagesFromSource,
  filterIgnoredFiles,
  findGetHTMLUsages,
  findLocation,
  formatList,
  getLengthRiskWarning,
  getLocaleName,
  getMessageContract,
  getMessageValue,
  hasContractDiff,
  inferDefaultLocale,
  parseCliArgs,
  readLocaleFile,
  relativePath,
  resolveFromCwd,
  splitCsv,
} from "./lib/i18n-audit.mjs";

function printHelp() {
  console.log(`Usage:
  node skills/use-react-intl-universal/scripts/audit-i18n-contract.mjs --source src --locales src/locales

Options:
  --source PATH             Required. Source file or directory to scan.
  --locales PATH            Required. Directory containing locale JSON files.
  --extensions LIST         Optional. Comma-separated source extensions. Default: .js,.jsx,.ts,.tsx
  --ignore LIST             Optional. Comma-separated path substrings to skip.
  --default-locale LOCALE   Optional. Default/source locale. Used by length warnings.
  --infer-default-locale    Optional. Infer default locale by comparing .d() messages with locale files.
  --length-warnings         Optional. Warn when non-default translations are likely too long for compact UI.
  --length-ratio NUMBER     Optional. Base display-width ratio for length warnings. Default: 1.35
  --strict                  Treat warnings as errors.
  --json                    Print machine-readable JSON.
  --help                    Show this help.
`);
}

function groupBy(items, getKey) {
  const map = new Map();

  for (const item of items) {
    const key = getKey(item);
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }

  return map;
}

function createIssue(type, message, details = {}) {
  return {
    type,
    message,
    ...details,
  };
}

function createWarning(type, message, details = {}) {
  return {
    type,
    message,
    ...details,
  };
}

function printTextReport(report) {
  console.log(`Source: ${relativePath(report.sourcePath)}`);
  console.log(`Locales: ${relativePath(report.localesPath)}`);
  console.log(`Default locale: ${report.defaultLocale ?? "unknown"}`);
  if (report.defaultLocaleInference) {
    console.log(`Default-locale confidence: ${report.defaultLocaleInference.confidence}${report.defaultLocaleInference.ambiguous ? " (ambiguous)" : ""}`);
  }
  console.log(`Messages found: ${report.messageCount}`);
  console.log("");

  if (report.issues.length > 0) {
    console.log("Errors:");
    for (const issue of report.issues) {
      const location = issue.filePath
        ? `${relativePath(issue.filePath)}${issue.line ? `:${issue.line}` : ""}`
        : "-";
      console.log(`- [${issue.type}] ${location} ${issue.message}`);
    }
    console.log("");
  }

  if (report.warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of report.warnings) {
      const location = warning.filePath
        ? `${relativePath(warning.filePath)}${warning.line ? `:${warning.line}` : ""}`
        : "-";
      console.log(`- [${warning.type}] ${location} ${warning.message}`);
    }
    console.log("");
  }

  if (report.issues.length === 0 && report.warnings.length === 0) {
    console.log("Result: OK");
    return;
  }

  console.log(`Result: ${report.issues.length} error(s), ${report.warnings.length} warning(s)`);
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.source || !args.locales) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const sourcePath = resolveFromCwd(String(args.source));
  const localesPath = resolveFromCwd(String(args.locales));
  const extensions = splitCsv(args.extensions, DEFAULT_SOURCE_EXTENSIONS);
  const ignorePatterns = splitCsv(args.ignore, []);
  const strict = Boolean(args.strict);
  const lengthWarnings = Boolean(args["length-warnings"]);
  const lengthRatio = args["length-ratio"] ? Number(args["length-ratio"]) : 1.35;
  let defaultLocale = args["default-locale"] ? String(args["default-locale"]) : null;
  let defaultLocaleInference = null;
  const issues = [];
  const warnings = [];

  if (!fs.existsSync(sourcePath)) {
    issues.push(createIssue("missing-source", `source path does not exist: ${sourcePath}`));
  }

  if (!fs.existsSync(localesPath)) {
    issues.push(createIssue("missing-locales", `locales path does not exist: ${localesPath}`));
  }

  const sourceFiles = issues.length === 0
    ? filterIgnoredFiles(collectSourceFiles(sourcePath, extensions), ignorePatterns)
    : [];
  const localeFiles = issues.length === 0
    ? filterIgnoredFiles(collectLocaleFiles(localesPath), ignorePatterns)
    : [];
  const localeData = localeFiles.map((filePath) => {
    const localeFile = readLocaleFile(filePath);
    const locale = getLocaleName(filePath, localesPath);

    if (localeFile.parseError) {
      issues.push(createIssue(
        "invalid-json",
        `invalid JSON in ${locale}: ${localeFile.parseError.message}`,
        { filePath }
      ));
    }

    for (const duplicate of localeFile.duplicateProperties) {
      warnings.push(createWarning(
        "duplicate-locale-key",
        `duplicate key "${duplicate.key}" in ${locale}, first line ${duplicate.firstLine}, repeated line ${duplicate.line}`,
        { filePath, line: duplicate.line, locale, key: duplicate.key }
      ));
    }

    return {
      locale,
      filePath,
      localeFile,
    };
  });

  const sourceMessages = [];

  // Source scanning is intentionally separate from locale scanning. The script
  // must also record getHTML usages even though getHTML messages are not part
  // of the rich React component contract enforced below.
  for (const filePath of sourceFiles) {
    const text = fs.readFileSync(filePath, "utf8");
    sourceMessages.push(...extractIntlMessagesFromSource(text, filePath));

    for (const usage of findGetHTMLUsages(text, filePath)) {
      warnings.push(createWarning(
        "deprecated-getHTML",
        "intl.getHTML is deprecated for React UI; prefer rich tag formatters with intl.get",
        usage
      ));
    }
  }

  for (const message of sourceMessages) {
    if (message.usesTemplateInterpolation) {
      warnings.push(createWarning(
        "template-default-message",
        `.d() uses JavaScript template interpolation for key "${message.key}"; prefer ICU placeholders in the default message`,
        message
      ));
    }
  }

  const contractSourceMessages = sourceMessages.filter((message) => message.api === "get");

  // Length warnings need to know which locale is the source/default locale.
  // If the caller does not provide one, infer it from .d() message matches.
  if ((args["infer-default-locale"] || (lengthWarnings && !defaultLocale)) && contractSourceMessages.length > 0 && localeData.length > 0) {
    defaultLocaleInference = inferDefaultLocale(sourceMessages, localeData);
    if (!defaultLocale && defaultLocaleInference.defaultLocale) {
      defaultLocale = defaultLocaleInference.defaultLocale;
    }
  }

  if (lengthWarnings && !defaultLocale) {
    warnings.push(createWarning(
      "unknown-default-locale",
      "length warnings require --default-locale or a confident --infer-default-locale result"
    ));
  }

  const messagesByKey = groupBy(contractSourceMessages, (message) => message.key);

  // For each source key, there must be exactly one default message contract.
  // Multiple .d() values for the same key would make translation sync unsafe.
  for (const [key, messages] of messagesByKey) {
    const defaults = new Map();

    for (const message of messages) {
      const defaultGroup = defaults.get(message.transformedDefaultMessage) ?? [];
      defaultGroup.push(message);
      defaults.set(message.transformedDefaultMessage, defaultGroup);
    }

    if (defaults.size > 1) {
      const locations = messages
        .map((message) => `${relativePath(message.filePath)}:${message.line}`)
        .join(", ");

      issues.push(createIssue(
        "conflicting-default-message",
        `key "${key}" has multiple .d() messages: ${locations}`,
        { key }
      ));
      continue;
    }

    const [sourceMessage] = messages;
    const sourceContract = getMessageContract(sourceMessage.transformedDefaultMessage);

    // Compare each locale message against the source contract. The translated
    // words can differ, but variables and rich tags must stay equivalent.
    for (const { locale, filePath, localeFile } of localeData) {
      if (localeFile.parseError) {
        continue;
      }

      const valueInfo = getMessageValue(localeFile.json, key);
      if (!valueInfo.exists) {
        issues.push(createIssue(
          "missing-locale-key",
          `locale "${locale}" is missing key "${key}" from ${relativePath(sourceMessage.filePath)}:${sourceMessage.line}`,
          { key, locale, filePath }
        ));
        continue;
      }

      const location = findLocation(localeFile.propertyLocations, valueInfo.pathSegments);
      const localeContract = getMessageContract(valueInfo.value);

      if (!localeContract.isString) {
        issues.push(createIssue(
          "non-string-locale-message",
          `locale "${locale}" key "${key}" should be a string, got ${typeof valueInfo.value}`,
          { key, locale, filePath, line: location?.line }
        ));
        continue;
      }

      const diff = compareMessageContracts(sourceContract, localeContract);
      if (hasContractDiff(diff)) {
        issues.push(createIssue(
          "locale-contract-mismatch",
          `locale "${locale}" key "${key}" differs from .d(): missing vars [${formatList(diff.missingVariables)}], extra vars [${formatList(diff.extraVariables)}], missing tags [${formatList(diff.missingTags)}], extra tags [${formatList(diff.extraTags)}]`,
          { key, locale, filePath, line: location?.line }
        ));
      }

      if (lengthWarnings && defaultLocale && locale !== defaultLocale) {
        // Length warnings are only advisory and only apply to translated
        // locales. The default locale is treated as source text and is not
        // rewritten just because another language may be wider.
        const lengthRisk = getLengthRiskWarning({
          key,
          locale,
          defaultMessage: sourceMessage.transformedDefaultMessage,
          translatedMessage: valueInfo.value,
          sourceMessage,
          ratioThreshold: Number.isFinite(lengthRatio) ? lengthRatio : 1.35,
        });

        if (lengthRisk) {
          warnings.push(createWarning(
            "long-translation",
            `locale "${locale}" key "${key}" may be too long for compact UI: ${lengthRisk.translatedWidth}/${lengthRisk.defaultWidth} display width (${lengthRisk.ratio}x), uiRisk=${lengthRisk.uiRisk}, severity=${lengthRisk.severity}`,
            {
              key,
              locale,
              filePath,
              line: location?.line,
              lengthRisk,
              source: {
                filePath: relativePath(sourceMessage.filePath),
                line: sourceMessage.line,
                lineText: sourceMessage.lineText,
                callText: sourceMessage.callText,
              },
            }
          ));
        }
      }
    }
  }

  const report = {
    sourcePath,
    localesPath,
    extensions,
    ignorePatterns,
    strict,
    defaultLocale,
    defaultLocaleInference,
    lengthWarnings,
    lengthRatio,
    // Count source intl.get(...).d(...) contract entries, not locale JSON keys.
    sourceMessageCount: contractSourceMessages.length,
    messageCount: contractSourceMessages.length,
    issues,
    warnings,
  };

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
