/*
 * Purpose:
 * Provide dependency-free shared helpers for source discovery, locale JSON
 * inspection, message-contract analysis, and translation audit workflows.
 */

import fs from "node:fs";
import path from "node:path";
import { estimateDisplayWidth } from "./display-width.mjs";

export { estimateDisplayWidth, stripRichTags } from "./display-width.mjs";

const DEFAULT_IGNORED_DIRS = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "lib",
  "node_modules",
]);

export const DEFAULT_SOURCE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];

/** Stores a parsed command-line option. */
function setCliArg(args, name, value) {
  if (args[name] === undefined) {
    args[name] = value;
    return;
  }

  if (Array.isArray(args[name])) {
    args[name].push(value);
    return;
  }

  args[name] = [args[name], value];
}

// Minimal flag parser for scripts in this skill. It supports:
// --name value, --name=value, boolean flags such as --json, and repeated flags
// such as --command "npm run typecheck" --command "npm test".
export function parseCliArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const rawName = arg.slice(2);
    const equalIndex = rawName.indexOf("=");
    if (equalIndex >= 0) {
      setCliArg(args, rawName.slice(0, equalIndex), rawName.slice(equalIndex + 1));
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      setCliArg(args, rawName, true);
      continue;
    }

    setCliArg(args, rawName, next);
    index += 1;
  }

  return args;
}

/** Resolves a path relative to the current working directory. */
export function resolveFromCwd(inputPath) {
  return path.resolve(process.cwd(), inputPath);
}

