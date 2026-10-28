/**
 * Citation grounding — deterministic hallucination brake.
 * Every user-facing finding must pass this check.
 */

import type { DocumentPage, DroppedQuote, RiskFinding } from "@fineprint/shared";
import { cleanText, isUnreadablePage, letterShare } from "@fineprint/mcp-document";

export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export interface CitationCheck {
  kept: RiskFinding[];
  dropped: DroppedQuote[];
}

/**
 * Returns findings that are grounded in page text.
 * Ungrounded quotes are dropped from the user list (fail closed).
 */
export function validateCitations(
  findings: RiskFinding[],
  pages: DocumentPage[]
): RiskFinding[] {
  return validateCitationsDetailed(findings, pages).kept;
}

/** Same checks as validateCitations, but also reports every dropped quote and why. */
export function validateCitationsDetailed(
  findings: RiskFinding[],
  pages: DocumentPage[]
): CitationCheck {
  // The model only sees cleaned text (symbol garbage removed), so compare against the same.
  // Pages whose fonts can't be decoded are never a valid citation source.
  const byPage = new Map<number, string>();
  for (const p of pages) {
    if (isUnreadablePage(p.text)) continue;
    byPage.set(p.page, collapseWhitespace(cleanText(p.text)));
  }

  const grounded: RiskFinding[] = [];
  const dropped: DroppedQuote[] = [];
  for (const f of findings) {
    const drop = (reason: string) =>
      dropped.push({ quote: f.quote ?? "", page: f.page, reason });
    const pageText = byPage.get(f.page);
    const quote = normalizeWhitespace(cleanText(f.quote ?? ""));
    if (!pageText) {
      drop("page missing or unreadable");
      continue;
    }
    if (!quote || quote.length < 8 || quote.length > MAX_QUOTE_CHARS) {
      drop("quote length out of range");
      continue;
    }
    if (letterShare(quote) < 0.6) {
      drop("quote is mostly symbols");
      continue;
    }
    const pageLower = pageText.toLowerCase();
    const start = pageLower.indexOf(quote);
    if (start < 0) {
      drop("not in document");
      continue;
    }
    const end = start + quote.length;
    if (!onWordBoundary(pageLower, start, end)) {
      drop("quote starts or ends mid-word");
      continue;
    }
    // Store the document's own text, not the model's rendition of it.
    const exact = pageLower.length === pageText.length ? pageText.slice(start, end) : f.quote;
    grounded.push({ ...f, quote: exact, grounded: true });
  }
  return { kept: grounded, dropped };
}

/** Longest quote the persona asks for; longer ones are not a single clause. */
const MAX_QUOTE_CHARS = 300;

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

const isWordChar = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);

/** A quote may not begin or end in the middle of a word. */
function onWordBoundary(text: string, start: number, end: number): boolean {
  if (isWordChar(text[start]) && isWordChar(text[start - 1])) return false;
  if (isWordChar(text[end - 1]) && isWordChar(text[end])) return false;
  return true;
}

/** Severity sort: critical → low */
const ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function rankFindings(findings: RiskFinding[]): RiskFinding[] {
  return [...findings].sort((a, b) => {
    const sev = (ORDER[a.severity] ?? 9) - (ORDER[b.severity] ?? 9);
    if (sev !== 0) return sev;
    // Traps before expected payment lines when severity ties.
    const aPay = a.risk_type === "payment_obligation" ? 1 : 0;
    const bPay = b.risk_type === "payment_obligation" ? 1 : 0;
    return aPay - bPay;
  });
}
