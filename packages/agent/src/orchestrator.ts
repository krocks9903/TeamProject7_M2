/**
 * Scan orchestrator — M3 multi-agent pipeline:
 * queued → parsing → analyzing (Extractor: ReAct retrieval + extract + citation check)
 *        → validating (Ranker: severity + plain_english; quotes frozen) → done | failed
 *
 * Every real step also emits a ScanEvent (see events.ts) for Mission Control.
 *
 * Teammates: extend extraction in persona.ts; do not bypass citation validation.
 */

import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES_DEFAULT,
  type CreateScanResponse,
  type ScanAgentId,
  type ScanDetail,
  type ScanEvent,
} from "@fineprint/shared";
import { parsePdfBuffer, unreadablePages } from "@fineprint/mcp-document";
import { EventEmitter, TeeSink } from "./events.js";
import { runExtractorAgent } from "./extractor.js";
import { getKnowledgeStore } from "./knowledge.js";
import { resolveProvider } from "./provider.js";
import { runRankerAgent } from "./ranker.js";
import { getStore, sha256, type LocalStore } from "./store.js";

export interface UploadInput {
  ownerId: string;
  filename: string;
  mime: string;
  buffer: Buffer;
}

type Created = Awaited<ReturnType<Orchestrator["create"]>>;

export class Orchestrator {
  private emitters = new Map<string, EventEmitter>();
  private activeAgent = new Map<string, ScanAgentId>();

  constructor(private store: LocalStore = getStore()) {}

  private emitterFor(scanId: string): EventEmitter {
    let e = this.emitters.get(scanId);
    if (!e) {
      e = new EventEmitter(scanId, new TeeSink(this.store.events, this.store.feed));
      this.emitters.set(scanId, e);
    }
    return e;
  }

  private checkUpload(input: UploadInput): void {
    const maxBytes = Number(
      process.env.MAX_UPLOAD_BYTES ?? MAX_UPLOAD_BYTES_DEFAULT
    );
    if (!ALLOWED_MIME.includes(input.mime as (typeof ALLOWED_MIME)[number])) {
      throw new Error("Only application/pdf uploads are allowed");
    }
    if (input.buffer.length === 0) {
      throw new Error("Empty PDF rejected");
    }
    if (input.buffer.length > maxBytes) {
      throw new Error(`PDF exceeds max size of ${maxBytes} bytes`);
    }
  }

  /** Validates and stores the upload and creates the scan row; does not run the pipeline. */
  private async create(input: UploadInput) {
    this.checkUpload(input);
    const provider = resolveProvider();
    const hash = sha256(input.buffer);
    const cached = await this.store.findCachedScan(hash, provider.model);
    const doc = await this.store.savePdf(
      input.ownerId,
      input.filename,
      input.mime,
      input.buffer
    );
    const scan = await this.store.createScan({
      document_id: doc.id,
      owner_id: input.ownerId,
      content_sha256: hash,
      model: provider.model,
    });
    await this.emitterFor(scan.id).emit("intake", "start", `Received ${input.filename}`, {
      filename: input.filename,
      bytes: input.buffer.length,
    });
    return { doc, scan, cached, input };
  }

