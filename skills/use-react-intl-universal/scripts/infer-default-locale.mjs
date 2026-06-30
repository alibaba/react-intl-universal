#!/usr/bin/env node

/*
 * Purpose:
 * Infer the default/source locale for a repository that uses
 * react-intl-universal.
 *
 * The script compares source .d(defaultMessage) strings with locale JSON
 * values. The locale with the highest exact/normalized match score is reported
 * as the likely default locale. The result is intentionally not cached; callers
 * should use the current repository state each time.
 */

import fs from "node:fs";
import {
  DEFAULT_SOURCE_EXTENSIONS,
  inferDefaultLocale,
  loadLocaleData,
  loadSourceMessages,
  parseCliArgs,
  relativePath,
  resolveFromCwd,
  splitCsv,
} from "./lib/i18n-audit.mjs";

function printHelp() {
  console.log(`Usage:
  node skills/use-react-intl-universal/scripts/infer-default-locale.mjs --source src --locales src/locales

Options:
  --source PATH        Required. Source file or directory to scan for intl.get(...).d(...).
  --locales PATH       Required. Directory containing locale JSON files.
  --extensions LIST    Optional. Comma-separated source extensions. Default: .js,.jsx,.ts,.tsx
  --ignore LIST        Optional. Comma-separated path substrings to skip.
  --json               Print machine-readable JSON.
  --help               Show this help.
`);
}

function printTextReport(report) {
  console.log(`Source: ${relativePath(report.sourcePath)}`);
  console.log(`Locales: ${relativePath(report.localesPath)}`);
  console.log(`Default locale: ${report.defaultLocale ?? "unknown"}`);
  console.log(`Confidence: ${report.confidence}${report.ambiguous ? " (ambiguous)" : ""}`);
  console.log(`Source messages: ${report.sourceMessageCount}`);

  if (report.skippedConflictingKeys.length > 0) {
    console.log(`Skipped conflicting keys: ${report.skippedConflictingKeys.join(", ")}`);
  }

  console.log("");
  console.log("Candidates:");
  for (const candidate of report.candidates.slice(0, 8)) {
    const percent = `${Math.round(candidate.score * 100)}%`.padStart(4);
    console.log(`- ${candidate.locale.padEnd(12)} score=${percent} exact=${candidate.exactMatches} normalized=${candidate.normalizedMatches} missing=${candidate.missingKeys}`);
  }

  const best = report.candidates[0];
  if (best?.samples?.length > 0) {
    console.log("");
    console.log(`Sample matches from ${best.locale}:`);
    for (const sample of best.samples) {
      console.log(`- ${sample.key}: ${sample.match}`);
    }
  }
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

  if (!fs.existsSync(sourcePath)) {
    console.error(`Source path does not exist: ${sourcePath}`);
    process.exitCode = 2;
    return;
  }

  if (!fs.existsSync(localesPath)) {
    console.error(`Locales path does not exist: ${localesPath}`);
    process.exitCode = 2;
    return;
  }

  const { sourceMessages } = loadSourceMessages(sourcePath, extensions, ignorePatterns);
  const localeData = loadLocaleData(localesPath, ignorePatterns);
  // The heavy lifting lives in the shared helper so audit and task generation
  // can use the same confidence rules.
  const inference = inferDefaultLocale(sourceMessages, localeData);
  const report = {
    sourcePath,
    localesPath,
    extensions,
    ignorePatterns,
    ...inference,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }

  if (!report.defaultLocale) {
    process.exitCode = 1;
  }
}

main();
