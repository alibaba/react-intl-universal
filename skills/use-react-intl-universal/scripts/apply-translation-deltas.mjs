#!/usr/bin/env node

/*
 * Purpose:
 * Apply translation delta JSON files into locale JSON files.
 *
 * This script is the only step that writes translated locale files in the
 * subagent workflow. Subagents should return delta JSON; the main agent runs
 * this script to merge those deltas in a controlled, auditable way.
 * By default, no files are written unless every delta entry passes validation.
 */

import fs from "node:fs";
import path from "node:path";
import {
  compareMessageContracts,
  deleteMessageValue,
  formatList,
  getLocaleName,
  getMessageContract,
  getMessageValue,
  hasContractDiff,
  loadLocaleData,
  parseCliArgs,
  relativePath,
  resolveFromCwd,
  setMessageValue,
  writeJsonFile,
} from "./lib/i18n-audit.mjs";

function printHelp() {
  console.log(`Usage:
  node skills/use-react-intl-universal/scripts/apply-translation-deltas.mjs --locales src/locales --deltas tmp/i18n-translation-results --default-locale en-US

Options:
  --locales PATH             Required. Directory containing locale JSON files.
  --deltas PATH              Required. Directory containing delta JSON files.
  --default-locale LOCALE    Optional. Refuse to apply deltas to this locale and validate contracts against it.
  --allow-contract-mismatch  Optional. Apply string translations even if ICU variables or rich tags differ.
  --allow-unknown-keys       Optional. Apply string translations even if the key is missing from the default locale.
  --allow-partial            Optional. Write valid entries even when some entries are skipped.
  --dry-run                  Print what would change without writing files.
  --json                     Print machine-readable JSON.
  --help                     Show this help.
`);
}

