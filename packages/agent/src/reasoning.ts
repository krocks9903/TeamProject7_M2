/**
 * M3 reasoning pattern — lightweight ReAct loop for the Extractor agent.
 * Thought → Action (retrieve) → Observation → (repeat) → Extract
 */

import type { DocumentPage, ReasoningStep } from "@fineprint/shared";
import {
  DEFAULT_RETRIEVAL_QUERIES,
  getKnowledgeStore,
  type SearchHit,
} from "./knowledge.js";

export interface ExtractorContext {
  documentId: string;
  pages: DocumentPage[];
  hits: SearchHit[];
  reasoning_trace: ReasoningStep[];
}

/**
 * Run retrieval-augmented ReAct steps, then return context for extraction.
 */
export async function runExtractorReasoning(
  documentId: string,
  pages: DocumentPage[],
  queries: string[] = DEFAULT_RETRIEVAL_QUERIES
): Promise<ExtractorContext> {
  const knowledge = getKnowledgeStore();
  await knowledge.replaceDocumentChunks(documentId, pages);

  const reasoning_trace: ReasoningStep[] = [];
  const hitMap = new Map<string, SearchHit>();

  for (const query of queries) {
    const thought = `Look for money-loss / payment language related to: ${query}`;
    const action = `document_search(document_id, query="${query}")`;
    const hits = await knowledge.search(documentId, query, 4);
    for (const h of hits) hitMap.set(h.chunk.id, h);
    const observation =
      hits.length === 0
        ? "No matching chunks."
        : hits
            .map(
              (h) =>
                `p${h.chunk.page} score=${h.score.toFixed(1)} patterns=[${h.pattern_ids.join(",")}] :: ${h.chunk.text.slice(0, 90)}…`
            )
            .join(" | ");
    reasoning_trace.push({ thought, action, observation });
  }

  reasoning_trace.push({
    thought:
      "Synthesize retrieved chunks into candidate RiskFindings with verbatim quotes only.",
    action: "extract_structured_findings",
    observation: `Retrieved ${hitMap.size} unique chunks across ${queries.length} queries.`,
  });

  return {
    documentId,
    pages,
    hits: [...hitMap.values()].sort((a, b) => b.score - a.score),
    reasoning_trace,
  };
}

/**
 * Pages handed to the extraction model. Full pages are sent so the model sees clause context;
 * retrieval currently steers the trace and pattern tags rather than trimming the prompt.
 */
export function pagesForExtraction(ctx: ExtractorContext): DocumentPage[] {
  return ctx.pages;
}

/** Pattern ids from retrieved chunks that contain the quote (prefix match tolerates chunk boundaries). */
export function patternHitsForQuote(
  quote: string,
  hits: SearchHit[]
): string[] {
  const q = quote.toLowerCase().replace(/\s+/g, " ").trim();
  const probe = q.slice(0, Math.min(24, q.length));
  const ids = new Set<string>();
  if (!probe) return [];
  for (const h of hits) {
    const text = h.chunk.text.toLowerCase().replace(/\s+/g, " ");
    if (text.includes(q) || text.includes(probe)) {
      for (const id of h.pattern_ids) ids.add(id);
    }
  }
  return [...ids];
}
