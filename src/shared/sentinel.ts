// Token marker emitted after each command so we can detect completion and
// parse exit code + cwd out of the output stream. Unlikely to collide with
// normal shell output.
const TOKEN = 'CCTERM';

const ESCAPED = TOKEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// <TOKEN><exitcode>|<cwd up to end-of-line>, consuming the trailing newline
// of the sentinel line so it never shows as a blank line.
const RE = new RegExp(`${ESCAPED}(-?\\d+)\\|([^\\r\\n]*)\\r?\\n?`);

export function sentinelToken(): string { return TOKEN; }

export interface SentinelResult { code: number | null; cwd: string | null; }

// Longest suffix of buf that is a prefix of TOKEN — i.e. how many trailing
// chars might be the start of a split sentinel and must be held back.
function partialTail(buf: string): number {
  const max = Math.min(buf.length, TOKEN.length - 1);
  for (let k = max; k > 0; k--) {
    if (buf.slice(buf.length - k) === TOKEN.slice(0, k)) return k;
  }
  return 0;
}

export function scanSentinel(buf: string): {
  display: string;
  result: SentinelResult | null;
  remainder: string;
} {
  const m = RE.exec(buf);
  if (!m) {
    // No full sentinel. Hold back only a tail that could be a partial token.
    const keep = partialTail(buf);
    return { display: buf.slice(0, buf.length - keep), result: null, remainder: buf.slice(buf.length - keep) };
  }
  const code = parseInt(m[1], 10);
  return {
    display: buf.slice(0, m.index),
    result: { code: Number.isNaN(code) ? null : code, cwd: m[2] || null },
    remainder: buf.slice(m.index + m[0].length),
  };
}
