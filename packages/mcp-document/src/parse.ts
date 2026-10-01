/**
 * PDF → page-mapped text. Used as an MCP tool AND imported directly by the orchestrator.
 * Owner lane: MCP / document pipeline (see docs/TEAM_OWNERSHIP.md).
 */

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { DocumentPage, ParseResult } from "@fineprint/shared";

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

  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  try {
    const doc = await loadingTask.promise;
    const pages: DocumentPage[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
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
