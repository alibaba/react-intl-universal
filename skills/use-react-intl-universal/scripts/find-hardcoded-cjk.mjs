#!/usr/bin/env node

/*
 * Purpose:
 * Find likely hardcoded CJK user-facing text in source files.
 *
 * The script is conservative and dependency-free. It does not try to fully
 * parse TypeScript or JSX. Instead, it scans source lines, skips obvious
 * comments and locale packs by default, and classifies each CJK hit so agents
 * can prioritize raw JSX text and raw strings while ignoring valid
 * intl.get(...).d(defaultMessage) source text.
 */

import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_SOURCE_EXTENSIONS,
  collectSourceFiles,
  filterIgnoredFiles,
  parseCliArgs,
  relativePath,
  resolveFromCwd,
  splitCsv,
} from "./lib/i18n-audit.mjs";

const CJK_PATTERN = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const DEFAULT_IGNORE = [
  "/locales/",
  "/locale/",
  ".locale.",
  ".locales.",
  ".json",
  ".snap",
];

function printHelp() {
  console.log(`Usage:
  node skills/use-react-intl-universal/scripts/find-hardcoded-cjk.mjs --source src

Options:
  --source PATH            Required. Source file or directory to scan.
  --extensions LIST        Optional. Comma-separated source extensions. Default: .js,.jsx,.ts,.tsx
  --ignore LIST            Optional. Comma-separated path substrings to skip.
  --include-comments       Include comment-only CJK hits. Default: false.
  --include-intl-defaults  Include probable intl.get(...).d(...) default messages. Default: false.
  --include-locales        Include locale JSON paths. Default: false.
  --strict                 Exit with code 1 when high-priority candidates exist. Default: false.
  --max NUMBER             Optional. Maximum text rows to print. Default: 120.
  --json                   Print machine-readable JSON.
  --help                   Show this help.
`);
}

function normalizePathForIgnore(filePath) {
  return `/${relativePath(filePath).split(path.sep).join("/")}`;
}

function isIgnoredByDefault(filePath, includeLocales) {
  if (includeLocales) {
    return false;
  }

  const normalized = normalizePathForIgnore(filePath);
  return DEFAULT_IGNORE.some((pattern) => normalized.includes(pattern));
}

function getContext(lines, index, radius = 3) {
  const start = Math.max(0, index - radius);
  const end = Math.min(lines.length, index + radius + 1);
  return lines.slice(start, end).join("\n");
}

function isCommentOnlyLine(trimmedLine, inBlockComment) {
  return inBlockComment
    || trimmedLine.startsWith("//")
    || trimmedLine.startsWith("*")
    || trimmedLine.startsWith("/*")
    || trimmedLine.startsWith("{/*");
}

// Remove simple inline comments for triage classification. This is deliberately
// not a full JavaScript lexer; it targets the common case that produced noisy
// false positives in large codebases:
//   const value = "Plan"; // 中文注释
// The original line is still printed when a real candidate remains.
function stripSimpleInlineComments(line) {
  const slashIndex = line.indexOf("//");
  const blockIndex = line.indexOf("/*");
  const jsxBlockIndex = line.indexOf("{/*");
  const candidates = [slashIndex, blockIndex, jsxBlockIndex].filter((index) => index >= 0);

  if (candidates.length === 0) {
    return line;
  }

  return line.slice(0, Math.min(...candidates));
}

function updateBlockCommentState(line, inBlockComment) {
  let next = inBlockComment;
  let index = 0;

  // This lightweight state machine is enough to skip normal comment blocks.
  // It deliberately does not try to understand comment markers inside strings;
  // classification is advisory and the original line is still reported.
  while (index < line.length) {
    if (next) {
      const closeIndex = line.indexOf("*/", index);
      if (closeIndex < 0) {
        return true;
      }
      next = false;
      index = closeIndex + 2;
      continue;
    }

    const openIndex = line.indexOf("/*", index);
    if (openIndex < 0) {
      return false;
    }
    next = true;
    index = openIndex + 2;
  }

  return next;
}

