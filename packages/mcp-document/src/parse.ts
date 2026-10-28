/**
 * PDF → page-mapped text. Used as an MCP tool AND imported directly by the orchestrator.
 * Owner lane: MCP / document pipeline (see docs/TEAM_OWNERSHIP.md).
 */

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { DocumentPage, ParseResult } from "@fineprint/shared";

/**
 * PDFs often draw titles as spaced glyphs ("E a r l y T e r m").
 * Collapse letter-spacing but keep a space before a new Capital letter (new word).
 * Word boundaries keep ordinary prose intact: "end of a one-year" must not become "ofaone-year".
 */
export function collapseSpacedLetters(text: string): string {
  return text.replace(/\b(?:[A-Za-z] ){2,}[A-Za-z]\b/g, (run) => {
    const parts = run.split(" ");
    if (!parts.every((p) => p.length === 1)) return run;
    let out = parts[0] ?? "";
    for (let i = 1; i < parts.length; i++) {
      const ch = parts[i] ?? "";
      const prev = parts[i - 1] ?? "";
      if (/[A-Z]/.test(ch) && /[a-z]/.test(prev)) out += ` ${ch}`;
      else out += ch;
    }
    return out;
  });
}

export function normalizePageText(text: string): string {
  let t = collapseSpacedLetters(text.replace(/\s+/g, " ")).trim();
  // Repair common glue from "a" + letter-spaced word ("Lessoramonthly", "remitarecurring").
  t = t.replace(
    /\b(Lessor|Lessee|Tenant|Landlord|shall|pay|remit)a(monthly|recurring)\b/gi,
    "$1 a $2"
  );
  t = t.replace(/([a-z])a(monthly|recurring)\b/gi, "$1 a $2");
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Parse a PDF buffer into per-page text suitable for citation checks.
 *
 * Uses pdfjs-dist directly instead of the `pdf-parse` package: pdf-parse
 * bundles a years-old, frozen pdf.js build that throws "bad XRef entry" /
 * "Command token too long" on some perfectly valid, standards-compliant PDFs
 * (verified against byte-accurate xref tables from multiple generators) —
 * a real risk for user-uploaded leases, not just synthetic test fixtures.
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<ParseResult> {
  if (!buffer?.length) {
    return {
      pages: [],
      meta: { pageCount: 0, charCount: 0, empty: true },
    };
  }

  // pdf.js misreads Node Buffers (reads the wrong backing bytes); hand it a plain, standalone Uint8Array.
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  const loadingTask = getDocument({
    data: bytes,
    useSystemFonts: true,
  });

  try {
    const doc = await loadingTask.promise;
    const pages: DocumentPage[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = normalizePageText(
        content.items.map((item) => ("str" in item ? item.str : "")).join(" ")
      );
      pages.push({ page: i, text });
    }

    const charCount = pages.reduce((n, p) => n + p.text.length, 0);
    return {
      pages,
      meta: {
        pageCount: pages.length,
        charCount,
        empty: charCount === 0,
      },
    };
  } finally {
    await loadingTask.destroy();
  }
}

export function pagesToAgentContext(pages: DocumentPage[], maxChars = 24_000): string {
  const parts: string[] = [];
  let used = 0;
  for (const p of pages) {
    const block = `--- PAGE ${p.page} ---\n${p.text}\n`;
    if (used + block.length > maxChars) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join("\n");
}
