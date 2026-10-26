/**
 * M3 Agent 1 — Extractor
 * Retrieves stipulation-like chunks (ReAct), extracts candidate findings, does NOT invent quotes.
 */

import { PROMPT_VERSION, type HandoffPayload } from "@fineprint/shared";
import type { DocumentPage } from "@fineprint/shared";
import { extractRisksWithModel } from "./persona.js";
import type { ProviderClient } from "./provider.js";
import {
  pagesForExtraction,
  patternHitsForQuote,
  runExtractorReasoning,
} from "./reasoning.js";
import { validateCitations } from "./validator.js";

export async function runExtractorAgent(input: {
  documentId: string;
  scanId: string;
  pages: DocumentPage[];
  provider: ProviderClient;
}): Promise<HandoffPayload> {
  const ctx = await runExtractorReasoning(input.documentId, input.pages);
  const pages = pagesForExtraction(ctx);

  const { output, model } = await extractRisksWithModel(input.provider, pages);
  const grounded = validateCitations(output.findings, input.pages);

  return {
    document_id: input.documentId,
    scan_id: input.scanId,
    prompt_version: PROMPT_VERSION,
    extractor_model: model,
    reasoning_trace: ctx.reasoning_trace,
    findings: grounded.map((f) => ({
      ...f,
      grounded: true as const,
      pattern_hits: patternHitsForQuote(f.quote, ctx.hits),
    })),
  };
}
