#!/usr/bin/env node

/*
 * Purpose:
 * Verify that an extraction/export command actually produced the expected
 * locale JSON files.
 *
 * Some project-specific export tools can return exit code 0 while logging
 * partial download failures. This script checks the filesystem result instead
 * of trusting the command exit code: expected locale files must exist, parse as
 * JSON, contain string messages, and optionally pass a minimum key-count check.
 */

import fs from "node:fs";
import path from "node:path";
import {
  collectLocaleFiles,
  flattenStringMessages,
  getLocaleName,
  parseCliArgs,
  readLocaleFile,
  relativePath,
  resolveFromCwd,
  splitCsv,
} from "./lib/i18n-audit.mjs";

/** Prints command-line usage information. */
function printHelp() {
  console.log(`Usage:
  node skills/use-react-intl-universal/scripts/verify-locale-export.mjs --locales tmp/export --expected-locales zh_CN,en_US,ja_JP

Options:
  --locales PATH            Required. Directory containing exported locale JSON files.
  --expected-locales LIST   Required. Comma-separated locale names expected in the directory.
  --min-messages NUMBER     Optional. Minimum string-message count required for each locale.
  --reference-locale NAME   Optional. Locale used as the baseline for ratio checks.
  --min-ratio NUMBER        Optional. Minimum message-count ratio against the reference locale, for example 0.95.
  --json                    Print machine-readable JSON.
  --help                    Show this help.
`);
}

/** Converts a value to a finite number or returns a fallback. */
function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Reads exported locale JSON files and summarizes their message counts. */
function readExportedLocales(localesPath) {
  if (!fs.existsSync(localesPath)) {
    return [];
  }

  return collectLocaleFiles(localesPath).map((filePath) => {
    const localeFile = readLocaleFile(filePath);
    const messages = localeFile.parseError
      ? {}
      : flattenStringMessages(localeFile.json);

    return {
      locale: getLocaleName(filePath, localesPath),
      filePath,
      messageCount: Object.keys(messages).length,
      parseError: localeFile.parseError ? localeFile.parseError.message : null,
    };
  });
}

/** Creates a normalized locale-export verification issue. */
function createIssue(type, locale, message, extra = {}) {
  return {
    type,
    locale,
    message,
    ...extra,
  };
}

/** Verifies expected locale files, JSON shape, keys, and minimum message counts. */
function verifyExport({
  localesPath,
  expectedLocales,
  minMessages,
  referenceLocale,
  minRatio,
}) {
  const localeSummaries = readExportedLocales(localesPath);
  const byLocale = new Map(localeSummaries.map((summary) => [summary.locale, summary]));
  const issues = [];
  const warnings = [];

  if (!fs.existsSync(localesPath)) {
    issues.push(createIssue(
      "missing-locales-directory",
      null,
      `Locale export directory does not exist: ${relativePath(localesPath)}.`,
    ));
  }

  for (const locale of expectedLocales) {
    const summary = byLocale.get(locale);
    if (!summary) {
      issues.push(createIssue(
        "missing-locale-file",
        locale,
        `Expected locale file for "${locale}" was not generated.`,
      ));
      continue;
    }

    if (summary.parseError) {
      issues.push(createIssue(
        "invalid-json",
        locale,
        `Exported locale file is not valid JSON: ${summary.parseError}.`,
        { filePath: summary.filePath },
      ));
      continue;
    }

    if (minMessages !== null && summary.messageCount < minMessages) {
      issues.push(createIssue(
        "too-few-messages",
        locale,
        `Expected at least ${minMessages} string messages, got ${summary.messageCount}.`,
        { filePath: summary.filePath, messageCount: summary.messageCount, minMessages },
      ));
    }
  }

  const reference = referenceLocale ? byLocale.get(referenceLocale) : null;
  if (referenceLocale && !reference) {
    warnings.push(createIssue(
      "missing-reference-locale",
      referenceLocale,
      `Reference locale "${referenceLocale}" was not generated; ratio checks were skipped.`,
    ));
  }

  if (reference && !reference.parseError && minRatio !== null) {
    for (const locale of expectedLocales) {
      if (locale === referenceLocale) {
        continue;
      }

      const summary = byLocale.get(locale);
      if (!summary || summary.parseError) {
        continue;
      }

      const ratio = reference.messageCount === 0
        ? 0
        : summary.messageCount / reference.messageCount;
      if (ratio < minRatio) {
        issues.push(createIssue(
          "low-message-count-ratio",
          locale,
          `Message count ratio against ${referenceLocale} is ${ratio.toFixed(3)}, below ${minRatio}.`,
          {
            filePath: summary.filePath,
            messageCount: summary.messageCount,
            referenceLocale,
            referenceMessageCount: reference.messageCount,
            ratio,
            minRatio,
          },
        ));
      }
    }
  }

  const unexpectedLocales = localeSummaries
    .map((summary) => summary.locale)
    .filter((locale) => !expectedLocales.includes(locale));
  if (unexpectedLocales.length > 0) {
    warnings.push(createIssue(
      "unexpected-locale-file",
      null,
      `Export directory contains unexpected locale files: ${unexpectedLocales.join(", ")}.`,
      { locales: unexpectedLocales },
    ));
  }

  return {
    generatedAt: new Date().toISOString(),
    localesPath,
    expectedLocales,
    minMessages,
    referenceLocale: referenceLocale ?? null,
    minRatio,
    status: issues.length > 0 ? "failed" : "passed",
    issueCount: issues.length,
    warningCount: warnings.length,
    issues,
    warnings,
    localeSummaries: localeSummaries.map((summary) => ({
      ...summary,
      filePath: relativePath(summary.filePath),
    })),
  };
}

/** Prints locale export verification results as a text report. */
function printTextReport(report) {
  console.log(`Locale export: ${relativePath(report.localesPath)}`);
  console.log(`Status: ${report.status}`);
  console.log(`Expected locales: ${report.expectedLocales.join(", ") || "-"}`);
  console.log("");

  console.log("Locale files:");
  if (report.localeSummaries.length === 0) {
    console.log("- none detected");
  } else {
    for (const summary of report.localeSummaries) {
      const state = summary.parseError
        ? `invalid JSON: ${summary.parseError}`
        : `${summary.messageCount} messages`;
      console.log(`- ${summary.locale}: ${summary.filePath} (${state})`);
    }
  }

  console.log("");
  console.log("Issues:");
  if (report.issues.length === 0) {
    console.log("- none");
  } else {
    for (const issue of report.issues) {
      console.log(`- [${issue.type}] ${issue.locale ?? "-"} ${issue.message}`);
    }
  }

  console.log("");
  console.log("Warnings:");
  if (report.warnings.length === 0) {
    console.log("- none");
  } else {
    for (const warning of report.warnings) {
      console.log(`- [${warning.type}] ${warning.locale ?? "-"} ${warning.message}`);
    }
  }
}

/** Runs this script's command-line workflow. */
function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const expectedLocales = splitCsv(args["expected-locales"], []);
  if (!args.locales || expectedLocales.length === 0) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const localesPath = resolveFromCwd(String(args.locales));
  const report = verifyExport({
    localesPath,
    expectedLocales,
    minMessages: toNumber(args["min-messages"], null),
    referenceLocale: args["reference-locale"] ? String(args["reference-locale"]) : null,
    minRatio: toNumber(args["min-ratio"], null),
  });

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }

  if (report.status === "failed") {
    process.exitCode = 1;
  }
}

main();
