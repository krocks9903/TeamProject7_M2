/**
 * Persistence boundary. Default = local JSON under ./data so teammates can run without Supabase.
 * Swap to Supabase by setting STORAGE_BACKEND=supabase (same interface).
 */

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  DocumentPage,
  DocumentRecord,
  FindingRecord,
  ScanRecord,
  ScanStatus,
} from "@fineprint/shared";
import { PROMPT_VERSION } from "@fineprint/shared";
import { GlobalFeed, JsonlEventSink } from "./events.js";

export interface StorePaths {
  root: string;
}

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

interface LocalDb {
  documents: DocumentRecord[];
  scans: ScanRecord[];
  findings: FindingRecord[];
  pages: Record<string, DocumentPage[]>; // document_id -> pages
}

function emptyDb(): LocalDb {
  return { documents: [], scans: [], findings: [], pages: {} };
}

export class LocalStore {
  private root: string;
  private dbPath: string;
  private filesDir: string;
  /** Live scan events, stored beside the scan data (Supabase-ready via EventSink). */
  readonly events: JsonlEventSink;
  /** Sanitized events of all scans, for the private Mission Control screen. */
  readonly feed: GlobalFeed;

  constructor(root = path.join(process.cwd(), "data")) {
    this.events = new JsonlEventSink(path.join(root, "events"));
    this.feed = new GlobalFeed(path.join(root, "events"));
    this.root = root;
    this.dbPath = path.join(root, "db.json");
    this.filesDir = path.join(root, "files");
  }

  private async ensure(): Promise<void> {
    await mkdir(this.filesDir, { recursive: true });
  }

  private async load(): Promise<LocalDb> {
    await this.ensure();
    try {
      const raw = await readFile(this.dbPath, "utf8");
      return JSON.parse(raw) as LocalDb;
    } catch {
      return emptyDb();
    }
  }

  private async save(db: LocalDb): Promise<void> {
    await this.ensure();
    await writeFile(this.dbPath, JSON.stringify(db, null, 2), "utf8");
  }

  async savePdf(
    ownerId: string,
    filename: string,
    mime: string,
    buffer: Buffer
  ): Promise<DocumentRecord> {
    const db = await this.load();
    const id = randomUUID();
    const hash = sha256(buffer);
    const storage_path = path.join(this.filesDir, `${id}.pdf`);
    await writeFile(storage_path, buffer);
    const doc: DocumentRecord = {
      id,
      owner_id: ownerId,
      storage_path,
      content_sha256: hash,
      mime,
      bytes: buffer.length,
      original_filename: filename,
      status: "uploaded",
      created_at: new Date().toISOString(),
    };
    db.documents.push(doc);
    await this.save(db);
    return doc;
  }

  async readPdf(documentId: string): Promise<Buffer> {
    const db = await this.load();
    const doc = db.documents.find((d) => d.id === documentId);
    if (!doc) throw new Error(`document not found: ${documentId}`);
    return readFile(doc.storage_path);
  }

  async getDocument(documentId: string): Promise<DocumentRecord | null> {
    const db = await this.load();
    return db.documents.find((d) => d.id === documentId) ?? null;
  }

  async setPages(documentId: string, pages: DocumentPage[]): Promise<void> {
    const db = await this.load();
    db.pages[documentId] = pages;
    const doc = db.documents.find((d) => d.id === documentId);
    if (doc) doc.status = "parsed";
    await this.save(db);
  }

  async getPages(documentId: string): Promise<DocumentPage[] | null> {
    const db = await this.load();
    return db.pages[documentId] ?? null;
  }

  async createScan(input: {
    document_id: string;
    owner_id: string;
    content_sha256: string;
    model: string;
  }): Promise<ScanRecord> {
    const db = await this.load();
    const now = new Date().toISOString();
    const scan: ScanRecord = {
      id: randomUUID(),
      document_id: input.document_id,
      owner_id: input.owner_id,
      status: "queued",
      model: input.model,
      prompt_version: PROMPT_VERSION,
      error: null,
      content_sha256: input.content_sha256,
      created_at: now,
      updated_at: now,
    };
    db.scans.push(scan);
    await this.save(db);
    return scan;
  }

  async updateScanStatus(
    scanId: string,
    status: ScanStatus,
    error: string | null = null
  ): Promise<ScanRecord> {
    const db = await this.load();
    const scan = db.scans.find((s) => s.id === scanId);
    if (!scan) throw new Error(`scan not found: ${scanId}`);
    scan.status = status;
    scan.error = error;
    scan.updated_at = new Date().toISOString();
    await this.save(db);
    return scan;
  }

  async replaceFindings(
    scanId: string,
    findings: Omit<FindingRecord, "id" | "scan_id">[]
  ): Promise<FindingRecord[]> {
    const db = await this.load();
    db.findings = db.findings.filter((f) => f.scan_id !== scanId);
    const saved: FindingRecord[] = findings.map((f) => ({
      ...f,
      id: randomUUID(),
      scan_id: scanId,
    }));
    db.findings.push(...saved);
    await this.save(db);
    return saved;
  }

  async getScan(scanId: string): Promise<ScanRecord | null> {
    const db = await this.load();
    return db.scans.find((s) => s.id === scanId) ?? null;
  }

  async getFindings(scanId: string): Promise<FindingRecord[]> {
    const db = await this.load();
    return db.findings.filter((f) => f.scan_id === scanId);
  }

  /**
   * Content-hash cache: prior done scan with same hash + prompt + model.
   */
  async findCachedScan(
    contentSha256: string,
    model: string
  ): Promise<{ scan: ScanRecord; findings: FindingRecord[] } | null> {
    const db = await this.load();
    const hit = [...db.scans]
      .reverse()
      .find(
        (s) =>
          s.content_sha256 === contentSha256 &&
          s.model === model &&
          s.prompt_version === PROMPT_VERSION &&
          s.status === "done"
      );
    if (!hit) return null;
    return { scan: hit, findings: db.findings.filter((f) => f.scan_id === hit.id) };
  }
}

let singleton: LocalStore | null = null;

export function getStore(): LocalStore {
  if (!singleton) {
    const root = process.env.FINEPRINT_DATA_DIR
      ? process.env.FINEPRINT_DATA_DIR
      : path.join(process.cwd(), "data");
    singleton = new LocalStore(root);
  }
  return singleton;
}

export function resetStoreForTests(root: string): LocalStore {
  singleton = new LocalStore(root);
  return singleton;
}
