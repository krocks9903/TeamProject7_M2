/** Pure helper: split page text into plain and highlighted segments for quotes. */

export interface QuoteTarget {
  id: string;
  quote: string;
}

export interface Segment {
  text: string;
  /** Finding id when this segment is a quote match. */
  findingId?: string;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whitespace-insensitive match so line wraps in the PDF text don't break highlights. */
export function splitByQuotes(text: string, targets: QuoteTarget[]): Segment[] {
  const hits: Array<{ start: number; end: number; id: string }> = [];
  for (const t of targets) {
    const words = t.quote.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    const m = new RegExp(words.map(escapeRe).join("\\s+")).exec(text);
    if (m) hits.push({ start: m.index, end: m.index + m[0].length, id: t.id });
  }
  hits.sort((a, b) => a.start - b.start);

  const out: Segment[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start < cursor) continue; // overlapping quote: keep the first
    if (h.start > cursor) out.push({ text: text.slice(cursor, h.start) });
    out.push({ text: text.slice(h.start, h.end), findingId: h.id });
    cursor = h.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}
