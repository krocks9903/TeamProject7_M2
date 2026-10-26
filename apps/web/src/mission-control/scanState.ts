import type { ScanAgentId, ScanEvent } from "@fineprint/shared";
import { SCAN_AGENTS } from "@fineprint/shared";

export type AgentStatus = "idle" | "working" | "done" | "error";

export interface AgentView {
  id: ScanAgentId;
  status: AgentStatus;
  lastMessage: string;
  startedAt: number | null;
  /** Milliseconds from the agent's start to its finish; null while still working or idle. */
  workMs: number | null;
}

export interface ScanSummary {
  scanId: string | null;
  filename: string | null;
  pages: number | null;
  provider: string | null;
  model: string | null;
  startedAt: number | null;
  endedAt: number | null;
  kept: number | null;
  dropped: number | null;
  cacheHit: boolean;
  done: boolean;
  failed: boolean;
}

export interface MissionState {
  agents: Record<ScanAgentId, AgentView>;
  scan: ScanSummary;
}

const blankAgent = (id: ScanAgentId): AgentView => ({
  id,
  status: "idle",
  lastMessage: "",
  startedAt: null,
  workMs: null,
});

export function initialState(): MissionState {
  return {
    agents: Object.fromEntries(SCAN_AGENTS.map((a) => [a, blankAgent(a)])) as Record<
      ScanAgentId,
      AgentView
    >,
    scan: {
      scanId: null,
      filename: null,
      pages: null,
      provider: null,
      model: null,
      startedAt: null,
      endedAt: null,
      kept: null,
      dropped: null,
      cacheHit: false,
      done: false,
      failed: false,
    },
  };
}

/** Folds real scan events into panel state. Nothing here is invented: every field comes from an event. */
export function reduceEvents(events: ScanEvent[]): MissionState {
  const s = initialState();
  for (const e of events) {
    const a = s.agents[e.agent];
    const d = e.data ?? {};
    if (!a) continue;
    s.scan.scanId = e.scanId;
    s.scan.startedAt ??= e.ts;
    a.lastMessage = e.message;

    if (e.type === "start") {
      a.status = "working";
      a.startedAt = e.ts;
      a.workMs = null;
    } else if (e.type === "finish") {
      a.status = "done";
      if (a.startedAt !== null) a.workMs = e.ts - a.startedAt;
    } else if (e.type === "error") {
      a.status = "error";
      if (a.startedAt !== null) a.workMs = e.ts - a.startedAt;
    }

    if (d.filename) s.scan.filename = d.filename;
    if (typeof d.pageCount === "number") s.scan.pages = d.pageCount;
    if (d.provider) s.scan.provider = d.provider;
    if (d.model) s.scan.model = d.model;
    if (typeof d.kept === "number") s.scan.kept = d.kept;
    if (typeof d.dropped === "number") s.scan.dropped = d.dropped;
    if (d.cacheHit === true) s.scan.cacheHit = true;
    if (d.scanDone === true) {
      s.scan.done = true;
      s.scan.endedAt = e.ts;
    }
    if (d.scanFailed === true) {
      s.scan.failed = true;
      s.scan.endedAt = e.ts;
    }
  }
  return s;
}
