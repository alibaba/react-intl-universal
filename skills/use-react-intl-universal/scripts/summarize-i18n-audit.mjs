#!/usr/bin/env node

/*
 * Purpose:
 * Summarize a JSON report produced by audit-i18n-contract.mjs.
 *
 * Full repository audits can produce thousands of advisory warnings. This
 * script turns the raw report into a prioritized work queue: hard errors first,
 * deprecated getHTML and template defaults next, and only the highest-risk
 * length warnings after that.
 */

import fs from "node:fs";
import {
  parseCliArgs,
  relativePath,
  resolveFromCwd,
} from "./lib/i18n-audit.mjs";

const DEFAULT_MAX_PER_TYPE = 12;
const TYPE_ORDER = [
  "invalid-json",
  "conflicting-default-message",
  "missing-locale-key",
  "locale-contract-mismatch",
  "non-string-locale-message",
  "duplicate-locale-key",
  "deprecated-getHTML",
  "template-default-message",
  "long-translation",
  "unknown-default-locale",
];

function printHelp() {
  console.log(`Usage:
  node skills/use-react-intl-universal/scripts/summarize-i18n-audit.mjs --report tmp/i18n-audit.json

Options:
  --report PATH        Required. JSON report produced by audit-i18n-contract.mjs --json.
  --max-per-type N     Optional. Number of examples to print for each type. Default: 12.
  --json               Print machine-readable JSON.
  --help               Show this help.
`);
}

function getLocation(item) {
  if (!item.filePath) {
    return "-";
  }

  return `${relativePath(item.filePath)}${item.line ? `:${item.line}` : ""}`;
}

function groupByType(items) {
  const grouped = new Map();

  for (const item of items) {
    const group = grouped.get(item.type) ?? [];
    group.push(item);
    grouped.set(item.type, group);
  }

  return grouped;
}

function sortItems(type, items) {
  if (type === "long-translation") {
    // For layout risk, show high severity and high UI-risk candidates first.
    return [...items].sort((a, b) => {
      const aRisk = a.lengthRisk ?? {};
      const bRisk = b.lengthRisk ?? {};
      const severityRank = { high: 0, medium: 1, low: 2 };
      const uiRank = { high: 0, medium: 1, low: 2 };
      return (
        (severityRank[aRisk.severity] ?? 3) - (severityRank[bRisk.severity] ?? 3)
        || (uiRank[aRisk.uiRisk] ?? 3) - (uiRank[bRisk.uiRisk] ?? 3)
        || (bRisk.ratio ?? 0) - (aRisk.ratio ?? 0)
        || String(a.key ?? "").localeCompare(String(b.key ?? ""))
      );
    });
  }

  return [...items].sort((a, b) => (
    String(a.key ?? "").localeCompare(String(b.key ?? ""))
    || getLocation(a).localeCompare(getLocation(b))
  ));
}

function createExample(type, item) {
  const example = {
    type,
    key: item.key ?? null,
    locale: item.locale ?? null,
    location: getLocation(item),
    message: item.message,
  };

  if (type === "long-translation" && item.lengthRisk) {
    example.lengthRisk = {
      severity: item.lengthRisk.severity,
      uiRisk: item.lengthRisk.uiRisk,
      ratio: item.lengthRisk.ratio,
      extraWidth: item.lengthRisk.extraWidth,
      visualIntegrityRisk: item.lengthRisk.visualIntegrityRisk ?? null,
      defaultMessage: item.lengthRisk.defaultMessage,
      translatedMessage: item.lengthRisk.translatedMessage,
    };
    if (item.source) {
      example.source = item.source;
    }
  }

  if (type === "template-default-message") {
    example.lineText = item.lineText;
    example.callText = item.callText;
    example.transformedDefaultMessage = item.transformedDefaultMessage;
  }

  return example;
}

function createSummary(report, maxPerType) {
  const allItems = [...(report.issues ?? []), ...(report.warnings ?? [])];
  const grouped = groupByType(allItems);
  const typeNames = [
    ...TYPE_ORDER.filter((type) => grouped.has(type)),
    ...[...grouped.keys()].filter((type) => !TYPE_ORDER.includes(type)).sort((a, b) => a.localeCompare(b)),
  ];
  const groups = typeNames.map((type) => {
    const items = sortItems(type, grouped.get(type));
    return {
      type,
      count: items.length,
      examples: items.slice(0, maxPerType).map((item) => createExample(type, item)),
    };
  });

  return {
    sourcePath: report.sourcePath,
    localesPath: report.localesPath,
    defaultLocale: report.defaultLocale,
    messageCount: report.messageCount,
    issueCount: report.issues?.length ?? 0,
    warningCount: report.warnings?.length ?? 0,
    groups,
    recommendedOrder: [
      "Fix conflicting-default-message first; one key must not have multiple source defaults.",
      "Fix locale-contract-mismatch and missing-locale-key before translating new content.",
      "Migrate new or high-value getHTML usage to rich tag formatters with intl.get.",
      "Replace JavaScript template strings in .d() with ICU placeholders when the dynamic value is translatable.",
      "Review only high severity static UI-fit long-translation warnings in compact UI first; do not mechanically shorten every paragraph.",
    ],
  };
}

function printTextReport(summary) {
  console.log(`Source: ${summary.sourcePath ? relativePath(summary.sourcePath) : "-"}`);
  console.log(`Locales: ${summary.localesPath ? relativePath(summary.localesPath) : "-"}`);
  console.log(`Default locale: ${summary.defaultLocale ?? "unknown"}`);
  console.log(`Messages: ${summary.messageCount ?? 0}`);
  console.log(`Issues: ${summary.issueCount}`);
  console.log(`Warnings: ${summary.warningCount}`);
  console.log("");

  console.log("Recommended order:");
  for (const item of summary.recommendedOrder) {
    console.log(`- ${item}`);
  }

  console.log("");
  console.log("Groups:");
  for (const group of summary.groups) {
    console.log("");
    console.log(`## ${group.type} (${group.count})`);
    for (const example of group.examples) {
      const prefix = [example.location, example.locale, example.key].filter(Boolean).join(" ");
      console.log(`- ${prefix} ${example.message}`);
      if (example.lengthRisk) {
        console.log(`  default=${JSON.stringify(example.lengthRisk.defaultMessage)} translated=${JSON.stringify(example.lengthRisk.translatedMessage)} ratio=${example.lengthRisk.ratio} severity=${example.lengthRisk.severity} uiRisk=${example.lengthRisk.uiRisk}`);
        if (example.source) {
          console.log(`  source=${example.source.filePath}:${example.source.line} ${example.source.lineText}`);
          if (example.source.callText && example.source.callText !== example.source.lineText) {
            console.log(`  call=${example.source.callText}`);
          }
        }
      }
      if (example.lineText) {
        console.log(`  line=${example.lineText}`);
        if (example.callText && example.callText !== example.lineText) {
          console.log(`  call=${example.callText}`);
        }
        console.log(`  ICU=${JSON.stringify(example.transformedDefaultMessage)}`);
      }
    }
  }
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.report) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const reportPath = resolveFromCwd(String(args.report));
  const maxPerType = args["max-per-type"] ? Number(args["max-per-type"]) : DEFAULT_MAX_PER_TYPE;
  let report;

  try {
    report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch (error) {
    console.error(`Cannot read audit report: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const summary = createSummary(report, Number.isFinite(maxPerType) ? maxPerType : DEFAULT_MAX_PER_TYPE);

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printTextReport(summary);
  }
}

main();
