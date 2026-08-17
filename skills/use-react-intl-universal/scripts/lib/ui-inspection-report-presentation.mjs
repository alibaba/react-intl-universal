/*
 * Purpose:
 * Bound large report presentation values, such as inline Git diffs, while
 * preserving the complete immutable artifact outside the rendered HTML.
 */

const DEFAULT_MAX_BYTES = 256 * 1024;
const DEFAULT_MAX_LINES = 2000;

/** Truncates text without exceeding a UTF-8 byte limit. */
function truncateUtf8(value, maxBytes) {
  if (Buffer.byteLength(value, 'utf8') <= maxBytes) return value;
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(value.slice(0, middle), 'utf8') <= maxBytes) low = middle;
    else high = middle - 1;
  }
  return value.slice(0, low);
}

/** Limits an inline diff by lines and UTF-8 bytes while reporting truncation. */
export function limitInlineDiff(value, {
  maxBytes = DEFAULT_MAX_BYTES,
  maxLines = DEFAULT_MAX_LINES,
} = {}) {
  const source = String(value || '');
  const lines = source.split('\n');
  const lineLimited = lines.length > maxLines ? lines.slice(0, maxLines).join('\n') : source;
  const content = truncateUtf8(lineLimited, maxBytes);
  return {
    content,
    truncated: content.length < source.length,
    sourceBytes: Buffer.byteLength(source, 'utf8'),
    sourceLines: lines.length,
  };
}
