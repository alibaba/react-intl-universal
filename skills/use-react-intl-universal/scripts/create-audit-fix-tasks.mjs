#!/usr/bin/env node

/*
 * Purpose:
 * Turn audit-i18n-contract.mjs blockers or selected advisory warnings into
 * focused fix task files.
 *
 * Handoff reports say whether the i18n work is blocked. This script creates
 * the next actionable layer: grouped tasks for conflicting source defaults,
 * missing locale keys, locale contract mismatches, and optionally selected
 * advisory warnings such as JavaScript template interpolation inside .d(),
 * deprecated getHTML usage, or translations with static UI-fit risk in compact UI.
 * Agents can then work on one task file at a time instead of reading a large
 * audit JSON by hand.
 */

import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_SOURCE_EXTENSIONS,
  findLocation,
  formatList,
  getMessageContract,
  getMessageValue,
  loadLocaleData,
  loadSourceMessages,
  parseCliArgs,
  relativePath,
  resolveFromCwd,
  splitCsv,
  writeJsonFile,
} from "./lib/i18n-audit.mjs";

const HARD_BLOCKER_TYPES = new Set([
  "invalid-json",
  "conflicting-default-message",
  "missing-locale-key",
  "locale-contract-mismatch",
  "non-string-locale-message",
]);

const TYPE_ORDER = [
  "invalid-json",
  "conflicting-default-message",
  "locale-contract-mismatch",
  "missing-locale-key",
  "non-string-locale-message",
  "template-default-message",
  "deprecated-getHTML",
  "long-translation",
];

const SUPPORTED_WARNING_TYPES = new Set([
  "template-default-message",
  "deprecated-getHTML",
  "long-translation",
]);

const SEVERITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

function printHelp() {
  console.log(`Usage:
  node skills/use-react-intl-universal/scripts/create-audit-fix-tasks.mjs --audit tmp/i18n-audit.json --output tmp/i18n-audit-fix-tasks

Options:
  --audit PATH              Required. JSON report from audit-i18n-contract.mjs --json.
  --output PATH             Optional. Output directory. Default: tmp/i18n-audit-fix-tasks
  --source PATH             Optional. Source path used to include .d() defaults and source lines.
  --locales PATH            Optional. Locale directory used to include current locale values.
  --default-locale LOCALE   Optional. Default/source locale name for locale value context.
  --extensions LIST         Optional. Comma-separated source extensions. Default: .js,.jsx,.ts,.tsx
  --ignore LIST             Optional. Comma-separated path substrings to skip.
  --include-warnings LIST   Optional. Comma-separated advisory warning types to convert into tasks.
                            Supported: template-default-message,deprecated-getHTML,long-translation.
  --warning-severity LIST   Optional. Comma-separated severities for long-translation tasks.
                            Example: high,medium. Default: all severities.
  --warnings-only           Optional. Generate only selected warning task types, without hard blocker tasks.
  --max-items-per-task N    Optional. Split each blocker type into batch files with at most N items. Default: 50.
  --json                    Print machine-readable manifest JSON.
  --help                    Show this help.
`);
}

