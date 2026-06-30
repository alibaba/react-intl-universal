#!/usr/bin/env node

/*
 * Purpose:
 * Inspect one react-intl-universal message key across every locale JSON file.
 *
 * Use this before changing an existing key or when a user asks where a key is
 * defined. The script reports each locale file, line number, current message,
 * ICU variables, rich tags, missing keys, and contract mismatches.
 */

import {
  collectLocaleFiles,
  compareMessageContracts,
  findLocation,
  formatList,
  getLocaleName,
  getMessageContract,
  getMessageValue,
  hasContractDiff,
  parseCliArgs,
  readLocaleFile,
  relativePath,
  resolveFromCwd,
} from "./lib/i18n-audit.mjs";

function printHelp() {
  console.log(`Usage:
  node skills/use-react-intl-universal/scripts/audit-locale-key.mjs --key KEY --locales src/locales

Options:
  --key KEY                 Required. Locale message key to inspect.
  --locales PATH            Required. Directory containing locale JSON files.
  --source-message MESSAGE  Optional. Compare locale messages against this .d() source message.
  --default-locale LOCALE   Optional. Locale name to use as baseline when --source-message is absent.
  --json                    Print machine-readable JSON.
  --help                    Show this help.
`);
}

// Pick the baseline message contract used for comparison. Prefer an explicit
// --source-message, then --default-locale, then common English locale names,
// and finally the first string value found in locale files.
function chooseBaseline(results, defaultLocale) {
  if (defaultLocale) {
    const exact = results.find((result) => result.locale === defaultLocale && result.exists);
    if (exact) {
      return exact;
    }
  }

  const preferred = ["en-US", "en_US", "en", "en-GB", "en_GB"];
  for (const locale of preferred) {
    const result = results.find((item) => item.locale === locale && item.exists);
    if (result) {
      return result;
    }
  }

  return results.find((result) => result.exists && typeof result.value === "string") ?? null;
}

function printTextReport(report) {
  console.log(`Key: ${report.key}`);
  console.log(`Locales: ${relativePath(report.localesPath)}`);

  if (report.baseline) {
    console.log(`Baseline: ${report.baseline.label}`);
    console.log(`Baseline variables: ${formatList(report.baseline.contract.variables)}`);
    console.log(`Baseline rich tags: ${formatList(report.baseline.contract.tags)}`);
  } else {
    console.log("Baseline: -");
  }

  console.log("");

  for (const result of report.results) {
    const location = result.line ? `${relativePath(result.filePath)}:${result.line}` : `${relativePath(result.filePath)}:-`;
    const status = result.parseError
      ? "invalid-json"
      : result.exists
        ? "exists"
        : "missing";

    console.log(`${result.locale.padEnd(12)} ${location.padEnd(56)} ${status}`);

    if (result.exists) {
      console.log(`  value: ${JSON.stringify(result.value)}`);
      console.log(`  variables: ${formatList(result.contract.variables)}`);
      console.log(`  rich tags: ${formatList(result.contract.tags)}`);
    }

    for (const issue of result.issues) {
      console.log(`  error: ${issue}`);
    }

    for (const warning of result.warnings) {
      console.log(`  warning: ${warning}`);
    }
  }

  console.log("");

  if (report.issueCount === 0 && report.warningCount === 0) {
    console.log("Result: OK");
  } else {
    console.log(`Result: ${report.issueCount} error(s), ${report.warningCount} warning(s)`);
  }
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.key || !args.locales) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const key = String(args.key);
  const localesPath = resolveFromCwd(String(args.locales));
  const localeFiles = collectLocaleFiles(localesPath);

  // Read every locale file once. Each result carries parse status, source line,
  // current value, and extracted contract metadata for the requested key.
  const results = localeFiles.map((filePath) => {
    const localeFile = readLocaleFile(filePath);
    const locale = getLocaleName(filePath, localesPath);
    const valueInfo = getMessageValue(localeFile.json, key);
    const location = valueInfo.exists
      ? findLocation(localeFile.propertyLocations, valueInfo.pathSegments)
      : null;

    const duplicateForKey = localeFile.duplicateProperties.filter((duplicate) => (
      duplicate.pathSegments.length === valueInfo.pathSegments.length
      && duplicate.pathSegments.every((segment, index) => segment === valueInfo.pathSegments[index])
    ));

    return {
      locale,
      filePath,
      line: location?.line ?? null,
      exists: valueInfo.exists,
      value: valueInfo.value,
      parseError: localeFile.parseError ? String(localeFile.parseError.message) : null,
      contract: getMessageContract(valueInfo.value),
      issues: [],
      warnings: duplicateForKey.map((duplicate) => (
        `duplicate key in the same JSON object, first line ${duplicate.firstLine}, repeated line ${duplicate.line}`
      )),
    };
  });

  let baseline;
  if (args["source-message"] != null) {
    // This mode is useful when the source .d() was just edited and the caller
    // wants every locale checked against that new source contract immediately.
    baseline = {
      label: "source message",
      value: String(args["source-message"]),
      contract: getMessageContract(String(args["source-message"])),
    };
  } else {
    const baselineResult = chooseBaseline(results, args["default-locale"] ? String(args["default-locale"]) : null);
    baseline = baselineResult
      ? {
        label: baselineResult.locale,
        value: baselineResult.value,
        contract: baselineResult.contract,
      }
      : null;
  }

  // Convert parse/missing/type/contract problems into per-locale issue lists so
  // the report can show all locales instead of failing at the first problem.
  for (const result of results) {
    if (result.parseError) {
      result.issues.push(`invalid JSON: ${result.parseError}`);
      continue;
    }

    if (!result.exists) {
      result.issues.push("missing key");
      continue;
    }

    if (!result.contract.isString) {
      result.issues.push(`message value should be a string, got ${typeof result.value}`);
      continue;
    }

    if (baseline) {
      const diff = compareMessageContracts(baseline.contract, result.contract);
      if (hasContractDiff(diff)) {
        result.issues.push(
          `contract mismatch: missing vars [${formatList(diff.missingVariables)}], extra vars [${formatList(diff.extraVariables)}], missing tags [${formatList(diff.missingTags)}], extra tags [${formatList(diff.extraTags)}]`
        );
      }
    }
  }

  const issueCount = results.reduce((count, result) => count + result.issues.length, 0);
  const warningCount = results.reduce((count, result) => count + result.warnings.length, 0);
  const report = {
    key,
    localesPath,
    baseline,
    results,
    issueCount,
    warningCount,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }

  if (issueCount > 0) {
    process.exitCode = 1;
  }
}

main();
