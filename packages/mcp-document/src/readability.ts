/**
 * Detects and cleans text that PDF fonts with broken Unicode maps produce.
 * Some PDFs (printed-to-PDF forms, fee sheets, add-on addenda) decode to rows of
 * dingbat symbols or punctuation soup instead of words. That text can't be scanned,
 * so we strip it from what the model sees and tell the user which pages were skipped.
 */

import type { DocumentPage } from "@fineprint/shared";

/** Arrows, box/shape/dingbat blocks, private-use glyphs, replacement character. */
const SYMBOL_CHARS = "\\u2190-\\u21FF\\u2500-\\u27BF\\u2900-\\u297F\\u2B00-\\u2BFF\\uE000-\\uF8FF\\uFFFD";
const SYMBOL_RUN_RE = new RegExp(`[${SYMBOL_CHARS}]+`, "g");
const SYMBOL_ONE_RE = new RegExp(`[${SYMBOL_CHARS}]`, "g");

const STOPWORDS = new Set(
  "the and of to a in you your is for or we will be this that with any by as on are our it not if an at from all may must".split(
    " "
  )
);

/** Removes symbol-glyph runs and collapses whitespace. */
export function cleanText(text: string): string {
  return text.replace(SYMBOL_RUN_RE, " ").replace(/\s+/g, " ").trim();
}

export interface Readability {
  symbolShare: number;
  punctShare: number;
  stopShare: number;
  unreadable: boolean;
}

export function measureReadability(text: string): Readability {
  const compact = text.replace(/\s/g, "");
  if (compact.length < 20) {
    return { symbolShare: 0, punctShare: 0, stopShare: 1, unreadable: false };
  }
  const symbols = (text.match(SYMBOL_ONE_RE) ?? []).length;
  const punct = (compact.match(/[^A-Za-z0-9À-ɏ]/g) ?? []).length - symbols;
  const words = cleanText(text).toLowerCase().match(/[a-z']+/g) ?? [];
  const stops = words.filter((w) => STOPWORDS.has(w)).length;

  const symbolShare = symbols / compact.length;
  const punctShare = Math.max(0, punct) / compact.length;
  const stopShare = words.length ? stops / words.length : 0;

  // Real prose is ~30-45% common words. Garbled pages are mostly symbols or punctuation soup.
  const unreadable = stopShare < 0.12 && (symbolShare >= 0.35 || punctShare >= 0.25);
  return { symbolShare, punctShare, stopShare, unreadable };
}

export function isUnreadablePage(text: string): boolean {
  return measureReadability(text).unreadable;
}

/** Page numbers whose text can't be read (sorted). */
export function unreadablePages(pages: DocumentPage[]): number[] {
  return pages.filter((p) => isUnreadablePage(p.text)).map((p) => p.page).sort((a, b) => a - b);
}

/** Share of non-space characters that are letters; low means the quote is mostly symbols. */
export function letterShare(text: string): number {
  const compact = text.replace(/\s/g, "");
  if (!compact) return 0;
  return (compact.match(/[A-Za-z]/g) ?? []).length / compact.length;
}

/**
 * Splits a document into model-sized chunks of cleaned, readable pages.
 * Every readable page is included; nothing is silently dropped past a size limit.
 */
export function chunkPagesForAgent(pages: DocumentPage[], maxChars = 28_000): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const p of pages) {
    if (isUnreadablePage(p.text)) continue;
    const body = cleanText(p.text);
    if (body.length < 10) continue;
    const header = `--- PAGE ${p.page} ---\n`;
    // Oversized pages are split across blocks (each re-labelled) instead of truncated.
    const room = Math.max(1, maxChars - header.length - 2);
    for (let i = 0; i < body.length; i += room) {
      const block = `${header}${body.slice(i, i + room)}\n\n`;
      if (current && current.length + block.length > maxChars) {
        chunks.push(current);
        current = "";
      }
      current += block;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