// Convert comma-separated CLI values such as ".ts,.tsx" into arrays.
export function splitCsv(value, fallback = []) {
  if (!value) {
    return fallback;
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Recursively collects files that satisfy a caller-provided predicate. */
export function collectFiles(rootPath, predicate, ignoredDirs = DEFAULT_IGNORED_DIRS) {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const stat = fs.statSync(rootPath);
  if (stat.isFile()) {
    return predicate(rootPath) ? [rootPath] : [];
  }

  const files = [];
  const entries = fs.readdirSync(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...collectFiles(entryPath, predicate, ignoredDirs));
      }
      continue;
    }

    if (entry.isFile() && predicate(entryPath)) {
      files.push(entryPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

/** Collects locale JSON files below a locale directory. */
export function collectLocaleFiles(localesPath) {
  return collectFiles(localesPath, (filePath) => path.extname(filePath) === ".json");
}

/** Collects source files whose extensions are enabled for scanning. */
export function collectSourceFiles(sourcePath, extensions = DEFAULT_SOURCE_EXTENSIONS) {
  const extensionSet = new Set(extensions);
  return collectFiles(sourcePath, (filePath) => extensionSet.has(path.extname(filePath)));
}

/** Removes files whose normalized paths match configured ignore patterns. */
export function filterIgnoredFiles(filePaths, ignorePatterns) {
  if (!ignorePatterns || ignorePatterns.length === 0) {
    return filePaths;
  }

  return filePaths.filter((filePath) => {
    const normalized = relativePath(filePath).split(path.sep).join("/");
    return !ignorePatterns.some((pattern) => normalized.includes(pattern));
  });
}

/** Returns the line and column for a source offset. */
export function getLineColumn(text, index) {
  const safeIndex = Math.max(0, Math.min(index, text.length));
  let line = 1;
  let column = 1;

  for (let i = 0; i < safeIndex; i += 1) {
    if (text[i] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

// JSON.parse does not preserve source locations. The audit scripts need to
// report "locale file + line number" for a key, so this lightweight scanner
// reads JSON string tokens and object structure directly from source text.
// It is not a full JSON validator; JSON.parse below remains the authority for
// correctness. This scanner only records best-effort property locations.
function parseJsonStringToken(text, startIndex) {
  if (text[startIndex] !== "\"") {
    throw new Error("Expected JSON string");
  }

  let value = "";
  let index = startIndex + 1;

  while (index < text.length) {
    const char = text[index];

    if (char === "\"") {
      return { value, endIndex: index + 1 };
    }

    if (char !== "\\") {
      value += char;
      index += 1;
      continue;
    }

    const escaped = text[index + 1];
    if (escaped === "u") {
      const hex = text.slice(index + 2, index + 6);
      value += String.fromCharCode(Number.parseInt(hex, 16));
      index += 6;
      continue;
    }

    const escapes = {
      "\"": "\"",
      "\\": "\\",
      "/": "/",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
    };

    value += escapes[escaped] ?? escaped;
    index += 2;
  }

  throw new Error("Unterminated JSON string");
}

/** Advances a source offset past contiguous whitespace. */
function skipWhitespace(text, index) {
  while (index < text.length && /\s/.test(text[index])) {
    index += 1;
  }

  return index;
}

// Skip true/false/null/number literals while scanning source locations.
function skipPrimitive(text, index) {
  while (index < text.length && !/[\s,\]}]/.test(text[index])) {
    index += 1;
  }

  return index;
}

// Recursively scan a JSON value so nested locale packs are supported:
// { "settings": { "title": "Settings" } } can be addressed as settings.title.
function scanJsonValue(text, index, pathSegments, locations, duplicates) {
  index = skipWhitespace(text, index);

  if (text[index] === "{") {
    return scanJsonObject(text, index, pathSegments, locations, duplicates);
  }

  if (text[index] === "[") {
    return scanJsonArray(text, index, pathSegments, locations, duplicates);
  }

  if (text[index] === "\"") {
    return parseJsonStringToken(text, index).endIndex;
  }

  return skipPrimitive(text, index);
}

/** Scans a JSON array while recording nested property locations. */
function scanJsonArray(text, index, pathSegments, locations, duplicates) {
  index += 1;
  let itemIndex = 0;

  while (index < text.length) {
    index = skipWhitespace(text, index);

    if (text[index] === "]") {
      return index + 1;
    }

    index = scanJsonValue(text, index, [...pathSegments, `[${itemIndex}]`], locations, duplicates);
    itemIndex += 1;
    index = skipWhitespace(text, index);

    if (text[index] === ",") {
      index += 1;
    }
  }

  return index;
}

/** Scans a JSON object while recording keys and duplicate properties. */
function scanJsonObject(text, index, pathSegments, locations, duplicates) {
  index += 1;
  const seenKeys = new Map();

  while (index < text.length) {
    index = skipWhitespace(text, index);

    if (text[index] === "}") {
      return index + 1;
    }

    const keyStart = index;
    const keyToken = parseJsonStringToken(text, keyStart);
    const key = keyToken.value;
    const nextPathSegments = [...pathSegments, key];
    const location = {
      key,
      pathSegments: nextPathSegments,
      path: nextPathSegments.join("."),
      ...getLineColumn(text, keyStart),
      index: keyStart,
    };

    locations.push(location);

    // Duplicate keys are legal text but ambiguous JSON semantics. JSON.parse
    // keeps the last value, so we report duplicates as warnings for humans.
    if (seenKeys.has(key)) {
      duplicates.push({
        key,
        pathSegments: nextPathSegments,
        path: nextPathSegments.join("."),
        firstLine: seenKeys.get(key).line,
        line: location.line,
      });
    } else {
      seenKeys.set(key, location);
    }

    index = skipWhitespace(text, keyToken.endIndex);
    if (text[index] !== ":") {
      return index;
    }

    index = scanJsonValue(text, index + 1, nextPathSegments, locations, duplicates);
    index = skipWhitespace(text, index);

    if (text[index] === ",") {
      index += 1;
    }
  }

  return index;
}

/** Returns property locations and duplicate keys discovered in JSON source. */
export function scanJsonProperties(text) {
  const locations = [];
  const duplicates = [];

  try {
    scanJsonValue(text, 0, [], locations, duplicates);
  } catch {
    return { locations: [], duplicates: [] };
  }

  return { locations, duplicates };
}

// Read one locale JSON file and attach both parsed data and source metadata.
// parseError is returned instead of thrown so batch scripts can report all
// bad locale files in one run.
export function readLocaleFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const metadata = scanJsonProperties(text);

  try {
    return {
      filePath,
      text,
      json: JSON.parse(text),
      parseError: null,
      propertyLocations: metadata.locations,
      duplicateProperties: metadata.duplicates,
    };
  } catch (error) {
    return {
      filePath,
      text,
      json: null,
      parseError: error,
      propertyLocations: metadata.locations,
      duplicateProperties: metadata.duplicates,
    };
  }
}

/** Derives a locale identifier from a locale file's relative path. */
export function getLocaleName(filePath, localesRootPath) {
  const relative = path.relative(localesRootPath, filePath);
  return relative.replace(/\.json$/i, "").split(path.sep).join("/");
}

/** Checks whether an object owns the requested property. */
function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

// Support both common locale shapes:
// 1. Flat keys: { "user.profile.title": "Profile" }
// 2. Nested keys: { "user": { "profile": { "title": "Profile" } } }
// Flat keys win when both forms exist because react-intl-universal keys are
// usually stored flat in generated locale files.
export function getMessageValue(localeJson, key) {
  if (!localeJson || typeof localeJson !== "object") {
    return { exists: false, value: undefined, pathSegments: [] };
  }

  if (hasOwn(localeJson, key)) {
    return { exists: true, value: localeJson[key], pathSegments: [key], mode: "flat" };
  }

  const pathSegments = key.split(".");
  let current = localeJson;

  for (const segment of pathSegments) {
    if (!current || typeof current !== "object" || !hasOwn(current, segment)) {
      return { exists: false, value: undefined, pathSegments };
    }

    current = current[segment];
  }

  return { exists: true, value: current, pathSegments, mode: "nested" };
}

// Match a parsed JSON path back to its scanned source location.
export function findLocation(propertyLocations, pathSegments) {
  return propertyLocations.find((location) => (
    location.pathSegments.length === pathSegments.length
    && location.pathSegments.every((segment, index) => segment === pathSegments[index])
  ));
}

/** Finds the closing brace that matches an opening brace. */
function findMatchingBrace(message, openIndex, endIndex = message.length) {
  let depth = 0;

  for (let index = openIndex; index < endIndex; index += 1) {
    if (message[index] === "{") {
      depth += 1;
    } else if (message[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

// ICU arguments start with an identifier:
//   {username}
//   {count, plural, one {...} other {...}}
// We only need the identifier and nested option bodies for contract checking.
function readIdentifier(input, index = 0) {
  index = skipWhitespace(input, index);
  const match = /^[A-Za-z_$][\w$.-]*/.exec(input.slice(index));

  if (!match) {
    return null;
  }

  return {
    value: match[0],
    endIndex: index + match[0].length,
  };
}

/** Reads the next comma-delimited ICU argument segment. */
function readCommaPart(input, index) {
  index = skipWhitespace(input, index);
  if (input[index] !== ",") {
    return null;
  }

  const identifier = readIdentifier(input, index + 1);
  return identifier;
}

// Scan a message segment for ICU placeholders. Plural/select option bodies can
// contain nested placeholders, so nested blocks are scanned recursively below.
function scanIcuMessageSegment(message, variables, startIndex = 0, endIndex = message.length) {
  let index = startIndex;

  while (index < endIndex) {
    if (message[index] !== "{") {
      index += 1;
      continue;
    }

    const closeIndex = findMatchingBrace(message, index, endIndex);
    if (closeIndex < 0) {
      return;
    }

    scanIcuArgument(message.slice(index + 1, closeIndex), variables);
    index = closeIndex + 1;
  }
}

// In "{count, plural, one {book} other {{count} books}}", option bodies are the
// chunks after "one" and "other". Plain words like "book" are text, not vars.
function scanIcuOptionBodies(content, variables, startIndex) {
  let index = startIndex;

  while (index < content.length) {
    if (content[index] !== "{") {
      index += 1;
      continue;
    }

    const closeIndex = findMatchingBrace(content, index);
    if (closeIndex < 0) {
      return;
    }

    scanIcuMessageSegment(content, variables, index + 1, closeIndex);
    index = closeIndex + 1;
  }
}

/** Extracts variables and nested option bodies from one ICU argument. */
function scanIcuArgument(content, variables) {
  const variable = readIdentifier(content, 0);
  if (!variable) {
    return;
  }

  const afterVariable = skipWhitespace(content, variable.endIndex);
  if (afterVariable >= content.length) {
    variables.add(variable.value);
    return;
  }

  if (content[afterVariable] !== ",") {
    return;
  }

  variables.add(variable.value);

  const type = readCommaPart(content, variable.endIndex);
  if (!type) {
    return;
  }

  if (["plural", "select", "selectordinal"].includes(type.value)) {
    scanIcuOptionBodies(content, variables, type.endIndex);
  }
}

/** Returns every variable referenced by an ICU message. */
export function extractIcuVariables(message) {
  const variables = new Set();
  scanIcuMessageSegment(String(message), variables);
  return [...variables].sort((a, b) => a.localeCompare(b));
}

// Rich React interpolation uses lower-case tag names in messages, such as:
// "Read the <link>docs</link>". We only compare tag names, not attributes,
// because props such as href/onClick/tone should live in React code.
export function extractRichTags(message) {
  const tags = new Set();
  const pattern = /<\/?\s*([a-z][\w-]*)\b[^>]*>/gi;
  let match;

  while ((match = pattern.exec(String(message))) !== null) {
    tags.add(match[1]);
  }

  return [...tags].sort((a, b) => a.localeCompare(b));
}

// A message contract is the part translators must preserve exactly:
// ICU variables and rich tags. The natural-language words may be translated.
export function getMessageContract(message) {
  if (typeof message !== "string") {
    return {
      isString: false,
      variables: [],
      tags: [],
    };
  }

  return {
    isString: true,
    variables: extractIcuVariables(message),
    tags: extractRichTags(message),
  };
}

/** Compares source and translated placeholders and rich-text tags. */
export function compareMessageContracts(expected, actual) {
  const expectedVariables = new Set(expected.variables);
  const actualVariables = new Set(actual.variables);
  const expectedTags = new Set(expected.tags);
  const actualTags = new Set(actual.tags);

  return {
    missingVariables: [...expectedVariables].filter((item) => !actualVariables.has(item)),
    extraVariables: [...actualVariables].filter((item) => !expectedVariables.has(item)),
    missingTags: [...expectedTags].filter((item) => !actualTags.has(item)),
    extraTags: [...actualTags].filter((item) => !expectedTags.has(item)),
  };
}

/** Checks whether two message contracts have meaningful differences. */
export function hasContractDiff(diff) {
  return (
    diff.missingVariables.length > 0
    || diff.extraVariables.length > 0
    || diff.missingTags.length > 0
    || diff.extraTags.length > 0
  );
}

/** Formats a list of values as readable prose. */
export function formatList(items) {
  return items.length > 0 ? items.join(", ") : "-";
}

/** Converts JavaScript template placeholders into ICU placeholder syntax. */
export function transformTemplateVariables(message) {
  return String(message).replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, "{$1}");
}

/** Converts a character offset into its one-based source line number. */
export function getSourceLine(text, index) {
  return getLineColumn(text, index).line;
}

/** Returns the trimmed source line containing a character offset. */
export function getSourceLineText(text, index) {
  const lineStart = text.lastIndexOf("\n", index) + 1;
  const lineEnd = text.indexOf("\n", index);
  return text.slice(lineStart, lineEnd >= 0 ? lineEnd : text.length).trim();
}

/** Collapses a source call into a bounded single-line diagnostic snippet. */
export function summarizeSourceCall(text, maxLength = 260) {
  const summary = String(text).replace(/\s+/g, " ").trim();
  if (summary.length <= maxLength) {
    return summary;
  }

  return `${summary.slice(0, maxLength - 1)}…`;
}

// The source scanner is lightweight, so it can match intl calls inside
// commented-out JSX or JavaScript. This state machine marks those calls as
// likely comments instead of dropping them; callers can then warn humans without
// silently hiding locale keys that may still exist in generated packs.
function isLikelyCommentedMatch(text, index) {
  let inLineComment = false;
  let inBlockComment = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let escaped = false;

  for (let i = 0; i < index; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inSingleQuote || inDoubleQuote || inTemplate;
      continue;
    }

    if (inSingleQuote) {
      if (char === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (char === "\"") {
        inDoubleQuote = false;
      }
      continue;
    }

    if (inTemplate) {
      if (char === "`") {
        inTemplate = false;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
    } else if (char === "\"") {
      inDoubleQuote = true;
    } else if (char === "`") {
      inTemplate = true;
    }
  }

  if (inLineComment || inBlockComment) {
    return true;
  }

  const lineStart = text.lastIndexOf("\n", index) + 1;
  const beforeOnLine = text.slice(lineStart, index);
  return /^\s*(?:\/\/|\*|\/\*|\{\/\*)/.test(beforeOnLine) || beforeOnLine.includes("{/*");
}

// Extract statically-declared intl.get/getHTML messages. This deliberately
// handles the common, extractable pattern only:
//   intl.get("KEY", values).d("Default {value}")
// Dynamic keys or computed default messages are skipped because they cannot be
// safely represented in locale JSON by deterministic tooling.
export function extractIntlMessagesFromSource(text, filePath) {
  const messages = [];
  const pattern = /(?:intl|IntlUtils)\s*\.\s*(getHTML|get)\s*\(\s*(['"`])([\w.-]+)\2[\s\S]*?\)\s*\.\s*(defaultMessage|d)\s*\(\s*(['"`])([\s\S]*?)\5\s*,?\s*\)/gm;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const api = match[1];
    const key = match[3];
    const method = match[4];
    const quote = match[5];
    const originalDefaultMessage = match[6];
    // Preserve the old extractor behavior: template-string defaults are
    // converted from ${name} into ICU {name} for the generated locale message.
    const transformedDefaultMessage = quote === "`"
      ? transformTemplateVariables(originalDefaultMessage)
      : originalDefaultMessage;

    messages.push({
      api,
      key,
      method,
      quote,
      filePath,
      line: getSourceLine(text, match.index),
      lineText: getSourceLineText(text, match.index),
      callText: summarizeSourceCall(match[0]),
      contextSnippet: text.slice(Math.max(0, match.index - 160), Math.min(text.length, match.index + match[0].length + 160)),
      originalDefaultMessage,
      transformedDefaultMessage,
      usesTemplateInterpolation: quote === "`" && /\$\{/.test(originalDefaultMessage),
      isLikelyCommented: isLikelyCommentedMatch(text, match.index),
    });
  }

  return messages;
}

/** Finds deprecated intl.getHTML call sites in source text. */
export function findGetHTMLUsages(text, filePath) {
  const usages = [];
  const pattern = /(?:intl|IntlUtils)\s*\.\s*getHTML\s*\(/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    usages.push({
      filePath,
      line: getSourceLine(text, match.index),
    });
  }

  return usages;
}

/** Returns a normalized path relative to the current working directory. */
export function relativePath(filePath) {
  return path.relative(process.cwd(), filePath) || ".";
}

/** Loads locale JSON files with message values and source locations. */
export function loadLocaleData(localesPath, ignorePatterns = []) {
  return filterIgnoredFiles(collectLocaleFiles(localesPath), ignorePatterns).map((filePath) => {
    const localeFile = readLocaleFile(filePath);
    return {
      locale: getLocaleName(filePath, localesPath),
      filePath,
      localeFile,
    };
  });
}

// Load source messages and deprecated getHTML usages in one pass so callers do
// not need to scan the same source files multiple times.
export function loadSourceMessages(sourcePath, extensions = DEFAULT_SOURCE_EXTENSIONS, ignorePatterns = []) {
  const sourceFiles = filterIgnoredFiles(collectSourceFiles(sourcePath, extensions), ignorePatterns);
  const sourceMessages = [];
  const getHTMLUsages = [];

  for (const filePath of sourceFiles) {
    const text = fs.readFileSync(filePath, "utf8");
    sourceMessages.push(...extractIntlMessagesFromSource(text, filePath));
    getHTMLUsages.push(...findGetHTMLUsages(text, filePath));
  }

  return {
    sourceFiles,
    sourceMessages,
    getHTMLUsages,
  };
}

// Normalize only whitespace. This lets default-locale inference still succeed
// when the extractor or formatter changed line wrapping but did not change text.
export function normalizeMessageForComparison(message) {
  return String(message)
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

// Collapse multiple source occurrences of the same key. If the same key has
// two different .d() messages, it is unsafe to infer or audit from that key, so
// callers receive it as a conflict.
export function getUniqueSourceDefaults(sourceMessages) {
  const grouped = new Map();

  for (const message of sourceMessages) {
    if (!message.key || typeof message.transformedDefaultMessage !== "string") {
      continue;
    }

    const group = grouped.get(message.key) ?? [];
    group.push(message);
    grouped.set(message.key, group);
  }

  const unique = [];
  const conflicts = [];

  for (const [key, messages] of grouped) {
    const defaults = new Set(messages.map((message) => message.transformedDefaultMessage));
    if (defaults.size > 1) {
      conflicts.push({ key, messages });
      continue;
    }

    unique.push(messages[0]);
  }

  return { unique, conflicts };
}

// Infer default locale by comparing source .d() messages with each locale file.
// This is a confidence score, not a hard guarantee. The best candidate must
// have enough exact/default matches and must not be ambiguous.
export function inferDefaultLocale(sourceMessages, localeData) {
  const { unique, conflicts } = getUniqueSourceDefaults(sourceMessages);
  const sourceDefaults = unique.filter((message) => message.api === "get" || message.api === "getHTML");
  const candidates = [];

  for (const { locale, filePath, localeFile } of localeData) {
    if (localeFile.parseError) {
      candidates.push({
        locale,
        filePath,
        score: 0,
        confidence: "low",
        sourceMessageCount: sourceDefaults.length,
        exactMatches: 0,
        normalizedMatches: 0,
        missingKeys: sourceDefaults.length,
        parseError: String(localeFile.parseError.message),
        samples: [],
      });
      continue;
    }

    let exactMatches = 0;
    let normalizedMatches = 0;
    let compared = 0;
    let missingKeys = 0;
    const samples = [];

    for (const message of sourceDefaults) {
      const valueInfo = getMessageValue(localeFile.json, message.key);

      if (!valueInfo.exists || typeof valueInfo.value !== "string") {
        missingKeys += 1;
        continue;
      }

      compared += 1;

      if (valueInfo.value === message.transformedDefaultMessage) {
        exactMatches += 1;
        if (samples.length < 5) {
          samples.push({ key: message.key, match: "exact", message: valueInfo.value });
        }
      } else if (normalizeMessageForComparison(valueInfo.value) === normalizeMessageForComparison(message.transformedDefaultMessage)) {
        normalizedMatches += 1;
        if (samples.length < 5) {
          samples.push({ key: message.key, match: "normalized", message: valueInfo.value });
        }
      }
    }

    const denominator = sourceDefaults.length || 1;
    const score = (exactMatches + normalizedMatches * 0.85) / denominator;
    let confidence = "low";
    // Small projects may have only a few messages; exact all-message matches
    // should still be considered high confidence in that case.
    if ((sourceDefaults.length >= 3 && score >= 0.75 && exactMatches >= 3) || (sourceDefaults.length > 0 && exactMatches === sourceDefaults.length)) {
      confidence = "high";
    } else if (score >= 0.45 && exactMatches >= 2) {
      confidence = "medium";
    }

    candidates.push({
      locale,
      filePath,
      score,
      confidence,
      sourceMessageCount: sourceDefaults.length,
      compared,
      exactMatches,
      normalizedMatches,
      missingKeys,
      parseError: null,
      samples,
    });
  }

  candidates.sort((a, b) => b.score - a.score || b.exactMatches - a.exactMatches || a.locale.localeCompare(b.locale));

  const best = candidates[0] ?? null;
  const second = candidates[1] ?? null;
  const isAmbiguous = Boolean(best && second && best.score > 0 && Math.abs(best.score - second.score) < 0.05);
  // If the best and second-best candidates are too close, return unknown to
  // force the caller to ask or inspect project config rather than guessing.
  const defaultLocale = best && best.score >= 0.2 && !isAmbiguous ? best.locale : null;

  return {
    defaultLocale,
    confidence: defaultLocale ? best.confidence : "low",
    ambiguous: isAmbiguous,
    sourceMessageCount: sourceDefaults.length,
    skippedConflictingKeys: conflicts.map((conflict) => conflict.key),
    candidates,
  };
}

// Identify whether a message is likely rendered in compact UI. Key names and
// the current source line are weighted more heavily than the wider snippet to
// avoid unrelated nearby code causing false positives.
export function classifyUiCopyRisk(key, sourceMessage = {}) {
  const primaryContext = [
    key,
    sourceMessage.lineText,
  ].filter(Boolean).join(" ").toLowerCase();
  const widerContext = [
    primaryContext,
    sourceMessage.contextSnippet,
  ].filter(Boolean).join(" ").toLowerCase();

  if (/(description|paragraph|section-note|note|help|docs|documentation|faq|body|content|detail)/.test(primaryContext)) {
    return "low";
  }

  if (/(placeholder|aria-label|button|btn|tab|menu|label|badge|chip|tag|status|column|header|table|filter|search|submit|cancel|confirm|save|delete|edit|title)/.test(primaryContext)) {
    return "high";
  }

  if (/(placeholder|aria-label|button|btn|tab|menu|label|badge|status|table|filter|search)/.test(widerContext)) {
    return "high";
  }

  if (/(tooltip|hint|empty|toast|alert|notice|banner|summary)/.test(primaryContext)) {
    return "medium";
  }

  if (/(description|paragraph|section-note|note|help|docs|documentation|faq|body|content|detail)/.test(widerContext)) {
    return "low";
  }

  return "medium";
}

/** Detects the grouped control visual integrity risk. */
export function detectGroupedControlVisualIntegrityRisk(sourceMessage = {}) {
  const context = [
    sourceMessage.lineText,
    sourceMessage.callText,
    sourceMessage.contextSnippet,
  ].filter(Boolean).join(" ").toLowerCase();

  if (!context) {
    return null;
  }

  const hasGroupedControl = /\b(segment|segmented|button[-_ ]?group|btn[-_ ]?group|tab(?:[-_ ]?(?:group|list))?|chip[-_ ]?group|badge[-_ ]?group|pagination|pager|table[-_ ]?action|filter[-_ ]?group)\b/.test(context);
  const hasChildControl = /(<button\b|\bbutton\b|\btab\b|\bchip\b|\bbadge\b|\bmenuitem\b|\boption\b)/.test(context);
  const hasWrapOrSizing = /(flex-wrap|wrap|inline-flex|display\s*:\s*flex|display\s*:\s*inline-flex|min-width|white-space|nowrap)/.test(context);
  const hasJoinedBorderStyling = /(border-right\s*:\s*0|border-left\s*:\s*0|border-radius|first-child|last-child|:first-child|:last-child)/.test(context);

  if (hasGroupedControl && hasChildControl && (hasWrapOrSizing || hasJoinedBorderStyling)) {
    return {
      type: "wrapped-grouped-control",
      severity: hasWrapOrSizing && hasJoinedBorderStyling ? "high" : "medium",
      message: "Wrapped grouped-control visual integrity risk: verify screenshots for continuous borders, outer-only radius, clear active state, no isolated row fragments, and stable icon/text/arrow relationships.",
    };
  }

  return null;
}

// Return a warning descriptor when a non-default translation is much wider than
// the default text. The warning is advisory: the agent should either shorten
// the translation or, when accuracy requires length, consider CSS/layout fixes.
// When source context suggests a wrapped grouped control, the warning also
// carries a component visual-integrity review prompt. Static display width does
// not prove grouped controls remain visually intact.
export function getLengthRiskWarning({
  key,
  locale,
  defaultMessage,
  translatedMessage,
  sourceMessage,
  ratioThreshold = 1.35,
}) {
  if (typeof defaultMessage !== "string" || typeof translatedMessage !== "string") {
    return null;
  }

  const defaultWidth = estimateDisplayWidth(defaultMessage);
  const translatedWidth = estimateDisplayWidth(translatedMessage);

  if (defaultWidth <= 0 || translatedWidth <= defaultWidth) {
    return null;
  }

  const extraWidth = translatedWidth - defaultWidth;
  const ratio = translatedWidth / defaultWidth;
  const uiRisk = classifyUiCopyRisk(key, sourceMessage);
  const visualIntegrityRisk = detectGroupedControlVisualIntegrityRisk(sourceMessage);

  // Very short default labels can make natural target-locale labels look risky
  // by ratio alone. Ignore translations that are still short in absolute
  // display width and only slightly wider than the default. Longer values
  // remain reportable.
  if (translatedWidth <= 10 && extraWidth <= 6) {
    return null;
  }

  const threshold = uiRisk === "high"
    ? Math.min(ratioThreshold, 1.25)
    : uiRisk === "low"
      ? Math.max(ratioThreshold, 1.8)
      : ratioThreshold;

  if (ratio < threshold) {
    return null;
  }

  let severity = "low";
  if (
    uiRisk === "high"
    && (
      translatedWidth >= 24
      || (ratio >= 2 && extraWidth >= 8)
    )
  ) {
    severity = "high";
  } else if (
    ratio >= 1.75
    || (uiRisk === "medium" && ratio >= 1.5)
    || (uiRisk === "high" && extraWidth >= 6)
  ) {
    severity = "medium";
  }

  return {
    key,
    locale,
    severity,
    uiRisk,
    ratio: Number(ratio.toFixed(2)),
    defaultWidth,
    translatedWidth,
    extraWidth,
    visualIntegrityRisk,
    defaultMessage,
    translatedMessage,
  };
}

// Flatten nested locale JSON into dot paths for diff generation.
export function flattenStringMessages(json, prefix = "") {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return {};
  }

  const result = {};

  for (const [key, value] of Object.entries(json)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      result[nextKey] = value;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenStringMessages(value, nextKey));
    }
  }

  return result;
}

// Preserve the existing locale shape when possible. If a key currently exists
// as a nested path, update that nested value; otherwise write a flat key.
export function setMessageValue(localeJson, key, value) {
  const existing = getMessageValue(localeJson, key);

  if (existing.exists && existing.mode === "nested") {
    let current = localeJson;
    for (const segment of existing.pathSegments.slice(0, -1)) {
      current = current[segment];
    }
    current[existing.pathSegments.at(-1)] = value;
    return;
  }

  localeJson[key] = value;
}

// Used for translation deltas where null means "delete this removed key".
export function deleteMessageValue(localeJson, key) {
  if (hasOwn(localeJson, key)) {
    delete localeJson[key];
    return true;
  }

  const pathSegments = key.split(".");
  let current = localeJson;

  for (const segment of pathSegments.slice(0, -1)) {
    if (!current || typeof current !== "object" || !hasOwn(current, segment)) {
      return false;
    }
    current = current[segment];
  }

  const last = pathSegments.at(-1);
  if (current && typeof current === "object" && hasOwn(current, last)) {
    delete current[last];
    return true;
  }

  return false;
}

/** Serializes formatted JSON and creates its parent directory when needed. */
export function writeJsonFile(filePath, json) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
}
