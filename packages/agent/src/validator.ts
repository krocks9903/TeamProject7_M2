/**
 * Citation grounding — deterministic hallucination brake.
 * Every user-facing finding must pass this check.
 */

import type { DocumentPage, RiskFinding } from "@fineprint/shared";

export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Returns findings that are grounded in page text.
 * Ungrounded quotes are dropped from the user list (fail closed).
 */
export function validateCitations(
  findings: RiskFinding[],
  pages: DocumentPage[]
): RiskFinding[] {
  const byPage = new Map<number, string>();
  for (const p of pages) {
    byPage.set(p.page, normalizeWhitespace(p.text));
  }

  const grounded: RiskFinding[] = [];
  for (const f of findings) {
    const pageText = byPage.get(f.page);
    const quote = normalizeWhitespace(f.quote ?? "");
    if (!pageText || !quote || quote.length < 8) {
      continue;
    }
    if (!pageText.includes(quote)) {
      continue;
    }
    grounded.push({ ...f, grounded: true });
  }
  return grounded;
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
