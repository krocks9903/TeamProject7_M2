/**
 * PDF → page-mapped text. Used as an MCP tool AND imported directly by the orchestrator.
 * Owner lane: MCP / document pipeline (see docs/TEAM_OWNERSHIP.md).
 */

import { createRequire } from "node:module";
import type { DocumentPage, ParseResult } from "@fineprint/shared";

const require = createRequire(import.meta.url);
// pdf-parse is CJS; default export is the parse function in Node.
const pdfParse = require("pdf-parse") as (
  data: Uint8Array,
  options?: { pagerender?: (pageData: PdfPageData) => Promise<string> }
) => Promise<{ text: string; numpages: number; info?: unknown }>;

interface PdfPageData {
  pageIndex: number;
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
}

async function renderPage(pageData: PdfPageData): Promise<string> {
  const content = await pageData.getTextContent();
  const strings = content.items
    .map((item) => (typeof item.str === "string" ? item.str : ""))
    .filter(Boolean);
  return strings.join(" ");
}

/**
 * PDFs often draw titles as spaced glyphs ("E a r l y T e r m").
 * Collapse letter-spacing but keep a space before a new Capital letter (new word).
 */
export function collapseSpacedLetters(text: string): string {
  return text.replace(/(?:[A-Za-z] ){2,}[A-Za-z]/g, (run) => {
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
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<ParseResult> {
  if (!buffer?.length) {
    return {
      pages: [],
      meta: { pageCount: 0, charCount: 0, empty: true },
    };
  }

  const pageTexts: string[] = [];
  // pdf.js misreads Node Buffers (reads the wrong backing bytes); hand it a plain, standalone Uint8Array.
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  const data = await pdfParse(bytes, {
    pagerender: async (pageData) => {
      const text = await renderPage(pageData);
      pageTexts[pageData.pageIndex] = text;
      return text;
    },
  });

  const pages: DocumentPage[] = [];
  const count = Math.max(data.numpages || 0, pageTexts.length);

  for (let i = 0; i < count; i++) {
    const text = normalizePageText(pageTexts[i] ?? "");
    pages.push({ page: i + 1, text });
  }

  // Fallback: some PDFs only populate aggregate text via pdf-parse.
  if (pages.every((p) => !p.text) && data.text?.trim()) {
    const fallback = normalizePageText(data.text);
    return {
      pages: [{ page: 1, text: fallback }],
      meta: {
        pageCount: 1,
        charCount: fallback.length,
        empty: fallback.length === 0,
      },
    };
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
