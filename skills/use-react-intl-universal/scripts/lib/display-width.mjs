/*
 * Purpose:
 * Estimate the visual display width of localized UI text without npm
 * dependencies.
 *
 * This helper is used only for static i18n layout-risk warnings. It does not
 * measure browser pixels and must not be used to truncate text automatically.
 *
 * The behavior is intentionally close to the default behavior of string-width:
 * strip ANSI escape codes, segment text by grapheme clusters, treat emoji and
 * East Asian wide/fullwidth characters as width 2, and treat non-printing
 * marks/control characters as width 0. The implementation is inlined here so
 * skill scripts can run inside arbitrary repositories without installing npm
 * packages. Range data and algorithm shape are adapted from the MIT-licensed
 * string-width, strip-ansi, ansi-regex, and get-east-asian-width packages.
 */

const ANSI_PATTERN = String.raw`(?:\u001B\][\s\S]*?(?:\u0007|\u001B\u005C|\u009C))|[\u001B\u009B][[\]()#;?]*(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]`;
const ANSI_REGEX = new RegExp(ANSI_PATTERN, "g");
const PRINTABLE_ASCII_REGEX = /^[\u0020-\u007E]*$/;
const RICH_TAG_REGEX = /<\/?\s*[a-z][\w-]*\b[^>]*>/gi;
const UNQUALIFIED_KEYCAP_REGEX = /^[\d#*]\uFE0F?\u20E3$/u;

const graphemeSegmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;

const rgiEmojiRegex = createRegex("^\\p{RGI_Emoji}$", "v");
const extendedPictographicRegex = createRegex("\\p{Extended_Pictographic}", "gu");
const nonPrintingCharRegex = createRegex(
  "^(?:\\p{Default_Ignorable_Code_Point}|\\p{Control}|\\p{Format}|\\p{Mark}|\\p{Surrogate})$",
  "u",
);

const FULLWIDTH_RANGES = [
  12288, 12288,
  65281, 65376,
  65504, 65510,
];

const WIDE_RANGES = [
  4352, 4447,
  8986, 8987,
  9001, 9002,
  9193, 9196,
  9200, 9200,
  9203, 9203,
  9725, 9726,
  9748, 9749,
  9776, 9783,
  9800, 9811,
  9855, 9855,
  9866, 9871,
  9875, 9875,
  9889, 9889,
  9898, 9899,
  9917, 9918,
  9924, 9925,
  9934, 9934,
  9940, 9940,
  9962, 9962,
  9970, 9971,
  9973, 9973,
  9978, 9978,
  9981, 9981,
  9989, 9989,
  9994, 9995,
  10024, 10024,
  10060, 10060,
  10062, 10062,
  10067, 10069,
  10071, 10071,
  10133, 10135,
  10160, 10160,
  10175, 10175,
  11035, 11036,
  11088, 11088,
  11093, 11093,
  11904, 11929,
  11931, 12019,
  12032, 12245,
  12272, 12287,
  12289, 12350,
  12353, 12438,
  12441, 12543,
  12549, 12591,
  12593, 12686,
  12688, 12773,
  12783, 12830,
  12832, 12871,
  12880, 42124,
  42128, 42182,
  43360, 43388,
  44032, 55203,
  63744, 64255,
  65040, 65049,
  65072, 65106,
  65108, 65126,
  65128, 65131,
  94176, 94180,
  94192, 94198,
  94208, 101589,
  101631, 101662,
  101760, 101874,
  110576, 110579,
  110581, 110587,
  110589, 110590,
  110592, 110882,
  110898, 110898,
  110928, 110930,
  110933, 110933,
  110948, 110951,
  110960, 111355,
  119552, 119638,
  119648, 119670,
  126980, 126980,
  127183, 127183,
  127374, 127374,
  127377, 127386,
  127488, 127490,
  127504, 127547,
  127552, 127560,
  127568, 127569,
  127584, 127589,
  127744, 127776,
  127789, 127797,
  127799, 127868,
  127870, 127891,
  127904, 127946,
  127951, 127955,
  127968, 127984,
  127988, 127988,
  127992, 128062,
  128064, 128064,
  128066, 128252,
  128255, 128317,
  128331, 128334,
  128336, 128359,
  128378, 128378,
  128405, 128406,
  128420, 128420,
  128507, 128591,
  128640, 128709,
  128716, 128716,
  128720, 128722,
  128725, 128728,
  128732, 128735,
  128747, 128748,
  128756, 128764,
  128992, 129003,
  129008, 129008,
  129292, 129338,
  129340, 129349,
  129351, 129535,
  129648, 129660,
  129664, 129674,
  129678, 129734,
  129736, 129736,
  129741, 129756,
  129759, 129770,
  129775, 129784,
  131072, 196605,
  196608, 262141,
];

const WIDE_FAST_PATH = findWideFastPathRange(WIDE_RANGES);

function createRegex(pattern, flags) {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

function isInRange(ranges, codePoint) {
  let low = 0;
  let high = Math.floor(ranges.length / 2) - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const index = mid * 2;

    if (codePoint < ranges[index]) {
      high = mid - 1;
    } else if (codePoint > ranges[index + 1]) {
      low = mid + 1;
    } else {
      return true;
    }
  }

  return false;
}

function findWideFastPathRange(ranges) {
  const commonCjkCodePoint = 0x4E00;
  let fastPathStart = ranges[0];
  let fastPathEnd = ranges[1];

  for (let index = 0; index < ranges.length; index += 2) {
    const start = ranges[index];
    const end = ranges[index + 1];

    if (commonCjkCodePoint >= start && commonCjkCodePoint <= end) {
      return [start, end];
    }

    if ((end - start) > (fastPathEnd - fastPathStart)) {
      fastPathStart = start;
      fastPathEnd = end;
    }
  }

  return [fastPathStart, fastPathEnd];
}

function isFullWidth(codePoint) {
  return codePoint >= 12288
    && codePoint <= 65510
    && isInRange(FULLWIDTH_RANGES, codePoint);
}

function isWide(codePoint) {
  if (codePoint >= WIDE_FAST_PATH[0] && codePoint <= WIDE_FAST_PATH[1]) {
    return true;
  }

  return codePoint >= 4352
    && codePoint <= 262141
    && isInRange(WIDE_RANGES, codePoint);
}

function eastAsianWidth(codePoint) {
  return isFullWidth(codePoint) || isWide(codePoint) ? 2 : 1;
}

function stripAnsiCodes(input) {
  if (!input.includes("\u001B") && !input.includes("\u009B")) {
    return input;
  }

  return input.replace(ANSI_REGEX, "");
}

export function stripRichTags(input) {
  return String(input).replace(RICH_TAG_REGEX, "");
}

function isCombiningMarkFallback(codePoint) {
  return (codePoint >= 0x0300 && codePoint <= 0x036F)
    || (codePoint >= 0x1AB0 && codePoint <= 0x1AFF)
    || (codePoint >= 0x1DC0 && codePoint <= 0x1DFF)
    || (codePoint >= 0x20D0 && codePoint <= 0x20FF)
    || (codePoint >= 0xFE20 && codePoint <= 0xFE2F);
}

function isDefaultIgnorableFallback(codePoint) {
  return codePoint === 0x00AD
    || codePoint === 0x034F
    || codePoint === 0x061C
    || codePoint === 0x180E
    || (codePoint >= 0x200B && codePoint <= 0x200F)
    || (codePoint >= 0x202A && codePoint <= 0x202E)
    || (codePoint >= 0x2060 && codePoint <= 0x206F)
    || (codePoint >= 0xFE00 && codePoint <= 0xFE0F)
    || codePoint === 0xFEFF
    || (codePoint >= 0xE0100 && codePoint <= 0xE01EF);
}

function isNonPrintingChar(character) {
  if (nonPrintingCharRegex) {
    return nonPrintingCharRegex.test(character);
  }

  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint <= 0x1F
    || (codePoint >= 0x7F && codePoint <= 0x9F)
    || isCombiningMarkFallback(codePoint)
    || isDefaultIgnorableFallback(codePoint)
    || (codePoint >= 0xD800 && codePoint <= 0xDFFF);
}

function isZeroWidthCluster(segment) {
  if (segment.length === 0) {
    return true;
  }

  for (const character of segment) {
    if (!isNonPrintingChar(character)) {
      return false;
    }
  }

  return true;
}

function baseVisible(segment) {
  let visible = "";
  let foundBase = false;

  for (const character of segment) {
    if (!foundBase && isNonPrintingChar(character)) {
      continue;
    }

    foundBase = true;
    visible += character;
  }

  return visible;
}

function isExtendedPictographicFallback(codePoint) {
  return (codePoint >= 0x1F000 && codePoint <= 0x1FAFF)
    || (codePoint >= 0x2600 && codePoint <= 0x27BF);
}

function countExtendedPictographic(segment) {
  if (extendedPictographicRegex) {
    const matches = segment.match(extendedPictographicRegex);
    return matches ? matches.length : 0;
  }

  let count = 0;
  for (const character of segment) {
    if (isExtendedPictographicFallback(character.codePointAt(0) ?? 0)) {
      count += 1;
    }
  }

  return count;
}

function isDoubleWidthEmojiCluster(segment) {
  if (rgiEmojiRegex?.test(segment)) {
    return true;
  }

  if (UNQUALIFIED_KEYCAP_REGEX.test(segment)) {
    return true;
  }

  const pictographicCount = countExtendedPictographic(segment);

  if (segment.includes("\u200D")) {
    return pictographicCount >= 2;
  }

  return segment.includes("\uFE0F") && pictographicCount >= 1;
}

function isHangulLeadingJamo(codePoint) {
  return (codePoint >= 0x1100 && codePoint <= 0x115F)
    || (codePoint >= 0xA960 && codePoint <= 0xA97C);
}

function isHangulVowelJamo(codePoint) {
  return (codePoint >= 0x1160 && codePoint <= 0x11A7)
    || (codePoint >= 0xD7B0 && codePoint <= 0xD7C6);
}

function isHangulTrailingJamo(codePoint) {
  return (codePoint >= 0x11A8 && codePoint <= 0x11FF)
    || (codePoint >= 0xD7CB && codePoint <= 0xD7FB);
}

function isHangulJamo(codePoint) {
  return isHangulLeadingJamo(codePoint)
    || isHangulVowelJamo(codePoint)
    || isHangulTrailingJamo(codePoint);
}

function hangulClusterWidth(visibleSegment) {
  const codePoints = [];

  for (const character of visibleSegment) {
    if (!isNonPrintingChar(character)) {
      codePoints.push(character.codePointAt(0) ?? 0);
    }
  }

  if (codePoints.length === 0) {
    return undefined;
  }

  let width = 0;

  for (let index = 0; index < codePoints.length; index += 1) {
    const codePoint = codePoints[index];

    if (!isHangulJamo(codePoint)) {
      if (width === 0) {
        return undefined;
      }

      for (let remaining = index; remaining < codePoints.length; remaining += 1) {
        width += eastAsianWidth(codePoints[remaining]);
      }

      return width;
    }

    if (
      isHangulLeadingJamo(codePoint)
      && isHangulVowelJamo(codePoints[index + 1])
    ) {
      width += 2;
      index += isHangulTrailingJamo(codePoints[index + 2]) ? 2 : 1;
      continue;
    }

    width += eastAsianWidth(codePoint);
  }

  return width;
}

function trailingHalfwidthFormsWidth(visibleSegment) {
  let extra = 0;
  let first = true;

  for (const character of visibleSegment) {
    if (first) {
      first = false;
      continue;
    }

    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint >= 0xFF00 && codePoint <= 0xFFEF) {
      extra += eastAsianWidth(codePoint);
    }
  }

  return extra;
}

function segmentText(text) {
  if (!graphemeSegmenter) {
    return [...text];
  }

  return [...graphemeSegmenter.segment(text)].map(({ segment }) => segment);
}

export function estimateDisplayWidth(input) {
  if (typeof input !== "string" || input.length === 0) {
    return 0;
  }

  let text = stripRichTags(stripAnsiCodes(input));

  if (text.length === 0) {
    return 0;
  }

  if (PRINTABLE_ASCII_REGEX.test(text)) {
    return text.length;
  }

  let width = 0;

  for (const segment of segmentText(text)) {
    if (isZeroWidthCluster(segment)) {
      continue;
    }

    if (isDoubleWidthEmojiCluster(segment)) {
      width += 2;
      continue;
    }

    const visibleSegment = baseVisible(segment);
    if (visibleSegment.length === 0) {
      continue;
    }

    const hangulWidth = hangulClusterWidth(visibleSegment);
    if (hangulWidth !== undefined) {
      width += hangulWidth;
      continue;
    }

    width += eastAsianWidth(visibleSegment.codePointAt(0) ?? 0);
    width += trailingHalfwidthFormsWidth(visibleSegment);
  }

  return width;
}