function classifyHit(line, context) {
  const trimmed = line.trim();
  const lowerContext = context.toLowerCase();

  if (/\b(intl|IntlUtils)\s*\.\s*(get|defaultMessage)\b/.test(context) || /\.d\s*\(/.test(context)) {
    return {
      kind: "intl-default-message",
      priority: "low",
      reason: "This is probably valid default-locale text inside intl.get(...).d(...).",
    };
  }

  if (/>[^<]*[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF][^<]*</.test(line)) {
    return {
      kind: "raw-jsx-text",
      priority: "high",
      reason: "Raw JSX text is likely user-facing and should normally use intl.get(...).d(...).",
    };
  }

  if (/(title|placeholder|label|content|message|tooltip|notice|empty|button|text)\s*[:=]/i.test(line)) {
    return {
      kind: "ui-prop-string",
      priority: "high",
      reason: "CJK text appears in a common UI prop and may be user-facing.",
    };
  }

  if (/\b(?:zh|zh[-_]CN|zh[-_]TW|cn)\s*:\s*['"`]/i.test(line)
    && /\b(?:en|en[-_]US|ja|ja[-_]JP|zh|zh[-_]CN|zh[-_]TW)\s*:/i.test(context)) {
    return {
      kind: "language-map-string",
      priority: "low",
      reason: "CJK text appears in an explicit language map; verify whether this local map is intentional or should be centralized.",
    };
  }

  if (/['"`][^'"`]*[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(line)) {
    return {
      kind: "raw-string",
      priority: lowerContext.includes("console.") ? "low" : "medium",
      reason: "CJK text appears in a string literal outside an obvious intl default message.",
    };
  }

  if (trimmed.includes("//")) {
    return {
      kind: "mixed-code-comment",
      priority: "low",
      reason: "CJK text may be in an inline comment; review manually.",
    };
  }

  return {
    kind: "unknown-code",
    priority: "medium",
    reason: "CJK text appears in source code outside an obvious locale file.",
  };
}

function priorityRank(priority) {
  return { high: 0, medium: 1, low: 2 }[priority] ?? 3;
}

function scanFile(filePath, options) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const results = [];
  let inBlockComment = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const commentOnly = isCommentOnlyLine(trimmed, inBlockComment);
    const nextBlockComment = updateBlockCommentState(line, inBlockComment);
    const codeText = stripSimpleInlineComments(line);

    if (!CJK_PATTERN.test(line)) {
      inBlockComment = nextBlockComment;
      continue;
    }

    if (!commentOnly && !CJK_PATTERN.test(codeText) && !options.includeComments) {
      inBlockComment = nextBlockComment;
      continue;
    }

    if (commentOnly && !options.includeComments) {
      inBlockComment = nextBlockComment;
      continue;
    }

    const context = getContext(lines, index);
    const classification = commentOnly
      ? {
        kind: "comment",
        priority: "low",
        reason: "CJK text appears in a comment.",
      }
      : classifyHit(codeText, context);

    if (classification.kind === "intl-default-message" && !options.includeIntlDefaults) {
      inBlockComment = nextBlockComment;
      continue;
    }

    results.push({
      filePath,
      line: index + 1,
      text: trimmed,
      context,
      ...classification,
    });

    inBlockComment = nextBlockComment;
  }

  return results;
}

function printTextReport(report) {
  console.log(`Source: ${relativePath(report.sourcePath)}`);
  console.log(`Files scanned: ${report.fileCount}`);
  console.log(`Candidates: ${report.candidateCount}`);
  console.log("");
  console.log("Priority counts:");
  for (const [key, value] of Object.entries(report.priorityCounts)) {
    console.log(`- ${key}: ${value}`);
  }

  console.log("");
  console.log("Kind counts:");
  for (const [key, value] of Object.entries(report.kindCounts)) {
    console.log(`- ${key}: ${value}`);
  }

  console.log("");
  console.log("Candidates:");
  for (const item of report.candidates.slice(0, report.max)) {
    console.log(`- [${item.priority}/${item.kind}] ${relativePath(item.filePath)}:${item.line} ${item.text}`);
    console.log(`  ${item.reason}`);
  }

  if (report.candidates.length > report.max) {
    console.log(`- ... ${report.candidates.length - report.max} more`);
  }
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.source) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const sourcePath = resolveFromCwd(String(args.source));
  const extensions = splitCsv(args.extensions, DEFAULT_SOURCE_EXTENSIONS);
  const explicitIgnore = splitCsv(args.ignore, []);
  const includeComments = Boolean(args["include-comments"]);
  const includeIntlDefaults = Boolean(args["include-intl-defaults"]);
  const includeLocales = Boolean(args["include-locales"]);
  const strict = Boolean(args.strict);
  const max = args.max ? Number(args.max) : 120;

  if (!fs.existsSync(sourcePath)) {
    console.error(`Source path does not exist: ${sourcePath}`);
    process.exitCode = 2;
    return;
  }

  const files = filterIgnoredFiles(collectSourceFiles(sourcePath, extensions), explicitIgnore)
    .filter((filePath) => !isIgnoredByDefault(filePath, includeLocales));

  const candidates = files
    .flatMap((filePath) => scanFile(filePath, {
      includeComments,
      includeIntlDefaults,
    }))
    .sort((a, b) => (
      priorityRank(a.priority) - priorityRank(b.priority)
      || a.filePath.localeCompare(b.filePath)
      || a.line - b.line
    ));

  const priorityCounts = {};
  const kindCounts = {};
  for (const item of candidates) {
    priorityCounts[item.priority] = (priorityCounts[item.priority] ?? 0) + 1;
    kindCounts[item.kind] = (kindCounts[item.kind] ?? 0) + 1;
  }

  const report = {
    sourcePath,
    extensions,
    ignorePatterns: explicitIgnore,
    includeComments,
    includeIntlDefaults,
    includeLocales,
    strict,
    fileCount: files.length,
    max: Number.isFinite(max) ? max : 120,
    candidateCount: candidates.length,
    priorityCounts,
    kindCounts,
    // Backward-compatible field for older callers. New callers should use
    // priorityCounts and kindCounts because mixing both dimensions is noisy.
    counts: priorityCounts,
    candidates,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }

  if (strict && candidates.some((item) => item.priority === "high")) {
    process.exitCode = 1;
  }
}

main();
