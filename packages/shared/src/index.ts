/**
 * Shared contracts for FinePrint Agent.
 * Teammates: import from `@fineprint/shared` — do not duplicate these shapes in web/agent.
 */

export const PROMPT_VERSION = "m3.v2" as const;

export const RISK_TYPES = [
  "early_termination",
  "auto_renewal",
  "deposit_forfeiture",
  "late_fee",
  "notice_window",
  "liability_shift",
  "mandatory_arbitration",
  "fee_trap",
  "other",
] as const;

export type RiskType = (typeof RISK_TYPES)[number];

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SCAN_STATUSES = [
  "queued",
  "parsing",
  "analyzing",
  "validating",
  "done",
  "failed",
] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

/** One page of extracted document text (citation target). */
export interface DocumentPage {
  page: number;
  text: string;
}

export interface ParseResult {
  pages: DocumentPage[];
  meta: {
    pageCount: number;
    charCount: number;
    empty: boolean;
  };
}

/**
 * Structured agent output. Every finding shown to users MUST pass citation validation.
 * char_start / char_end are optional offsets into the page text (0-based, inclusive start).
 */
export interface RiskFinding {
  risk_type: RiskType;
  severity: Severity;
  plain_english: string;
  quote: string;
  page: number;
  char_start?: number;
  char_end?: number;
  grounded?: boolean;
}

export interface AgentRiskOutput {
  findings: RiskFinding[];
}

export interface DocumentRecord {
  id: string;
  owner_id: string;
  storage_path: string;
  content_sha256: string;
  mime: string;
  bytes: number;
  original_filename: string;
  status: "uploaded" | "parsed" | "deleted";
  created_at: string;
}

export interface ScanRecord {
  id: string;
  document_id: string;
  owner_id: string;
  status: ScanStatus;
  model: string;
  prompt_version: string;
  error: string | null;
  content_sha256: string;
  created_at: string;
  updated_at: string;
}

export interface FindingRecord extends RiskFinding {
  id: string;
  scan_id: string;
  grounded: boolean;
}

export interface ScanDetail {
  scan: ScanRecord;
  document: DocumentRecord;
  findings: FindingRecord[];
  pages?: DocumentPage[];
  /** Pages whose text could not be decoded (broken PDF fonts); never scanned. */
  unreadable_pages?: number[];
}

export interface CreateScanResponse {
  scan_id: string;
  document_id: string;
  status: ScanStatus;
  cache_hit: boolean;
}

/** MCP tool name — keep stable; agent + tests depend on it. */
export const MCP_TOOL_DOCUMENT_PARSE = "document_parse" as const;

export const MAX_UPLOAD_BYTES_DEFAULT = 5 * 1024 * 1024;
export const ALLOWED_MIME = ["application/pdf"] as const;

/** Pipeline stages that emit live events (one per character in Mission Control). */
export const SCAN_AGENTS = ["intake", "parser", "extractor", "ranker", "validator"] as const;
export type ScanAgentId = (typeof SCAN_AGENTS)[number];

export type ScanEventType = "start" | "progress" | "finish" | "error";

/** A quote the citation validator refused to keep. */
export interface DroppedQuote {
  quote: string;
  page: number;
  reason: string;
}

/** Optional structured payload; every field is only set when it is really known. */
export interface ScanEventData {
  filename?: string;
  bytes?: number;
  cacheHit?: boolean;
  pageCount?: number;
  unreadablePages?: number;
  provider?: string;
  model?: string;
  latencyMs?: number;
  tokens?: number;
  chunk?: number;
  chunks?: number;
  proposed?: number;
  ranked?: number;
  kept?: number;
  dropped?: number;
  droppedQuotes?: DroppedQuote[];
  droppedQuote?: DroppedQuote;
  findings?: number;
  [key: string]: unknown;
}

export interface ScanEvent {
  scanId: string;
  /** Epoch milliseconds. */
  ts: number;
  /** Per-scan sequence number starting at 1; used to resume streams. */
  seq: number;
  agent: ScanAgentId;
  type: ScanEventType;
  message: string;
  data?: ScanEventData;
}

/** A sanitized ScanEvent from the global feed (no document text) with its feed cursor. */
export interface FeedEvent extends ScanEvent {
  /** 1-based position in the global feed; pass as `after` to resume. */
  feedId: number;
}
