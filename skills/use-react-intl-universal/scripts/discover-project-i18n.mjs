#!/usr/bin/env node

/*
 * Purpose:
 * Discover the i18n wiring of an application repository before changing
 * react-intl-universal messages or locale packs.
 *
 * Real projects often wrap react-intl-universal with custom extraction
 * commands, locale providers, date libraries, and component-library locale
 * adapters. This script gives agents a deterministic first pass over those
 * project-specific integration points so they do not assume that editing one
 * JSON file is enough to add or fix a locale.
 */

import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_SOURCE_EXTENSIONS,
  collectLocaleFiles,
  collectSourceFiles,
  filterIgnoredFiles,
  flattenStringMessages,
  getLineColumn,
  getLocaleName,
  parseCliArgs,
  readLocaleFile,
  relativePath,
  resolveFromCwd,
  splitCsv,
} from "./lib/i18n-audit.mjs";

const INTERESTING_DEPENDENCIES = [
  "react-intl-universal",
  "react-intl-universal-extract",
  "intl-messageformat",
  "moment",
  "dayjs",
];

const CONNECTION_PATTERNS = [
  { name: "react-intl init", pattern: /\bintl\s*\.\s*init\s*\(/ },
  { name: "current locale lookup", pattern: /\bgetCurrentLocale\s*\(/ },
  { name: "locale data map", pattern: /\blocaleData\b/ },
  { name: "dynamic locale import", pattern: /import\s*\(\s*['"`][^'"`]*locales?\// },
  { name: "LOCALE enum", pattern: /\bLOCALE\s*\./ },
  { name: "component locale provider", pattern: /\bConfigProvider\b/ },
  { name: "locale setter", pattern: /\bsetCurrentLocale\s*\(/ },
  { name: "moment locale", pattern: /\bmoment\s*\.\s*locale\s*\(/ },
  { name: "dayjs locale", pattern: /\bdayjs\s*\.\s*locale\s*\(/ },
  { name: "extraction command string", pattern: /react-intl-universal-extract/ },
];

function printHelp() {
  console.log(`Usage:
  node skills/use-react-intl-universal/scripts/discover-project-i18n.mjs --source src --locales src/locales

Options:
  --root PATH          Optional. Repository root. Default: current directory.
  --source PATH        Optional. Source file or directory to scan. Default: src
  --locales PATH       Optional. Directory containing locale JSON files. Default: src/locales
  --expected-locales LIST
                       Optional. Comma-separated locales expected in the locale directory.
  --extensions LIST    Optional. Comma-separated source extensions. Default: .js,.jsx,.ts,.tsx
  --ignore LIST        Optional. Comma-separated path substrings to skip.
  --json               Print machine-readable JSON.
  --help               Show this help.
`);
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

// Find commands in the same places a developer would normally get them:
// local node_modules/.bin first, then PATH. We only check existence, not
// behavior, because running arbitrary project commands can be slow or unsafe.
function commandExists(rootPath, commandName) {
  const localBin = path.join(rootPath, "node_modules", ".bin", commandName);
  if (fs.existsSync(localBin)) {
    return true;
  }

  const pathEntries = String(process.env.PATH || "")
    .split(path.delimiter)
    .filter(Boolean);

  return pathEntries.some((entry) => fs.existsSync(path.join(entry, commandName)));
}

function pickRelevantDependencies(packageJson) {
  const sections = ["dependencies", "devDependencies", "peerDependencies", "resolutions"];
  const result = {};

  for (const section of sections) {
    const deps = packageJson?.[section];
    if (!deps || typeof deps !== "object") {
      continue;
    }

    for (const name of INTERESTING_DEPENDENCIES) {
      if (Object.prototype.hasOwnProperty.call(deps, name)) {
        result[name] ??= {};
        result[name][section] = deps[name];
      }
    }
  }

  return result;
}

function getNodeModulePath(rootPath, packageName) {
  return path.join(rootPath, "node_modules", ...packageName.split("/"));
}

function normalizeLocale(locale) {
  return String(locale).trim().replace(/_/g, "-").toLowerCase();
}

function packageLocaleName(locale, packageName) {
  const normalized = normalizeLocale(locale);

  if (packageName === "moment" || packageName === "dayjs") {
    if (normalized.startsWith("en")) {
      return "en";
    }

    if (normalized.startsWith("ja")) {
      return "ja";
    }

    if (normalized.startsWith("ko")) {
      return "ko";
    }
  }

  return normalized;
}

function checkLocalePackageFileSupport(rootPath, packageName, localeDir, expectedLocales) {
  const packagePath = getNodeModulePath(rootPath, packageName);
  const directoryPath = path.join(packagePath, localeDir);

  if (!fs.existsSync(directoryPath)) {
    return {
      packageName,
      available: false,
      source: null,
      supportedLocales: [],
      expected: expectedLocales.map((locale) => ({
        locale,
        packageLocale: packageLocaleName(locale, packageName),
        supported: null,
      })),
    };
  }

  const files = fs.readdirSync(directoryPath);
  const supportedLocales = [...new Set(files
    .map((fileName) => fileName.replace(/\.(?:js|mjs|cjs|d\.ts|ts)$/, ""))
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const fileSet = new Set(files);

  return {
    packageName,
    available: true,
    source: directoryPath,
    supportedLocales,
    expected: expectedLocales.map((locale) => {
      const packageLocale = packageLocaleName(locale, packageName);
      const supported = packageLocale === "en"
        ? true
        : fileSet.has(`${packageLocale}.js`)
          || fileSet.has(`${packageLocale}.mjs`)
          || fileSet.has(`${packageLocale}.cjs`)
          || fileSet.has(`${packageLocale}.d.ts`);

      return {
        locale,
        packageLocale,
        supported,
      };
    }),
  };
}

function collectLocaleSupportChecks(rootPath, dependencies, expectedLocales) {
  if (expectedLocales.length === 0) {
    return [];
  }

  const checks = [];

  if (dependencies.moment) {
    checks.push(checkLocalePackageFileSupport(rootPath, "moment", "locale", expectedLocales));
  }

  if (dependencies.dayjs) {
    checks.push(checkLocalePackageFileSupport(rootPath, "dayjs", "locale", expectedLocales));
  }

  return checks;
}

function pickRelevantScripts(packageJson) {
  const scripts = packageJson?.scripts;
  if (!scripts || typeof scripts !== "object") {
    return [];
  }

  return Object.entries(scripts)
    .filter(([name, value]) => /(intl|i18n|locale|translate|extract)/i.test(name) || /(intl|i18n|locale|translate|extract)/i.test(String(value)))
    .map(([name, command]) => ({
      name,
      command,
      exportLanguages: extractExportLanguages(command),
    }));
}

function extractExportLanguages(command) {
  const match = /--export-language(?:=|\s+)([^\s]+)/.exec(String(command));
  if (!match) {
    return [];
  }

  return match[1]
    .split(",")
    .map((locale) => locale.trim())
    .filter(Boolean);
}

function summarizeLocaleFiles(localesPath, ignorePatterns) {
  const files = filterIgnoredFiles(collectLocaleFiles(localesPath), ignorePatterns);

  return files.map((filePath) => {
    const localeFile = readLocaleFile(filePath);
    const messageCount = localeFile.parseError
      ? 0
      : Object.keys(flattenStringMessages(localeFile.json)).length;

    return {
      locale: getLocaleName(filePath, localesPath),
      filePath,
      messageCount,
      parseError: localeFile.parseError ? localeFile.parseError.message : null,
    };
  });
}

function collectConnectionPoints(sourcePath, extensions, ignorePatterns) {
  if (!fs.existsSync(sourcePath)) {
    return [];
  }

  const sourceFiles = filterIgnoredFiles(collectSourceFiles(sourcePath, extensions), ignorePatterns);
  const points = [];

  for (const filePath of sourceFiles) {
    const text = fs.readFileSync(filePath, "utf8");

    for (const patternInfo of CONNECTION_PATTERNS) {
      patternInfo.pattern.lastIndex = 0;
      const match = patternInfo.pattern.exec(text);
      if (!match) {
        continue;
      }

      // Report only the first location per pattern per file. That keeps the
      // output useful for navigation instead of dumping every repeated import.
      const location = getLineColumn(text, match.index);
      const lineStart = text.lastIndexOf("\n", match.index) + 1;
      const lineEnd = text.indexOf("\n", match.index);
      const lineText = text.slice(lineStart, lineEnd >= 0 ? lineEnd : text.length).trim();
      const relevance = classifyConnectionPoint(patternInfo.name, text, lineText);
      points.push({
        type: patternInfo.name,
        filePath,
        line: location.line,
        lineText,
        ...relevance,
      });
    }
  }

  return points.sort((a, b) => (
    a.filePath.localeCompare(b.filePath)
    || a.line - b.line
    || a.type.localeCompare(b.type)
  ));
}

function classifyConnectionPoint(type, sourceText, lineText) {
  if (type === "component locale provider") {
    const isImportOnly = /^import\b/.test(lineText)
      && !/<\s*ConfigProvider\b/.test(sourceText);

    if (isImportOnly) {
      return {
        role: "import-only",
        priority: "low",
        taskRelevant: false,
        guidance: "ConfigProvider is imported but no ConfigProvider JSX usage was detected in this file.",
      };
    }

    const hasLocaleProp = /<\s*ConfigProvider[\s\S]{0,300}\blocale\s*=/.test(sourceText);
    return {
      role: hasLocaleProp ? "component-locale-owner" : "component-provider-usage",
      priority: hasLocaleProp ? "high" : "medium",
      taskRelevant: true,
      guidance: hasLocaleProp
        ? "This file passes a locale prop into ConfigProvider and likely owns component-library locale setup."
        : "This file renders ConfigProvider; inspect whether locale is inherited or must be wired here.",
    };
  }

  if (type === "react-intl init" || type === "current locale lookup" || type === "dynamic locale import" || type === "locale setter" || type === "moment locale" || type === "dayjs locale") {
    return {
      role: "runtime-locale-owner",
      priority: "high",
      taskRelevant: true,
      guidance: "This file participates in runtime locale initialization or switching.",
    };
  }

  if (type === "locale data map" || type === "LOCALE enum") {
    return {
      role: "locale-mapping",
      priority: "medium",
      taskRelevant: true,
      guidance: "This file references locale mappings or product locale enums; inspect before adding a language.",
    };
  }

  return {
    role: "i18n-connection",
    priority: "medium",
    taskRelevant: true,
    guidance: "Inspect this i18n connection point before changing locale behavior.",
  };
}

function createRecommendations({
  packageJson,
  localeSummaries,
  scripts,
  commands,
  connectionPoints,
  missingExpectedLocales,
  localeSupportChecks,
}) {
  const recommendations = [];

  if (!packageJson) {
    recommendations.push("No package.json was found. Inspect the project manually before assuming extraction or build commands.");
  }

  if (scripts.length === 0) {
    recommendations.push("No obvious i18n/extraction script was found in package.json. Prefer asking the project owner or reading project docs before running a generic extractor.");
  }

  if (scripts.some((script) => script.exportLanguages.length > 0)) {
    recommendations.push("When adding a locale, update every extraction/export script that declares --export-language.");
  }

  if (!commands["react-intl-universal-extract"]) {
    recommendations.push("No local extraction command was found in node_modules/.bin or PATH. Install dependencies or verify the wrapper command before running extraction.");
  }

  if (localeSummaries.length === 0) {
    recommendations.push("No locale JSON files were found. Confirm the locale pack location before editing translations.");
  }

  if (missingExpectedLocales.length > 0) {
    recommendations.push(`Expected locale files are missing: ${missingExpectedLocales.join(", ")}.`);
  }

  if (connectionPoints.length > 0) {
    recommendations.push("Review locale connection points before adding a new language: intl.init, locale imports, component ConfigProvider, date library locale, and product locale enum mappings.");
  }

  for (const check of localeSupportChecks) {
    if (!check.available) {
      recommendations.push(`Cannot inspect ${check.packageName} locale support because its package files were not found in node_modules.`);
      continue;
    }

    const unsupported = check.expected
      .filter((item) => item.supported === false)
      .map((item) => item.locale);

    if (unsupported.length > 0) {
      const source = check.source ? ` Evidence: ${relativePath(check.source)}.` : "";
      recommendations.push(`${check.packageName} does not expose expected locale(s): ${unsupported.join(", ")}.${source} Runtime language switching may be blocked until this provider/package is upgraded or explicitly wired. Do not treat app locale JSON alone as a completed new-locale implementation.`);
    }
  }

  return recommendations;
}

function printTextReport(report) {
  console.log(`Root: ${relativePath(report.rootPath)}`);
  console.log(`Source: ${relativePath(report.sourcePath)}`);
  console.log(`Locales: ${relativePath(report.localesPath)}`);
  if (report.expectedLocales.length > 0) {
    console.log(`Expected locales: ${report.expectedLocales.join(", ")}`);
  }
  console.log("");

  console.log("Dependencies:");
  const dependencyEntries = Object.entries(report.dependencies);
  if (dependencyEntries.length === 0) {
    console.log("- none detected");
  } else {
    for (const [name, sections] of dependencyEntries) {
      const versions = Object.entries(sections).map(([section, version]) => `${section}=${version}`).join(", ");
      console.log(`- ${name}: ${versions}`);
    }
  }

  console.log("");
  console.log("i18n scripts:");
  if (report.scripts.length === 0) {
    console.log("- none detected");
  } else {
    for (const script of report.scripts) {
      const languages = script.exportLanguages.length > 0 ? ` exportLanguages=${script.exportLanguages.join(",")}` : "";
      console.log(`- ${script.name}: ${script.command}${languages}`);
    }
  }

  console.log("");
  console.log("Commands:");
  for (const [name, exists] of Object.entries(report.commands)) {
    console.log(`- ${name}: ${exists ? "available" : "missing"}`);
  }

  console.log("");
  console.log("Locale files:");
  if (report.localeSummaries.length === 0) {
    console.log("- none detected");
  } else {
    for (const locale of report.localeSummaries) {
      const status = locale.parseError ? `invalid JSON: ${locale.parseError}` : `${locale.messageCount} messages`;
      console.log(`- ${locale.locale}: ${relativePath(locale.filePath)} (${status})`);
    }
  }
  if (report.missingExpectedLocales.length > 0) {
    console.log(`- missing expected locales: ${report.missingExpectedLocales.join(", ")}`);
  }

  if (report.localeSupportChecks.length > 0) {
    console.log("");
    console.log("Locale package support:");
    for (const check of report.localeSupportChecks) {
      console.log(`- ${check.packageName}: ${check.available ? "inspectable" : "unavailable"}`);
      for (const expected of check.expected) {
        const status = expected.supported === null ? "unknown" : expected.supported ? "supported" : "missing";
        console.log(`  - ${expected.locale} (${expected.packageLocale}): ${status}`);
      }
    }
  }

  console.log("");
  console.log("Connection points:");
  for (const point of report.connectionPoints.slice(0, 40)) {
    console.log(`- [${point.type}] ${relativePath(point.filePath)}:${point.line} ${point.lineText}`);
  }
  if (report.connectionPoints.length > 40) {
    console.log(`- ... ${report.connectionPoints.length - 40} more`);
  }
  if (report.connectionPoints.length === 0) {
    console.log("- none detected");
  }

  console.log("");
  console.log("Recommendations:");
  for (const recommendation of report.recommendations) {
    console.log(`- ${recommendation}`);
  }
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const rootPath = args.root ? resolveFromCwd(String(args.root)) : process.cwd();
  const sourcePath = path.resolve(rootPath, String(args.source ?? "src"));
  const localesPath = path.resolve(rootPath, String(args.locales ?? "src/locales"));
  const expectedLocales = splitCsv(args["expected-locales"], []);
  const extensions = splitCsv(args.extensions, DEFAULT_SOURCE_EXTENSIONS);
  const ignorePatterns = splitCsv(args.ignore, []);
  const packageJson = readJsonIfExists(path.join(rootPath, "package.json"));
  const scripts = pickRelevantScripts(packageJson);
  const dependencies = pickRelevantDependencies(packageJson);
  const localeSummaries = fs.existsSync(localesPath)
    ? summarizeLocaleFiles(localesPath, ignorePatterns)
    : [];
  const availableLocales = new Set(localeSummaries.map((locale) => locale.locale));
  const missingExpectedLocales = expectedLocales.filter((locale) => !availableLocales.has(locale));
  const connectionPoints = collectConnectionPoints(sourcePath, extensions, ignorePatterns);
  const commands = {
    "react-intl-universal-extract": commandExists(rootPath, "react-intl-universal-extract"),
  };
  const localeSupportChecks = collectLocaleSupportChecks(rootPath, dependencies, expectedLocales);
  const recommendations = createRecommendations({
    packageJson,
    localeSummaries,
    scripts,
    commands,
    connectionPoints,
    missingExpectedLocales,
    localeSupportChecks,
  });
  const report = {
    rootPath,
    sourcePath,
    localesPath,
    expectedLocales,
    missingExpectedLocales,
    extensions,
    ignorePatterns,
    dependencies,
    scripts,
    commands,
    localeSummaries,
    localeSupportChecks,
    connectionPoints,
    recommendations,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }
}

main();