function readAuditReport(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read audit report: ${error.message}`);
  }
}

function countBy(items, keyFn) {
  const counts = {};

  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
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

function parseMissingKeySourceLocation(message) {
  const match = / from (.+):(\d+)$/.exec(String(message));
  if (!match) {
    return null;
  }

  return {
    filePath: match[1],
    line: Number(match[2]),
  };
}

function parseConflictLocations(message) {
  const match = /messages:\s*(.+)$/.exec(String(message));
  if (!match) {
    return [];
  }

  return match[1]
    .split(",")
    .map((value) => value.trim())
    .map((location) => {
      const locationMatch = /^(.+):(\d+)$/.exec(location);
      return locationMatch
        ? { filePath: locationMatch[1], line: Number(locationMatch[2]) }
        : { filePath: location, line: null };
    });
}

function normalizeFilePath(filePath) {
  return filePath ? relativePath(filePath) : null;
}

function createSourceMessageIndex(sourceMessages) {
  const byKey = new Map();

  for (const message of sourceMessages) {
    const group = byKey.get(message.key) ?? [];
    group.push(message);
    byKey.set(message.key, group);
  }

  return byKey;
}

function createLocaleIndex(localeData) {
  return new Map(localeData.map((item) => [item.locale, item]));
}

function getSourceContext(key, context) {
  const messages = context.sourceByKey?.get(key) ?? [];
  if (messages.length === 0) {
    return null;
  }

  const uniqueDefaults = [...new Set(messages.map((message) => message.transformedDefaultMessage))];
  return {
    defaultMessage: uniqueDefaults.length === 1 ? uniqueDefaults[0] : null,
    defaultMessages: uniqueDefaults,
    variables: uniqueDefaults.length === 1 ? getMessageContract(uniqueDefaults[0]).variables : [],
    richTags: uniqueDefaults.length === 1 ? getMessageContract(uniqueDefaults[0]).tags : [],
    occurrences: messages.map((message) => ({
      filePath: relativePath(message.filePath),
      line: message.line,
      lineText: message.lineText,
      callText: message.callText,
      contextSnippet: message.contextSnippet,
    })),
  };
}

function extractPassedValueVariables(text) {
  const match = /(?:intl|IntlUtils)\s*\.\s*(?:getHTML|get)\s*\(\s*(['"`])[\w.-]+\1\s*,\s*\{([\s\S]*?)\}\s*\)/m.exec(String(text ?? ""));
  if (!match) {
    return [];
  }

  const body = match[2];
  const variables = new Set();
  const pattern = /(?:^|,)\s*([A-Za-z_$][\w$]*)\s*(?=,|:|$)/g;
  let variableMatch;

  while ((variableMatch = pattern.exec(body)) !== null) {
    variables.add(variableMatch[1]);
  }

  return [...variables].sort((a, b) => a.localeCompare(b));
}

function getMissingValueVariables(defaultMessage, source) {
  const expected = getMessageContract(defaultMessage).variables;
  if (expected.length === 0) {
    return [];
  }

  const valueVariables = new Set();
  for (const occurrence of source?.occurrences ?? []) {
    for (const variable of extractPassedValueVariables(occurrence.contextSnippet ?? occurrence.lineText)) {
      valueVariables.add(variable);
    }
  }

  return expected.filter((variable) => !valueVariables.has(variable));
}

function getLocaleValueContext(key, locale, context) {
  const localeInfo = context.localeByName?.get(locale);
  if (!localeInfo || localeInfo.localeFile.parseError) {
    return null;
  }

  const valueInfo = getMessageValue(localeInfo.localeFile.json, key);
  if (!valueInfo.exists) {
    return {
      locale,
      exists: false,
      value: null,
      line: null,
      variables: [],
      richTags: [],
    };
  }

  const location = findLocation(localeInfo.localeFile.propertyLocations, valueInfo.pathSegments);
  const contract = getMessageContract(valueInfo.value);
  return {
    locale,
    exists: true,
    value: valueInfo.value,
    line: location?.line ?? null,
    variables: contract.variables,
    richTags: contract.tags,
  };
}