  private async runCreated(c: Created): Promise<void> {
    const { doc, scan, cached, input } = c;
    const events = this.emitterFor(scan.id);
    try {
      if (cached) {
        // Reuse the cached findings on a new scan row, and parse once for this document's pages.
        await this.store.replaceFindings(
          scan.id,
          cached.findings.map(({ id: _id, scan_id: _s, ...rest }) => rest)
        );
        const pages = await parsePdfBuffer(input.buffer);
        await this.store.setPages(doc.id, pages.pages);
        // New document id: re-chunk so document_search works for the cached copy too.
        await getKnowledgeStore().replaceDocumentChunks(doc.id, pages.pages);
        await this.store.updateScanStatus(scan.id, "done");
        await events.emit(
          "intake",
          "finish",
          `Seen this exact file before: reused ${cached.findings.length} saved findings`,
          {
            filename: input.filename,
            bytes: input.buffer.length,
            cacheHit: true,
            pageCount: pages.meta.pageCount,
            findings: cached.findings.length,
            scanDone: true,
          }
        );
        return;
      }
      await events.emit("intake", "finish", "File accepted: PDF, size OK", {
        filename: input.filename,
        bytes: input.buffer.length,
        cacheHit: false,
      });
      await this.processScan(scan.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.store.updateScanStatus(scan.id, "failed", message);
      await events.emit(this.activeAgent.get(scan.id) ?? "intake", "error", message, {
        scanFailed: true,
      });
      throw err;
    } finally {
      this.emitters.delete(scan.id);
      this.activeAgent.delete(scan.id);
    }
  }

  async createAndProcess(input: UploadInput): Promise<CreateScanResponse> {
    const c = await this.create(input);
    await this.runCreated(c);
    const updated = await this.store.getScan(c.scan.id);
    return {
      scan_id: c.scan.id,
      document_id: c.doc.id,
      status: updated?.status ?? "failed",
      cache_hit: Boolean(c.cached),
    };
  }

  /** Like createAndProcess, but returns once the scan exists; the pipeline runs in the background. */
  async startScan(input: UploadInput): Promise<CreateScanResponse> {
    const c = await this.create(input);
    void this.runCreated(c).catch(() => {
      // already recorded on the scan row and as an error event
    });
    return {
      scan_id: c.scan.id,
      document_id: c.doc.id,
      status: "queued",
      cache_hit: Boolean(c.cached),
    };
  }

  async getScanStatus(scanId: string) {
    return (await this.store.getScan(scanId))?.status ?? null;
  }

  async getEvents(scanId: string, afterSeq = 0): Promise<ScanEvent[]> {
    return this.store.events.list(scanId, afterSeq);
  }

  async processScan(scanId: string): Promise<void> {
    const scan = await this.store.getScan(scanId);
    if (!scan) throw new Error(`scan not found: ${scanId}`);
    const events = this.emitterFor(scanId);
    const phase = (agent: ScanAgentId) => this.activeAgent.set(scanId, agent);

    phase("parser");
    await this.store.updateScanStatus(scanId, "parsing");
    await events.emit("parser", "start", "Opening the PDF (document_parse)");
    const buffer = await this.store.readPdf(scan.document_id);
    const parsed = await parsePdfBuffer(buffer);
    if (parsed.meta.empty) {
      throw new Error("PDF produced no extractable text (empty or encrypted)");
    }
    await this.store.setPages(scan.document_id, parsed.pages);
    const unreadable = unreadablePages(parsed.pages).length;
    await events.emit(
      "parser",
      "finish",
      `Read ${parsed.meta.pageCount} page${parsed.meta.pageCount === 1 ? "" : "s"}` +
        (unreadable ? `, ${unreadable} unreadable` : ""),
      { pageCount: parsed.meta.pageCount, unreadablePages: unreadable }
    );

    // Agent 1 — Extractor (ReAct retrieval + structured extract + citation check)
    phase("extractor");
    await this.store.updateScanStatus(scanId, "analyzing");
    const provider = resolveProvider();
    const handoff = await runExtractorAgent({
      documentId: scan.document_id,
      scanId,
      pages: parsed.pages,
      provider,
      events,
    });

    // Agent 2 — Ranker (rewrite/rank only; quotes frozen)
    phase("ranker");
    await this.store.updateScanStatus(scanId, "validating");
    await events.emit(
      "ranker",
      "start",
      `Handoff from Extractor: ${handoff.findings.length} grounded risks, ` +
        `${handoff.reasoning_trace.length} reasoning steps`,
      { kept: handoff.findings.length }
    );
    const { findings, handoff: rankedHandoff, severity_raised } = runRankerAgent(handoff);
    await this.store.replaceFindings(
      scanId,
      findings.map((f) => ({
        ...f,
        grounded: true as const,
      }))
    );

    await this.store.updateScanStatus(scanId, "done");
    await events.emit(
      "ranker",
      "finish",
      `Ranked ${findings.length} risks` +
        (severity_raised ? `, raised severity on ${severity_raised}` : "") +
        ", scan complete",
      {
        ranked: findings.length,
        findings: findings.length,
        severityRaised: severity_raised,
        scanDone: true,
      }
    );

    console.info(
      JSON.stringify({
        event: "scan_done",
        scan_id: scanId,
        // scan.model stays the provider model: the content-hash cache keys on it.
        model: `${rankedHandoff.extractor_model}+ranker`,
        finding_count: findings.length,
        page_count: parsed.meta.pageCount,
        reasoning_steps: rankedHandoff.reasoning_trace.length,
        proposed: rankedHandoff.proposed_count,
        dropped: rankedHandoff.dropped_quotes?.length ?? 0,
        agents: ["extractor", "ranker"],
      })
    );
  }

  async getScanDetail(scanId: string): Promise<ScanDetail | null> {
    const scan = await this.store.getScan(scanId);
    if (!scan) return null;
    const document = await this.store.getDocument(scan.document_id);
    if (!document) return null;
    const findings = await this.store.getFindings(scanId);
    const pages = (await this.store.getPages(scan.document_id)) ?? undefined;
    return { scan, document, findings, pages };
  }
}

export function getOrchestrator(): Orchestrator {
  return new Orchestrator(getStore());
}
