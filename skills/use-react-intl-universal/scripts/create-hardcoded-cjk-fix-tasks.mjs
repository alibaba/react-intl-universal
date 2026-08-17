#!/usr/bin/env node

/*
 * Purpose:
 * Turn find-hardcoded-cjk.mjs JSON output into focused fix task files.
 *
 * The scanner produces triage candidates. This script creates the remediation
 * layer: file-grouped tasks with context, priority, and migration guidance so
 * agents can replace hardcoded CJK UI text with intl.get(...).d(...) patterns
 * without re-reading the full scan report.
 */

import fs from "node:fs";
import path from "node:path";
import {
  parseCliArgs,
  relativePath,
  resolveFromCwd,
  splitCsv,
  writeJsonFile,
} from "./lib/i18n-audit.mjs";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const DEFAULT_PRIORITIES = ["high", "medium"];

/** Prints command-line usage information. */
function printHelp() {
  console.log(`Usage:
  node skills/use-react-intl-universal/scripts/create-hardcoded-cjk-fix-tasks.mjs --hardcoded tmp/i18n-hardcoded-cjk.json --output tmp/i18n-hardcoded-fix-tasks

Options:
  --hardcoded PATH          Required. JSON report from find-hardcoded-cjk.mjs --json.
  --output PATH             Optional. Output directory. Default: tmp/i18n-hardcoded-fix-tasks
  --priorities LIST         Optional. Candidate priorities to include. Default: high,medium
  --ignore LIST             Optional. Comma-separated path substrings to skip.
  --max-items-per-task N    Optional. Split each file group with at most N items. Default: 20.
  --json                    Print machine-readable manifest JSON.
  --help                    Show this help.
`);
}