function getLocaleValuesForKey(key, locales, context) {
  return locales
    .map((locale) => getLocaleValueContext(key, locale, context))
    .filter(Boolean);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createVariableReplacementPairs(expectedVariables, actualVariables) {
  const expectedSet = new Set(expectedVariables);
  const actualSet = new Set(actualVariables);
  const missing = expectedVariables.filter((variable) => !actualSet.has(variable));
  const extra = actualVariables.filter((variable) => !expectedSet.has(variable));

  if (missing.length === 0 || missing.length !== extra.length) {
    return [];
  }

  if (missing.length === 1) {
    return [{ from: extra[0], to: missing[0] }];
  }

  const missingByLowerCase = new Map(missing.map((variable) => [variable.toLowerCase(), variable]));
  const pairs = [];

  for (const variable of extra) {
    const replacement = missingByLowerCase.get(variable.toLowerCase());
    if (!replacement) {
      return [];
    }
    pairs.push({ from: variable, to: replacement });
  }

  return pairs;
}

function createContractPreservingLocaleValue(source, currentLocaleValue) {
  if (!source?.defaultMessage || !currentLocaleValue?.exists || typeof currentLocaleValue.value !== "string") {
    return null;
  }

  if (source.richTags.length !== currentLocaleValue.richTags.length) {
    return null;
  }

  const pairs = createVariableReplacementPairs(source.variables, currentLocaleValue.variables);
  if (pairs.length === 0) {
    return null;
  }

  let value = currentLocaleValue.value;
  for (const pair of pairs) {
    value = value.replace(new RegExp(`\\$?\\{\\s*${escapeRegExp(pair.from)}(?=\\s*[,}])`, "g"), `{${pair.to}`);
  }

  return value === currentLocaleValue.value ? null : value;
}

function getSourceDefaultMessageForMissingKey(item, context) {
  if (item.source?.defaultMessage != null) {
    return item.source.defaultMessage;
  }

  if (!context.defaultLocale) {
    return null;
  }

  const defaultLocaleValue = getLocaleValueContext(item.key, context.defaultLocale, context);
  return defaultLocaleValue?.exists && typeof defaultLocaleValue.value === "string"
    ? defaultLocaleValue.value
    : null;
}

function createMissingLocaleSuggestions(item, context) {
  const sourceDefaultMessage = getSourceDefaultMessageForMissingKey(item, context);

  return item.missingLocales.map((locale) => {
    if (locale === context.defaultLocale && sourceDefaultMessage != null) {
      return {
        locale,
        suggestedValue: sourceDefaultMessage,
        needsTranslation: false,
        sourceDefaultMessage,
        reason: "Default locale is missing this key; use the .d() source message.",
      };
    }

    return {
      locale,
      suggestedValue: null,
      needsTranslation: true,
      sourceDefaultMessage,
      reason: "Translate the business meaning from the default/source message and source context; do not copy words blindly.",
    };
  });
}

function groupMissingLocaleKeys(issues, context) {
  const byKey = new Map();

  for (const issue of issues) {
    const item = byKey.get(issue.key) ?? {
      type: "missing-locale-key",
      key: issue.key,
      missingLocales: [],
      sourceLocation: parseMissingKeySourceLocation(issue.message),
      source: getSourceContext(issue.key, context),
      messages: [],
    };

    item.missingLocales.push(issue.locale);
    item.messages.push(issue.message);
    byKey.set(issue.key, item);
  }

  return [...byKey.values()].map((item) => {
    const enrichedItem = {
      ...item,
      existingLocaleValues: getLocaleValuesForKey(
        item.key,
        context.localeNames.filter((locale) => !item.missingLocales.includes(locale)),
        context
      ),
    };

    return {
      ...enrichedItem,
      suggestedMissingLocaleValues: createMissingLocaleSuggestions(enrichedItem, context),
    };
  }).sort((a, b) => a.key.localeCompare(b.key));
}

function createTemplateDefaultItems(warnings, context) {
  return warnings.map((warning) => {
    const source = warning.key ? getSourceContext(warning.key, context) : null;
    const transformedDefaultMessage = warning.transformedDefaultMessage ?? null;
    return {
      type: warning.type,
      key: warning.key ?? null,
      filePath: normalizeFilePath(warning.filePath),
      line: warning.line ?? null,
      lineText: warning.lineText ?? null,
      callText: warning.callText ?? null,
      transformedDefaultMessage,
      source,
      missingValueVariables: getMissingValueVariables(transformedDefaultMessage, source),
      existingLocaleValues: warning.key
        ? getLocaleValuesForKey(warning.key, context.localeNames, context)
        : [],
      message: warning.message,
    };
  }).sort((a, b) => (
    String(a.filePath ?? "").localeCompare(String(b.filePath ?? ""))
    || (a.line ?? 0) - (b.line ?? 0)
    || String(a.key ?? "").localeCompare(String(b.key ?? ""))
  ));
}

function normalizeWarningSource(source) {
  if (!source) {
    return null;
  }

  return {
    filePath: source.filePath ? relativePath(source.filePath) : null,
    line: source.line ?? null,
    lineText: source.lineText ?? null,
    callText: source.callText ?? null,
  };
}

function readSourceLine(filePath, line) {
  if (!filePath || !line || !fs.existsSync(filePath)) {
    return null;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  return lines[line - 1] ?? null;
}

function createDeprecatedGetHTMLItems(warnings) {
  return warnings.map((warning) => ({
    type: warning.type,
    filePath: normalizeFilePath(warning.filePath),
    line: warning.line ?? null,
    lineText: warning.lineText ?? readSourceLine(warning.filePath, warning.line),
    message: warning.message,
    migrationTarget: "intl.get(..., richTagFormatters).d(defaultMessage)",
  })).sort((a, b) => (
    String(a.filePath ?? "").localeCompare(String(b.filePath ?? ""))
    || (a.line ?? Number.MAX_SAFE_INTEGER) - (b.line ?? Number.MAX_SAFE_INTEGER)
  ));
}

function createLongTranslationItems(warnings, context, severityFilter = []) {
  const severities = new Set(severityFilter.map((value) => value.toLowerCase()));

  return warnings
    .filter((warning) => (
      severities.size === 0
      || severities.has(String(warning.lengthRisk?.severity ?? "").toLowerCase())
    ))
    .map((warning) => ({
      type: warning.type,
      key: warning.key ?? null,
      locale: warning.locale ?? null,
      filePath: normalizeFilePath(warning.filePath),
      line: warning.line ?? null,
      lengthRisk: warning.lengthRisk ?? null,
      defaultMessage: warning.lengthRisk?.defaultMessage ?? null,
      translatedMessage: warning.lengthRisk?.translatedMessage ?? null,
      sourceOccurrence: normalizeWarningSource(warning.source),
      existingLocaleValues: warning.key
        ? getLocaleValuesForKey(warning.key, context.localeNames, context)
        : [],
      message: warning.message,
    }))
    .sort((a, b) => (
      (SEVERITY_ORDER[a.lengthRisk?.severity] ?? 99) - (SEVERITY_ORDER[b.lengthRisk?.severity] ?? 99)
      || (SEVERITY_ORDER[a.lengthRisk?.uiRisk] ?? 99) - (SEVERITY_ORDER[b.lengthRisk?.uiRisk] ?? 99)
      || (b.lengthRisk?.ratio ?? 0) - (a.lengthRisk?.ratio ?? 0)
      || String(a.locale ?? "").localeCompare(String(b.locale ?? ""))
      || String(a.filePath ?? "").localeCompare(String(b.filePath ?? ""))
      || String(a.key ?? "").localeCompare(String(b.key ?? ""))
    ));
}

function createTaskItems(report, context, includeWarningTypes = [], warningSeverities = [], { warningsOnly = false } = {}) {
  const issues = report.issues ?? [];
  const warnings = report.warnings ?? [];
  const hardBlockers = issues.filter((issue) => HARD_BLOCKER_TYPES.has(issue.type));
  const includedWarnings = new Set(includeWarningTypes.filter((type) => SUPPORTED_WARNING_TYPES.has(type)));
  const byType = new Map();

  if (!warningsOnly) {
    for (const issue of hardBlockers) {
      const group = byType.get(issue.type) ?? [];
      group.push(issue);
      byType.set(issue.type, group);
    }
  }

  const result = new Map();

  if (byType.has("missing-locale-key")) {
    result.set("missing-locale-key", groupMissingLocaleKeys(byType.get("missing-locale-key"), context));
  }

  for (const [type, issuesForType] of byType) {
    if (type === "missing-locale-key") {
      continue;
    }

    const items = issuesForType.map((issue) => {
      const source = issue.key ? getSourceContext(issue.key, context) : null;
      const currentLocaleValue = issue.key && issue.locale
        ? getLocaleValueContext(issue.key, issue.locale, context)
        : null;

      return {
        type: issue.type,
        key: issue.key ?? null,
        locale: issue.locale ?? null,
        filePath: normalizeFilePath(issue.filePath),
        line: issue.line ?? null,
        source,
        currentLocaleValue,
        suggestedLocaleValue: issue.type === "locale-contract-mismatch"
          ? createContractPreservingLocaleValue(source, currentLocaleValue)
          : null,
        sourceLocations: issue.type === "conflicting-default-message"
          ? parseConflictLocations(issue.message)
          : [],
        message: issue.message,
      };
    }).sort((a, b) => (
      String(a.locale ?? "").localeCompare(String(b.locale ?? ""))
      || String(a.filePath ?? "").localeCompare(String(b.filePath ?? ""))
      || String(a.key ?? "").localeCompare(String(b.key ?? ""))
    ));

    result.set(type, items);
  }

  if (includedWarnings.has("template-default-message")) {
    const templateWarnings = warnings.filter((warning) => warning.type === "template-default-message");
    if (templateWarnings.length > 0) {
      result.set("template-default-message", createTemplateDefaultItems(templateWarnings, context));
    }
  }

  if (includedWarnings.has("deprecated-getHTML")) {
    const deprecatedGetHTMLWarnings = warnings.filter((warning) => warning.type === "deprecated-getHTML");
    if (deprecatedGetHTMLWarnings.length > 0) {
      result.set("deprecated-getHTML", createDeprecatedGetHTMLItems(deprecatedGetHTMLWarnings));
    }
  }

  if (includedWarnings.has("long-translation")) {
    const longTranslationWarnings = warnings.filter((warning) => warning.type === "long-translation");
    const items = createLongTranslationItems(longTranslationWarnings, context, warningSeverities);
    if (items.length > 0) {
      result.set("long-translation", items);
    }
  }

  return result;
}

function getTaskItemCoveredIssueCount(type, item) {
  if (type === "missing-locale-key") {
    return item.missingLocales?.length ?? 1;
  }

  return 1;
}

function createCoverageSummary(report, itemsByType) {
  const issueCounts = countBy(report.issues ?? [], (issue) => issue.type);
  const warningCounts = countBy(report.warnings ?? [], (warning) => warning.type);
  const typeCoverage = {};

  for (const [type, items] of itemsByType.entries()) {
    const isHardBlocker = HARD_BLOCKER_TYPES.has(type);
    const sourceCount = isHardBlocker
      ? issueCounts[type] ?? 0
      : warningCounts[type] ?? 0;
    const coveredCount = items.reduce((count, item) => (
      count + getTaskItemCoveredIssueCount(type, item)
    ), 0);

    typeCoverage[type] = {
      sourceCount,
      taskItemCount: items.length,
      coveredCount,
      grouped: coveredCount !== items.length,
      coverageComplete: sourceCount === 0 ? true : coveredCount >= sourceCount,
    };
  }

  const hardBlockerIssueCount = Object.entries(issueCounts)
    .filter(([type]) => HARD_BLOCKER_TYPES.has(type))
    .reduce((count, [, value]) => count + value, 0);
  const hardBlockerCoveredIssueCount = Object.entries(typeCoverage)
    .filter(([type]) => HARD_BLOCKER_TYPES.has(type))
    .reduce((count, [, coverage]) => count + coverage.coveredCount, 0);

  return {
    issueCounts,
    warningCounts,
    hardBlockerIssueCount,
    hardBlockerCoveredIssueCount,
    hardBlockerCoverageComplete: hardBlockerCoveredIssueCount >= hardBlockerIssueCount,
    typeCoverage,
  };
}

function getInstructions(type) {
  switch (type) {
    case "conflicting-default-message":
      return [
        "One intl key has multiple .d(defaultMessage) values.",
        "Choose one source of truth for the key. If the messages are semantically different, split them into separate keys.",
        "Before creating a new key, search for existing sibling keys such as _simple, _label, _title, or _tip that already represent the needed shorter or more specific meaning.",
        "After editing source, rerun the project extraction command and audit again.",
      ];
    case "locale-contract-mismatch":
      return [
        "Locale message variables or rich tags differ from the source .d() contract.",
        "Preserve translated words when possible, but make every ICU variable and rich tag exactly match the default message.",
        "Use Suggested locale value as a starting point when present; review it before applying because only the message contract is automated.",
        "Run audit-locale-key.mjs for changed keys, then rerun the full audit.",
      ];
    case "missing-locale-key":
      return [
        "The source .d() key is missing from one or more locale files.",
        "Prefer running the project's extraction/export command to regenerate the default locale and sync missing translated keys.",
        "If the default locale is missing the key, use the .d() default message as the default-locale value.",
        "For translated locales, understand the source file, product flow, and business meaning before writing natural target-language copy; do not translate word by word.",
        "If editing manually, add the key to every listed locale and preserve the source message contract.",
      ];
    case "invalid-json":
      return [
        "A locale JSON file cannot be parsed.",
        "Fix JSON syntax before any other locale task; other checks may be unreliable until this is resolved.",
      ];
    case "non-string-locale-message":
      return [
        "react-intl-universal messages should resolve to strings in locale JSON.",
        "Convert the locale value to a string or update the source pattern if the key is not a translatable message.",
      ];
    case "template-default-message":
      return [
        ".d(defaultMessage) uses JavaScript template interpolation.",
        "Rewrite the source .d() string to ICU placeholders such as {count}, matching the existing values passed to intl.get().",
        "Keep the default-locale wording unchanged except for replacing JavaScript interpolation with ICU placeholders.",
        "After editing source, run audit-locale-key.mjs for the key and rerun audit-i18n-contract.mjs.",
      ];
    case "deprecated-getHTML":
      return [
        "intl.getHTML is deprecated for React UI.",
        "Prefer rich tag formatters with intl.get(KEY, valuesWithRichTagFormatters).d(DEFAULT_MESSAGE) so links, badges, and components stay in React code instead of HTML strings.",
        "Keep the full sentence in one message and use rich tags such as <link>...</link> where React elements belong.",
        "If the call is legacy non-React HTML-string plumbing, document why it remains instead of migrating blindly.",
        "After editing source, rerun audit-i18n-contract.mjs and any focused UI smoke check that renders the message.",
      ];
    case "long-translation":
      return [
        "A translated locale message has a static UI-fit length warning for compact UI.",
        "Inspect the reported source usage before changing text. The warning is a review queue, not proof that the translation is wrong or the browser layout is broken.",
        "For buttons, labels, tabs, placeholders, table headers, badges, and status chips, prefer concise natural target-language wording only when meaning is preserved.",
        "For tabs, segmented controls, button groups, chip groups, pagination, filter groups, and table action groups, verify component visual integrity; no-overflow metrics alone do not prove joined borders, radius, active state, or icon/text/arrow relationships remain correct.",
        "For paragraphs, help text, documentation, or messages in flexible containers, keep accurate natural wording unless the actual UI overflows.",
        "If wording cannot be shortened without losing meaning, consider whether nearby CSS should preserve grouped-control boundaries, use explicit grid/vertical styles, allow the whole group to move, or use responsive layout.",
        "Do not change the default locale just to satisfy a length ratio.",
      ];
    default:
      return [
        "Fix the reported audit blocker, then rerun audit-i18n-contract.mjs.",
      ];
  }
}

function createTaskMarkdown(task) {
  const lines = [
    `# Audit fix task: ${task.type}${task.batchCount > 1 ? ` (${task.batchIndex + 1}/${task.batchCount})` : ""}`,
    "",
    `Items in this batch: ${task.itemCount}`,
    `Total items for this type: ${task.totalTypeItemCount}`,
    "",
    "Instructions:",
  ];

  for (const instruction of task.instructions) {
    lines.push(`- ${instruction}`);
  }

  lines.push("");
  lines.push("Items:");

  for (const item of task.items) {
    lines.push("");
    lines.push(`## ${item.key ?? item.filePath ?? item.type}`);
    if (item.locale) {
      lines.push(`Locale: ${item.locale}`);
    }
    if (item.filePath) {
      lines.push(`File: ${item.filePath}${item.line ? `:${item.line}` : ""}`);
    }
    if (item.sourceLocation) {
      lines.push(`Source: ${item.sourceLocation.filePath}:${item.sourceLocation.line}`);
    }
    if (item.sourceLocations?.length > 0) {
      lines.push(`Source locations: ${item.sourceLocations.map((location) => `${location.filePath}${location.line ? `:${location.line}` : ""}`).join(", ")}`);
    }
    if (item.lineText) {
      lines.push(`Source line: ${item.lineText}`);
    }
    if (item.callText && item.callText !== item.lineText) {
      lines.push(`Source call: ${item.callText}`);
    }
    if (item.transformedDefaultMessage) {
      lines.push(`Suggested ICU default: ${JSON.stringify(item.transformedDefaultMessage)}`);
    }
    if (item.migrationTarget) {
      lines.push(`Migration target: ${item.migrationTarget}`);
    }
    if (item.lengthRisk) {
      lines.push(`Length risk: severity=${item.lengthRisk.severity}, uiRisk=${item.lengthRisk.uiRisk}, ratio=${item.lengthRisk.ratio}, defaultWidth=${item.lengthRisk.defaultWidth}, translatedWidth=${item.lengthRisk.translatedWidth}`);
      if (item.lengthRisk.visualIntegrityRisk) {
        lines.push(`Component visual-integrity risk: ${item.lengthRisk.visualIntegrityRisk.message}`);
      }
      lines.push(`Default message: ${JSON.stringify(item.defaultMessage)}`);
      lines.push(`Current ${item.locale} translation: ${JSON.stringify(item.translatedMessage)}`);
    }
    if (item.sourceOccurrence) {
      lines.push(`Source: ${item.sourceOccurrence.filePath}:${item.sourceOccurrence.line}`);
      lines.push(`Source line: ${item.sourceOccurrence.lineText}`);
      if (item.sourceOccurrence.callText && item.sourceOccurrence.callText !== item.sourceOccurrence.lineText) {
        lines.push(`Source call: ${item.sourceOccurrence.callText}`);
      }
    }
    if (item.missingValueVariables?.length > 0) {
      lines.push(`Missing intl.get values: ${item.missingValueVariables.join(", ")}`);
      lines.push("Note: add these variables to the intl.get values object while migrating the .d() string.");
    }
    if (item.missingLocales) {
      lines.push(`Missing locales: ${item.missingLocales.join(", ")}`);
    }
    if (item.suggestedMissingLocaleValues?.length > 0) {
      lines.push("Suggested missing locale values:");
      for (const suggestion of item.suggestedMissingLocaleValues) {
        const value = suggestion.suggestedValue == null
          ? `needs translation from ${JSON.stringify(suggestion.sourceDefaultMessage)}`
          : JSON.stringify(suggestion.suggestedValue);
        lines.push(`- ${suggestion.locale}: ${value} (${suggestion.reason})`);
      }
    }
    if (item.source?.defaultMessage != null) {
      lines.push(`Default message: ${JSON.stringify(item.source.defaultMessage)}`);
      lines.push(`Variables: ${formatList(item.source.variables)}`);
      lines.push(`Rich tags: ${formatList(item.source.richTags)}`);
    } else if (item.source?.defaultMessages?.length > 1) {
      lines.push(`Default messages: ${item.source.defaultMessages.map((value) => JSON.stringify(value)).join(" | ")}`);
    }
    if (item.currentLocaleValue?.exists) {
      lines.push(`Current ${item.currentLocaleValue.locale} value: ${JSON.stringify(item.currentLocaleValue.value)}`);
      lines.push(`Current variables: ${formatList(item.currentLocaleValue.variables)}`);
      lines.push(`Current rich tags: ${formatList(item.currentLocaleValue.richTags)}`);
    }
    if (item.suggestedLocaleValue) {
      lines.push(`Suggested locale value: ${JSON.stringify(item.suggestedLocaleValue)}`);
    }
    if (item.existingLocaleValues?.length > 0) {
      lines.push("Existing locale values:");
      for (const localeValue of item.existingLocaleValues) {
        lines.push(`- ${localeValue.locale}: ${JSON.stringify(localeValue.value)}`);
      }
    }
    if (item.source?.occurrences?.length > 0) {
      lines.push("Source occurrences:");
      for (const occurrence of item.source.occurrences.slice(0, 5)) {
        lines.push(`- ${occurrence.filePath}:${occurrence.line} ${occurrence.callText || occurrence.lineText}`);
      }
    }
    lines.push(`Message: ${item.message ?? item.messages?.[0] ?? "-"}`);
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

  if (!args.audit) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const auditPath = resolveFromCwd(String(args.audit));
  const outputPath = resolveFromCwd(String(args.output ?? "tmp/i18n-audit-fix-tasks"));
  const maxItemsPerTask = args["max-items-per-task"] ? Number(args["max-items-per-task"]) : 50;
  const ignorePatterns = splitCsv(args.ignore, []);
  const includeWarningTypes = splitCsv(args["include-warnings"], []);
  const warningSeverities = splitCsv(args["warning-severity"], []).map((value) => value.toLowerCase());
  const warningsOnly = Boolean(args["warnings-only"]);
  const extensions = splitCsv(args.extensions, DEFAULT_SOURCE_EXTENSIONS);
  let report;

  try {
    report = readAuditReport(auditPath);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }

  fs.mkdirSync(outputPath, { recursive: true });
  const sourceMessages = args.source
    ? loadSourceMessages(resolveFromCwd(String(args.source)), extensions, ignorePatterns).sourceMessages
    : [];
  const localeData = args.locales
    ? loadLocaleData(resolveFromCwd(String(args.locales)), ignorePatterns)
    : [];
  const context = {
    sourceByKey: createSourceMessageIndex(sourceMessages),
    localeByName: createLocaleIndex(localeData),
    localeNames: localeData.map((item) => item.locale),
    defaultLocale: args["default-locale"] ? String(args["default-locale"]) : null,
  };
  const itemsByType = createTaskItems(report, context, includeWarningTypes, warningSeverities, { warningsOnly });
  const coverage = createCoverageSummary(report, itemsByType);
  const taskFiles = [];

  for (const type of TYPE_ORDER) {
    const items = itemsByType.get(type) ?? [];
    if (items.length === 0) {
      continue;
    }

    const batches = chunkItems(items, maxItemsPerTask);
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batchItems = batches[batchIndex];
      const batchCount = batches.length;
      const suffix = getBatchSuffix(batchIndex, batchCount);
      const task = {
        type,
        auditPath: relativePath(auditPath),
        batchIndex,
        batchCount,
        itemCount: batchItems.length,
        totalTypeItemCount: items.length,
        instructions: getInstructions(type),
        items: batchItems,
      };
      const jsonPath = path.join(outputPath, `${type}${suffix}.json`);
      const mdPath = path.join(outputPath, `${type}${suffix}.md`);

      writeJsonFile(jsonPath, task);
      fs.writeFileSync(mdPath, createTaskMarkdown(task));
      taskFiles.push({
        type,
        batchIndex,
        batchCount,
        itemCount: batchItems.length,
        jsonPath: relativePath(jsonPath),
        markdownPath: relativePath(mdPath),
      });
    }
  }

  const manifest = {
    auditPath: relativePath(auditPath),
    outputPath: relativePath(outputPath),
    maxItemsPerTask: Number.isFinite(maxItemsPerTask) ? maxItemsPerTask : 50,
    sourcePath: args.source ? relativePath(resolveFromCwd(String(args.source))) : null,
    localesPath: args.locales ? relativePath(resolveFromCwd(String(args.locales))) : null,
    defaultLocale: context.defaultLocale,
    issueCount: report.issues?.length ?? 0,
    warningCount: report.warnings?.length ?? 0,
    includedWarningTypes: includeWarningTypes.filter((type) => SUPPORTED_WARNING_TYPES.has(type)),
    warningSeverities,
    warningsOnly,
    issueCounts: coverage.issueCounts,
    warningCounts: coverage.warningCounts,
    hardBlockerIssueCount: coverage.hardBlockerIssueCount,
    hardBlockerCoveredIssueCount: coverage.hardBlockerCoveredIssueCount,
    hardBlockerCoverageComplete: coverage.hardBlockerCoverageComplete,
    typeCoverage: coverage.typeCoverage,
    hardBlockerTaskCount: [...itemsByType.entries()]
      .filter(([type]) => HARD_BLOCKER_TYPES.has(type))
      .reduce((count, [, items]) => count + items.length, 0),
    advisoryTaskCount: [...itemsByType.entries()]
      .filter(([type]) => !HARD_BLOCKER_TYPES.has(type))
      .reduce((count, [, items]) => count + items.length, 0),
    taskFiles,
  };

  writeJsonFile(path.join(outputPath, "manifest.json"), manifest);

  if (args.json) {
    console.log(JSON.stringify(manifest, null, 2));
  } else {
    console.log(`Audit: ${relativePath(auditPath)}`);
    console.log(`Hard blocker task items: ${manifest.hardBlockerTaskCount}`);
    console.log(`Hard blocker issues covered: ${manifest.hardBlockerCoveredIssueCount}/${manifest.hardBlockerIssueCount}`);
    console.log(`Advisory task items: ${manifest.advisoryTaskCount}`);
    console.log(`Task files: ${taskFiles.length}`);
    console.log(`Output: ${relativePath(outputPath)}`);
  }
}

main();