function readDeltaFiles(deltasPath) {
  const entries = fs.readdirSync(deltasPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "manifest.json")
    .map((entry) => path.join(deltasPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

// Accept two simple delta formats:
// 1. { "locale": "de-DE", "translations": { "KEY": "value" } }
// 2. { "locale": "de-DE", "items": [{ "key": "KEY", "translation": "value" }] }
// The first format is preferred because it is compact and easy to review.
function normalizeTranslations(delta) {
  if (delta.translations && typeof delta.translations === "object") {
    return delta.translations;
  }

  if (Array.isArray(delta.items)) {
    const translations = {};
    for (const item of delta.items) {
      if (item && typeof item.key === "string" && Object.prototype.hasOwnProperty.call(item, "translation")) {
        translations[item.key] = item.translation;
      }
    }
    return translations;
  }

  return null;
}

function createContractMismatchReason(diff) {
  return `contract mismatch: missing vars [${formatList(diff.missingVariables)}], extra vars [${formatList(diff.extraVariables)}], missing tags [${formatList(diff.missingTags)}], extra tags [${formatList(diff.extraTags)}]`;
}

function validateDeltaValue({
  key,
  value,
  defaultLocaleFile,
  allowContractMismatch,
  allowUnknownKeys,
}) {
  if (!defaultLocaleFile) {
    return { ok: true };
  }

  const defaultValueInfo = getMessageValue(defaultLocaleFile.json, key);

  if (value === null) {
    if (defaultValueInfo.exists) {
      return {
        ok: false,
        reason: "delete skipped because the key still exists in the default locale",
      };
    }

    return { ok: true };
  }

  if (!defaultValueInfo.exists) {
    return {
      ok: allowUnknownKeys,
      reason: allowUnknownKeys ? null : "key is missing from the default locale",
    };
  }

  const defaultContract = getMessageContract(defaultValueInfo.value);
  if (!defaultContract.isString) {
    return {
      ok: false,
      reason: `default locale value should be a string, got ${typeof defaultValueInfo.value}`,
    };
  }

  if (allowContractMismatch) {
    return { ok: true };
  }

  const translatedContract = getMessageContract(value);
  const diff = compareMessageContracts(defaultContract, translatedContract);
  if (hasContractDiff(diff)) {
    return {
      ok: false,
      reason: createContractMismatchReason(diff),
    };
  }

  return { ok: true };
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.locales || !args.deltas) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const localesPath = resolveFromCwd(String(args.locales));
  const deltasPath = resolveFromCwd(String(args.deltas));
  const defaultLocale = args["default-locale"] ? String(args["default-locale"]) : null;
  const allowContractMismatch = Boolean(args["allow-contract-mismatch"]);
  const allowUnknownKeys = Boolean(args["allow-unknown-keys"]);
  const allowPartial = Boolean(args["allow-partial"]);
  const dryRun = Boolean(args["dry-run"]);
  const localeData = loadLocaleData(localesPath);
  const localeByName = new Map(localeData.map((item) => [item.locale, item]));
  const defaultLocaleData = defaultLocale ? localeByName.get(defaultLocale) : null;
  const touchedTargets = new Map();
  const results = [];
  const issues = [];

  if (defaultLocale) {
    if (!defaultLocaleData) {
      issues.push({ locale: defaultLocale, error: "default locale file not found; cannot validate translation deltas" });
    } else if (defaultLocaleData.localeFile.parseError) {
      issues.push({ locale: defaultLocale, filePath: relativePath(defaultLocaleData.filePath), error: `default locale JSON is invalid: ${defaultLocaleData.localeFile.parseError.message}` });
    }
  }

  if (issues.length > 0) {
    const report = { dryRun, results, issues };

    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      for (const issue of issues) {
        console.log(`error: ${issue.locale ?? "-"} ${issue.deltaPath ?? issue.filePath ?? "-"}: ${issue.error}`);
      }
    }

    process.exitCode = 1;
    return;
  }

  for (const deltaPath of readDeltaFiles(deltasPath)) {
    let delta;
    try {
      delta = JSON.parse(fs.readFileSync(deltaPath, "utf8"));
    } catch (error) {
      issues.push({ deltaPath: relativePath(deltaPath), error: `invalid delta JSON: ${error.message}` });
      continue;
    }

    const locale = delta.locale || getLocaleName(deltaPath, deltasPath);
    if (defaultLocale && locale === defaultLocale) {
      // Default locale is generated from .d(); translation deltas must never
      // overwrite it, even by accident.
      issues.push({ deltaPath: relativePath(deltaPath), locale, error: "refusing to apply delta to default locale" });
      continue;
    }

    let target = localeByName.get(locale);
    const created = !target;
    if (!target) {
      // New-language initialization starts with no locale JSON file. In that
      // case, create an empty in-memory pack and write it after applying the
      // delta. Store it in the map immediately so multiple batch delta files
      // for the same new locale accumulate into one JSON object instead of
      // overwriting each other.
      target = {
        locale,
        filePath: path.join(localesPath, `${locale}.json`),
        localeFile: {
          json: {},
          parseError: null,
        },
      };
      localeByName.set(locale, target);
    }

    if (target.localeFile.parseError) {
      issues.push({ deltaPath: relativePath(deltaPath), locale, error: `target locale JSON is invalid: ${target.localeFile.parseError.message}` });
      continue;
    }

    const translations = normalizeTranslations(delta);
    if (!translations) {
      issues.push({ deltaPath: relativePath(deltaPath), locale, error: "delta must contain translations object or items with translation fields" });
      continue;
    }

    const localeJson = target.localeFile.json;
    let updated = 0;
    let deleted = 0;
    const skipped = [];

    for (const [key, value] of Object.entries(translations)) {
      if (value === null) {
        const validation = validateDeltaValue({
          key,
          value,
          defaultLocaleFile: defaultLocaleData?.localeFile,
          allowContractMismatch,
          allowUnknownKeys,
        });

        if (!validation.ok) {
          skipped.push({ key, reason: validation.reason });
          continue;
        }

        // Null is an explicit delete signal for keys removed from the default
        // locale. Missing keys are ignored so repeated runs are idempotent.
        if (deleteMessageValue(localeJson, key)) {
          deleted += 1;
        }
        continue;
      }

      if (typeof value !== "string") {
        // Keep malformed entries visible but do not write partial bad data.
        skipped.push({ key, reason: `translation must be string or null, got ${typeof value}` });
        continue;
      }

      const validation = validateDeltaValue({
        key,
        value,
        defaultLocaleFile: defaultLocaleData?.localeFile,
        allowContractMismatch,
        allowUnknownKeys,
      });

      if (!validation.ok) {
        skipped.push({ key, reason: validation.reason });
        continue;
      }

      // setMessageValue preserves nested locale shape when the key already
      // exists as a nested path; otherwise it writes a flat generated key.
      setMessageValue(localeJson, key, value);
      updated += 1;
    }

    if (updated > 0 || deleted > 0) {
      touchedTargets.set(target.locale, target);
    }

    results.push({
      locale,
      filePath: relativePath(target.filePath),
      deltaPath: relativePath(deltaPath),
      updated,
      deleted,
      skipped,
      dryRun,
      created,
    });
  }

  const hasSkipped = results.some((result) => result.skipped.length > 0);
  const shouldWrite = !dryRun && issues.length === 0 && touchedTargets.size > 0 && (allowPartial || !hasSkipped);

  if (shouldWrite) {
    for (const target of touchedTargets.values()) {
      writeJsonFile(target.filePath, target.localeFile.json);
    }
  }

  const report = {
    dryRun,
    allowPartial,
    wroteFiles: shouldWrite,
    results,
    issues,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const result of results) {
      console.log(`${result.locale}: updated=${result.updated}, deleted=${result.deleted}, skipped=${result.skipped.length}${result.created ? ", created=true" : ""}${dryRun ? " (dry-run)" : ""}`);
    }
    for (const issue of issues) {
      console.log(`error: ${issue.locale ?? "-"} ${issue.deltaPath}: ${issue.error}`);
    }
    if (!dryRun && touchedTargets.size > 0 && hasSkipped && !allowPartial) {
      console.log("no files written: fix skipped entries or pass --allow-partial to write valid entries anyway");
    }
  }

  if (issues.length > 0 || results.some((result) => result.skipped.length > 0)) {
    process.exitCode = 1;
  }
}

main();