/** Reads and validates the hardcoded-CJK scan report. */
function readHardcodedReport(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read hardcoded CJK report: ${error.message}`);
  }
}

/** Normalizes a candidate file path for grouping and ignore matching. */
function normalizePath(filePath) {
  return relativePath(filePath).split(path.sep).join("/");
}

/** Checks whether a hardcoded-text candidate should be ignored. */
function shouldIgnore(filePath, ignorePatterns) {
  const normalized = normalizePath(filePath);
  return ignorePatterns.some((pattern) => normalized.includes(pattern));
}

/** Returns the numeric sorting rank for a priority. */
function priorityRank(priority) {
  return PRIORITY_ORDER[priority] ?? 99;
}

/** Splits items into fixed-size batches. */
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

/** Returns the file-name suffix for a task batch. */
function getBatchSuffix(batchIndex, batchCount) {
  if (batchCount <= 1) {
    return "";
  }

  return `.part-${String(batchIndex + 1).padStart(3, "0")}`;
}

/** Converts a file path into a stable task-file slug. */
function slugifyFilePath(filePath) {
  return normalizePath(filePath)
    .replace(/^src\//, "")
    .replace(/\.[jt]sx?$/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "__")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "root";
}

/** Returns remediation guidance for a hardcoded-text category. */
function getGuidance(kind) {
  switch (kind) {
    case "raw-jsx-text":
      return "Replace raw JSX text with intl.get(KEY, values).d(DEFAULT_MESSAGE). If the CJK text is a fragment next to dynamic text, move the neighboring dynamic values into the same ICU message. Keep the full sentence or UI phrase in one message. Use rich tags if React elements must be placed inside the sentence.";
    case "ui-prop-string":
      return "Move the UI prop text into intl.get(KEY).d(DEFAULT_MESSAGE). Keep the prop value concise because this is likely compact UI.";
    case "raw-string":
      return "If the string is user-facing, move it to intl.get(KEY).d(DEFAULT_MESSAGE). If it is a log, test fixture, API payload, or non-UI constant, document why it should remain in source.";
    default:
      return "Review whether this CJK text is user-facing. Convert to intl.get(KEY).d(DEFAULT_MESSAGE) when it is visible to users.";
  }
}

/** Groups actionable hardcoded-text candidates by source file. */
function groupCandidates(candidates, priorities, ignorePatterns) {
  const groups = new Map();
  const allowedPriorities = new Set(priorities);

  for (const candidate of candidates) {
    if (!allowedPriorities.has(candidate.priority)) {
      continue;
    }

    if (shouldIgnore(candidate.filePath, ignorePatterns)) {
      continue;
    }

    const filePath = normalizePath(candidate.filePath);
    const group = groups.get(filePath) ?? [];
    group.push({
      priority: candidate.priority,
      kind: candidate.kind,
      filePath,
      line: candidate.line,
      text: candidate.text,
      context: candidate.context,
      reason: candidate.reason,
      guidance: getGuidance(candidate.kind),
    });
    groups.set(filePath, group);
  }

  return [...groups.entries()]
    .map(([filePath, items]) => ({
      filePath,
      items: items.sort((a, b) => (
        priorityRank(a.priority) - priorityRank(b.priority)
        || a.line - b.line
      )),
    }))
    .sort((a, b) => (
      priorityRank(a.items[0]?.priority) - priorityRank(b.items[0]?.priority)
      || a.filePath.localeCompare(b.filePath)
    ));
}

/** Renders one source-file remediation batch as an actionable Markdown task. */
function createTaskMarkdown(task) {
  const lines = [
    `# Hardcoded CJK fix task: ${task.filePath}${task.batchCount > 1 ? ` (${task.batchIndex + 1}/${task.batchCount})` : ""}`,
    "",
    `Items in this batch: ${task.itemCount}`,
    `Total items for this file: ${task.totalFileItemCount}`,
    "",
    "Instructions:",
    "- Convert user-facing CJK text to intl.get(KEY, values).d(DEFAULT_MESSAGE).",
    "- Preserve the full user-facing business meaning. Do not translate or extract only the visible CJK fragment when the surrounding code provides the real subject, object, status, or action.",
    "- Keep dynamic values as ICU placeholders such as {count}, not JavaScript template interpolation.",
    "- Keep a complete sentence in one key. Use rich tags for links/components inside a sentence.",
    "- If the CJK text is only a fragment next to dynamic text, include the neighboring dynamic values in the same ICU message so other locales can reorder the phrase.",
    "- For translated locales, write natural target-locale product copy from the complete message intent, not a word-by-word rendering of the CJK source text.",
    "- Do not modify default-locale wording just to shorten it; shorten only translated locale text when needed.",
    "- If an item is not user-facing, record why it should remain in source.",
    "",
    "Items:",
  ];

  for (const item of task.items) {
    lines.push("");
    lines.push(`## ${task.filePath}:${item.line}`);
    lines.push(`Priority: ${item.priority}`);
    lines.push(`Kind: ${item.kind}`);
    lines.push(`Text: ${JSON.stringify(item.text)}`);
    lines.push(`Reason: ${item.reason}`);
    lines.push(`Guidance: ${item.guidance}`);
    lines.push("Context:");
    lines.push("```tsx");
    lines.push(item.context);
    lines.push("```");
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

/** Runs this script's command-line workflow. */
function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.hardcoded) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const hardcodedPath = resolveFromCwd(String(args.hardcoded));
  const outputPath = resolveFromCwd(String(args.output ?? "tmp/i18n-hardcoded-fix-tasks"));
  const priorities = splitCsv(args.priorities, DEFAULT_PRIORITIES);
  const ignorePatterns = splitCsv(args.ignore, []);
  const maxItemsPerTask = args["max-items-per-task"] ? Number(args["max-items-per-task"]) : 20;
  let report;

  try {
    report = readHardcodedReport(hardcodedPath);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }

  fs.mkdirSync(outputPath, { recursive: true });
  const groups = groupCandidates(report.candidates ?? [], priorities, ignorePatterns);
  const taskFiles = [];

  for (const group of groups) {
    const batches = chunkItems(group.items, maxItemsPerTask);
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batchItems = batches[batchIndex];
      const batchCount = batches.length;
      const suffix = getBatchSuffix(batchIndex, batchCount);
      const task = {
        filePath: group.filePath,
        hardcodedPath: relativePath(hardcodedPath),
        priorities,
        ignorePatterns,
        batchIndex,
        batchCount,
        itemCount: batchItems.length,
        totalFileItemCount: group.items.length,
        items: batchItems,
      };
      const baseName = `${slugifyFilePath(group.filePath)}${suffix}`;
      const jsonPath = path.join(outputPath, `${baseName}.json`);
      const mdPath = path.join(outputPath, `${baseName}.md`);

      writeJsonFile(jsonPath, task);
      fs.writeFileSync(mdPath, createTaskMarkdown(task));
      taskFiles.push({
        filePath: group.filePath,
        batchIndex,
        batchCount,
        itemCount: batchItems.length,
        jsonPath: relativePath(jsonPath),
        markdownPath: relativePath(mdPath),
      });
    }
  }

  const manifest = {
    hardcodedPath: relativePath(hardcodedPath),
    outputPath: relativePath(outputPath),
    priorities,
    ignorePatterns,
    maxItemsPerTask: Number.isFinite(maxItemsPerTask) ? maxItemsPerTask : 20,
    sourceCandidateCount: report.candidates?.length ?? 0,
    taskItemCount: groups.reduce((count, group) => count + group.items.length, 0),
    taskFileCount: taskFiles.length,
    taskFiles,
  };

  writeJsonFile(path.join(outputPath, "manifest.json"), manifest);

  if (args.json) {
    console.log(JSON.stringify(manifest, null, 2));
  } else {
    console.log(`Hardcoded report: ${relativePath(hardcodedPath)}`);
    console.log(`Task items: ${manifest.taskItemCount}`);
    console.log(`Task files: ${manifest.taskFileCount}`);
    console.log(`Output: ${relativePath(outputPath)}`);
  }
}

main();
