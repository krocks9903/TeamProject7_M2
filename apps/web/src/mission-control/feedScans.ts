import type { FeedEvent } from "@fineprint/shared";

export interface FeedScan {
  id: string;
  events: FeedEvent[];
  startedAt: number;
  lastAt: number;
  done: boolean;
  failed: boolean;
  /** Truncated filename from the sanitized feed. */
  filename: string | null;
  /** Still running: no final event yet and not silent for longer than STALE_MS. */
  active: boolean;
}

/** A scan with no final event and no news for this long is treated as abandoned, not running. */
export const STALE_MS = 2 * 60_000;

/** Groups the global feed by scan, newest scan first. */
export function groupScans(events: FeedEvent[], now: number): FeedScan[] {
  const by = new Map<string, FeedEvent[]>();
  for (const e of events) {
    const list = by.get(e.scanId);
    if (list) list.push(e);
    else by.set(e.scanId, [e]);
  }
  const scans: FeedScan[] = [];
  for (const [id, list] of by) {
    list.sort((a, b) => a.seq - b.seq);
    const done = list.some((e) => e.data?.scanDone === true);
    const failed = list.some((e) => e.data?.scanFailed === true);
    const lastAt = list[list.length - 1].ts;
    scans.push({
      id,
      events: list,
      startedAt: list[0].ts,
      lastAt,
      done,
      failed,
      filename: list.find((e) => e.data?.filename)?.data?.filename ?? null,
      active: !done && !failed && now - lastAt < STALE_MS,
    });
  }
  return scans.sort((a, b) => b.startedAt - a.startedAt);
}
