/**
 * Knowledge layer primitives shared by the agent (writer) and the `document_search` MCP tool (reader):
 * stipulation pattern library, chunk scoring, and the on-disk chunk location.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentChunk, RiskType, StipulationPattern } from "@fineprint/shared";

export const STIPULATION_PATTERNS: StipulationPattern[] = [
  {
    id: "pat_early_term",
    risk_type: "early_termination",
    label: "Early termination fee",
    keywords: ["early termination", "termination fee", "break the lease", "cancel early"],
    description: "Fee or remaining rent if the signer ends early.",
  },
  {
    id: "pat_auto_renew",
    risk_type: "auto_renewal",
    label: "Auto-renewal",
    keywords: ["renews automatically", "automatic renewal", "auto-renew", "successive"],
    description: "Agreement renews unless timely notice is given.",
  },
  {
    id: "pat_deposit",
    risk_type: "deposit_forfeiture",
    label: "Deposit / non-refundable retainer",
    keywords: ["security deposit", "non-refundable", "forfeit", "retainer"],
    description: "Money that may be withheld or is non-refundable.",
  },
  {
    id: "pat_late_fee",
    risk_type: "late_fee",
    label: "Late fee",
    keywords: ["late fee", "late charge", "past due", "per day"],
    description: "Penalty when payment is late.",
  },
  {
    id: "pat_notice",
    risk_type: "notice_window",
    label: "Notice window",
    keywords: ["days written notice", "notice of non-renewal", "notice deadline"],
    description: "Deadline to cancel or give notice.",
  },
  {
    id: "pat_payment",
    risk_type: "payment_obligation",
    label: "Scheduled payment",
    keywords: ["monthly rent", "rental fee", "per hour", "per month", "maintenance retainer"],
    description: "Expected amounts the signer will pay.",
  },
  {
    id: "pat_liability",
    risk_type: "liability_shift",
    label: "Liability shift",
    keywords: ["sole expense", "shall be responsible", "indemnify"],
    description: "Costs shifted onto the signer.",
  },
  {
    id: "pat_arb",
    risk_type: "mandatory_arbitration",
    label: "Mandatory arbitration",
    keywords: ["binding arbitration", "waive", "jury"],
    description: "Disputes forced into arbitration.",
  },
];

export interface SearchHit {
  chunk: DocumentChunk;
  score: number;
  pattern_ids: string[];
  risk_types: RiskType[];
}

function scoreText(hay: string, query: string): number {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9$%]+/)
    .filter((t) => t.length > 2);
  let score = 0;
  for (const t of tokens) {
    if (hay.includes(t)) score += 1;
  }
  return score;
}

/** Keyword + pattern scoring. Patterns named by the query score higher than incidental matches. */
export function searchChunks(
  chunks: DocumentChunk[],
  query: string,
  topK = 6
): SearchHit[] {
  const q = query.trim().toLowerCase();
  const hits: SearchHit[] = [];
  for (const chunk of chunks) {
    const text = chunk.text.toLowerCase();
    let score = scoreText(text, q);
    const pattern_ids: string[] = [];
    const risk_types = new Set<RiskType>();
    for (const pat of STIPULATION_PATTERNS) {
      if (!pat.keywords.some((kw) => text.includes(kw))) continue;
      const named = !q || pat.keywords.some((kw) => q.includes(kw));
      score += named ? 2 : 0.5;
      pattern_ids.push(pat.id);
      risk_types.add(pat.risk_type);
    }
    if (score > 0) {
      hits.push({ chunk, score, pattern_ids, risk_types: [...risk_types] });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, topK);
}

export function knowledgeDir(): string {
  if (process.env.FINEPRINT_KNOWLEDGE_DIR) return process.env.FINEPRINT_KNOWLEDGE_DIR;
  const dataDir = process.env.FINEPRINT_DATA_DIR ?? path.join(process.cwd(), "data");
  return path.join(dataDir, "knowledge");
}

export function knowledgeDbPath(root = knowledgeDir()): string {
  return path.join(root, "chunks.json");
}

/** Read-only search used by the MCP tool; chunks are written by the agent's KnowledgeStore. */
export async function searchDocumentChunks(
  documentId: string,
  query: string,
  topK = 6
): Promise<Array<{ page: number; score: number; pattern_ids: string[]; text: string }>> {
  let chunks: DocumentChunk[] = [];
  try {
    const db = JSON.parse(await readFile(knowledgeDbPath(), "utf8")) as { chunks: DocumentChunk[] };
    chunks = db.chunks.filter((c) => c.document_id === documentId);
  } catch {
    return [];
  }
  return searchChunks(chunks, query, topK).map((h) => ({
    page: h.chunk.page,
    score: h.score,
    pattern_ids: h.pattern_ids,
    text: h.chunk.text.slice(0, 400),
  }));
}
