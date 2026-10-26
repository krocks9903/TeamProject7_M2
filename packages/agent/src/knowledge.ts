/**
 * M3 knowledge layer — local chunk store (writer side).
 * Pattern library + scoring live in @fineprint/mcp-document so the `document_search` MCP tool
 * and the Extractor rank chunks identically. Supabase pgvector migration ready for cloud embeddings.
 */

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentChunk, DocumentPage } from "@fineprint/shared";
import {
  STIPULATION_PATTERNS,
  knowledgeDbPath,
  knowledgeDir,
  searchChunks,
  type SearchHit,
} from "@fineprint/mcp-document";

export { STIPULATION_PATTERNS, searchChunks, type SearchHit };

export function chunkPages(
  documentId: string,
  pages: DocumentPage[],
  chunkSize = 500,
  overlap = 80
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let idx = 0;
  for (const page of pages) {
    const text = page.text.trim();
    if (!text) continue;
    if (text.length <= chunkSize) {
      chunks.push({
        id: randomUUID(),
        document_id: documentId,
        page: page.page,
        chunk_index: idx++,
        text,
      });
      continue;
    }
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push({
        id: randomUUID(),
        document_id: documentId,
        page: page.page,
        chunk_index: idx++,
        text: text.slice(start, end),
      });
      if (end >= text.length) break;
      start = Math.max(0, end - overlap);
    }
  }
  return chunks;
}

/** Default retrieval queries covering money-loss + payment patterns. */
export const DEFAULT_RETRIEVAL_QUERIES = [
  "early termination fee cancel",
  "automatic renewal notice days",
  "security deposit non-refundable retainer",
  "late fee past due",
  "monthly rent rental fee payment",
  "arbitration liability expense",
];

interface KnowledgeDb {
  chunks: DocumentChunk[];
}

export class KnowledgeStore {
  private dbPath: string;

  constructor(root = knowledgeDir()) {
    this.dbPath = knowledgeDbPath(root);
  }

  private async load(): Promise<KnowledgeDb> {
    await mkdir(path.dirname(this.dbPath), { recursive: true });
    try {
      return JSON.parse(await readFile(this.dbPath, "utf8")) as KnowledgeDb;
    } catch {
      return { chunks: [] };
    }
  }

  private async save(db: KnowledgeDb): Promise<void> {
    await mkdir(path.dirname(this.dbPath), { recursive: true });
    await writeFile(this.dbPath, JSON.stringify(db, null, 2), "utf8");
  }

  async replaceDocumentChunks(
    documentId: string,
    pages: DocumentPage[]
  ): Promise<DocumentChunk[]> {
    const db = await this.load();
    db.chunks = db.chunks.filter((c) => c.document_id !== documentId);
    const fresh = chunkPages(documentId, pages);
    db.chunks.push(...fresh);
    await this.save(db);
    return fresh;
  }

  async getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
    const db = await this.load();
    return db.chunks.filter((c) => c.document_id === documentId);
  }

  async search(
    documentId: string,
    query: string,
    topK = 6
  ): Promise<SearchHit[]> {
    const chunks = await this.getDocumentChunks(documentId);
    return searchChunks(chunks, query, topK);
  }
}

let knowledgeSingleton: KnowledgeStore | null = null;

export function getKnowledgeStore(): KnowledgeStore {
  if (!knowledgeSingleton) {
    knowledgeSingleton = new KnowledgeStore();
  }
  return knowledgeSingleton;
}

export function resetKnowledgeStoreForTests(root: string): KnowledgeStore {
  knowledgeSingleton = new KnowledgeStore(root);
  return knowledgeSingleton;
}

export function patternLibraryHash(): string {
  return createHash("sha256")
    .update(JSON.stringify(STIPULATION_PATTERNS.map((p) => p.id)))
    .digest("hex")
    .slice(0, 12);
}
