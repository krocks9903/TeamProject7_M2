/**
 * M3 Agent 1 — Extractor
 * Retrieves stipulation-like chunks (ReAct), extracts candidate findings, does NOT invent quotes.
 * Its output passes the citation validator before it is handed to the Ranker.
 */

import { PROMPT_VERSION, type HandoffPayload } from "@fineprint/shared";
import type { DocumentPage } from "@fineprint/shared";
import { NOOP_EMITTER, type ScanEmitter } from "./events.js";
import { extractRisksWithModel } from "./persona.js";
import type { ProviderClient } from "./provider.js";
import {
  pagesForExtraction,
  patternHitsForQuote,
  runExtractorReasoning,
} from "./reasoning.js";
import { validateCitationsDetailed } from "./validator.js";

export async function runExtractorAgent(input: {
  documentId: string;
  scanId: string;
  pages: DocumentPage[];
  provider: ProviderClient;
  events?: ScanEmitter;
}): Promise<HandoffPayload> {
  const events = input.events ?? NOOP_EMITTER;
  const { provider } = input;

  await events.emit("extractor", "start", "Searching the document for money-related clauses", {
    provider: provider.name,
    model: provider.model,
  });
  const ctx = await runExtractorReasoning(input.documentId, input.pages);
  // Messages carry only our own queries and page numbers; chunk text stays in data (not in the public feed).
  for (const [i, step] of ctx.reasoning_trace.entries()) {
    const where = step.pages?.length ? `pages ${step.pages.join(", ")}` : "no matches";
    await events.emit("extractor", "progress", `Step ${i + 1}: ${step.action} → ${where}`, {
      step: i + 1,
      hits: step.pages?.length ?? 0,
      thought: step.thought,
      observation: step.observation,
    });
  }

  const pages = pagesForExtraction(ctx);
  const extractStart = Date.now();
  const { output, model } = await extractRisksWithModel(provider, pages, events);
  await events.emit(
    "extractor",
    "finish",
    `Proposed ${output.findings.length} risk${output.findings.length === 1 ? "" : "s"}`,
    {
      provider: provider.name,
      model,
      latencyMs: Date.now() - extractStart,
      proposed: output.findings.length,
    }
  );

  // Guardrail on the handoff: only quotes found verbatim in the source reach the Ranker.
  await events.emit(
    "validator",
    "start",
    `Checking ${output.findings.length} quotes against the document`
  );
  const { kept, dropped } = validateCitationsDetailed(output.findings, input.pages);
  for (const d of dropped) {
    await events.emit("validator", "progress", `Not in document: "${d.quote}"`, {
      droppedQuote: d,
    });
  }
  await events.emit(
    "validator",
    "finish",
    dropped.length
      ? `Kept ${kept.length}, threw out ${dropped.length} I couldn't find in the document`
      : `Kept all ${kept.length}: every quote found in the document`,
    { kept: kept.length, dropped: dropped.length, droppedQuotes: dropped }
  );

  return {
    document_id: input.documentId,
    scan_id: input.scanId,
    prompt_version: PROMPT_VERSION,
    extractor_model: model,
    reasoning_trace: ctx.reasoning_trace,
    proposed_count: output.findings.length,
    dropped_quotes: dropped,
    findings: kept.map((f) => ({
      ...f,
      grounded: true as const,
      pattern_hits: patternHitsForQuote(f.quote, ctx.hits),
    })),
  };
}
