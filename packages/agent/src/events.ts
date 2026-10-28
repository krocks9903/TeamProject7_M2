/**
 * Live scan events. The orchestrator emits one event per real pipeline step.
 * Persistence goes through EventSink so a Supabase table can replace the JSONL files.
 */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  FeedEvent,
  ScanAgentId,
  ScanEvent,
  ScanEventData,
  ScanEventType,
} from "@fineprint/shared";

export interface EventSink {
  append(event: ScanEvent): Promise<void>;
  list(scanId: string, afterSeq?: number): Promise<ScanEvent[]>;
}

/** Append-only JSONL, one file per scan, so concurrent writers never clobber db.json. */
export class JsonlEventSink implements EventSink {
  constructor(private dir: string) {}

  private file(scanId: string): string {
    // scan ids are UUIDs; strip anything else so an id can't escape the directory
    return path.join(this.dir, `${scanId.replace(/[^a-zA-Z0-9-]/g, "")}.jsonl`);
  }

  async append(event: ScanEvent): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await appendFile(this.file(event.scanId), JSON.stringify(event) + "\n", "utf8");
  }

  async list(scanId: string, afterSeq = 0): Promise<ScanEvent[]> {
    let raw: string;
    try {
      raw = await readFile(this.file(scanId), "utf8");
    } catch {
      return [];
    }
    const out: ScanEvent[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as ScanEvent;
        if (e.seq > afterSeq) out.push(e);
      } catch {
        // a half-written trailing line is skipped; the next read sees it whole
      }
    }
    return out.sort((a, b) => a.seq - b.seq);
  }
}

export class MemoryEventSink implements EventSink {
  private events: ScanEvent[] = [];
  async append(event: ScanEvent): Promise<void> {
    this.events.push(event);
  }
  async list(scanId: string, afterSeq = 0): Promise<ScanEvent[]> {
    return this.events.filter((e) => e.scanId === scanId && e.seq > afterSeq);
  }
}

export interface ScanEmitter {
  emit(
    agent: ScanAgentId,
    type: ScanEventType,
    message: string,
    data?: ScanEventData
  ): Promise<ScanEvent>;
}

/**
 * Stamps scanId, ts and seq, then persists. Writes are chained so seq order equals file order.
 * A failing sink is logged and swallowed: telemetry must never break a scan.
 */
export class EventEmitter implements ScanEmitter {
  private seq = 0;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private scanId: string,
    private sink: EventSink,
    private now: () => number = Date.now
  ) {}

  emit(
    agent: ScanAgentId,
    type: ScanEventType,
    message: string,
    data?: ScanEventData
  ): Promise<ScanEvent> {
    const event: ScanEvent = {
      scanId: this.scanId,
      ts: this.now(),
      seq: ++this.seq,
      agent,
      type,
      message,
      ...(data ? { data } : {}),
    };
    const write = this.chain.then(() => this.sink.append(event)).catch((err) => {
      console.warn("scan event not persisted:", err instanceof Error ? err.message : err);
    });
    this.chain = write;
    return write.then(() => event);
  }
}

export const NOOP_EMITTER: ScanEmitter = {
  async emit(agent, type, message, data) {
    return { scanId: "", ts: Date.now(), seq: 0, agent, type, message, ...(data ? { data } : {}) };
  },
};

// ---------------------------------------------------------------- global feed
//
// A second, sanitized copy of every event, readable without a scan id. It is what the private
// Mission Control screen watches. It never contains quotes or document text.

/** Event data fields that are safe to publish: counts, timing and model labels only. */
const FEED_DATA_KEYS = [
  "bytes",
  "cacheHit",
  "pageCount",
  "unreadablePages",
  "provider",
  "model",
  "latencyMs",
  "tokens",
  "chunk",
  "chunks",
  "proposed",
  "ranked",
  "kept",
  "dropped",
  "findings",
  "step",
  "hits",
  "severityRaised",
  "scanDone",
  "scanFailed",
] as const;

const MAX_FEED_MESSAGE = 160;

/** "sec-1692415-ex10-1-commercial-lease.pdf" -> "sec-1692415-ex10-1-c….pdf" */
export function truncateFilename(name: string, max = 24): string {
  const clean = name.replace(/[\/]/g, "").trim();
  if (clean.length <= max) return clean;
  const ext = /\.[A-Za-z0-9]{1,5}$/.exec(clean)?.[0] ?? "";
  return clean.slice(0, Math.max(1, max - ext.length - 1)) + "…" + ext;
}

/** Strips everything that could carry document text: quotes, long filenames, free-form data. */
export function publicEvent(e: ScanEvent): ScanEvent {
  const d = e.data ?? {};
  const data: Record<string, unknown> = {};
  for (const k of FEED_DATA_KEYS) {
    const v = d[k];
    if (typeof v === "number" || typeof v === "boolean") data[k] = v;
    else if (typeof v === "string" && (k === "provider" || k === "model")) data[k] = v.slice(0, 60);
  }
  if (typeof d.filename === "string") data.filename = truncateFilename(d.filename);

  let message = e.message;
  if (d.droppedQuote) {
    message = `Threw out a quote: ${d.droppedQuote.reason}`;
  } else if (e.agent === "intake" && e.type === "start" && typeof d.filename === "string") {
    message = `Received ${truncateFilename(d.filename)}`;
  } else {
    // defence in depth: anything between double quotes could be document text
    message = message.replace(/"[^"]*"/g, '"…"');
  }
  if (message.length > MAX_FEED_MESSAGE) message = message.slice(0, MAX_FEED_MESSAGE - 1) + "…";

  return {
    scanId: e.scanId,
    ts: e.ts,
    seq: e.seq,
    agent: e.agent,
    type: e.type,
    message,
    ...(Object.keys(data).length ? { data: data as ScanEventData } : {}),
  };
}

/** Append-only JSONL of sanitized events across all scans; the line number is the cursor. */
export class GlobalFeed {
  constructor(private dir: string) {}

  private get file(): string {
    return path.join(this.dir, "_feed.jsonl");
  }

  async append(event: ScanEvent): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await appendFile(this.file, JSON.stringify(event) + "\n", "utf8");
  }

  /**
   * Events after cursor `after`. With after = 0 and a `limit`, returns the last `limit` events.
   * `cursor` is the id of the newest complete event, to pass as `after` next time.
   */
  async list(after = 0, limit?: number): Promise<{ events: FeedEvent[]; cursor: number }> {
    let raw: string;
    try {
      raw = await readFile(this.file, "utf8");
    } catch {
      return { events: [], cursor: 0 };
    }
    const lines = raw.split("\n");
    lines.pop(); // the last piece is empty or a half-written line
    const all: FeedEvent[] = [];
    lines.forEach((line, i) => {
      if (i + 1 <= after) return;
      try {
        all.push({ ...(JSON.parse(line) as ScanEvent), feedId: i + 1 });
      } catch {
        /* skip a corrupt line */
      }
    });
    const events = after === 0 && limit ? all.slice(-limit) : all;
    return { events, cursor: lines.length };
  }
}

/** Writes the full event to the per-scan sink and a sanitized copy to the global feed. */
export class TeeSink implements EventSink {
  constructor(private primary: EventSink, private feed: GlobalFeed) {}

  async append(event: ScanEvent): Promise<void> {
    await this.primary.append(event);
    try {
      await this.feed.append(publicEvent(event));
    } catch (err) {
      console.warn("feed event not persisted:", err instanceof Error ? err.message : err);
    }
  }

  list(scanId: string, afterSeq?: number): Promise<ScanEvent[]> {
    return this.primary.list(scanId, afterSeq);
  }
}
