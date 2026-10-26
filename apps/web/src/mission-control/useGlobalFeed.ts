"use client";

import { useEffect, useState } from "react";
import type { FeedEvent } from "@fineprint/shared";

export type FeedStatus = "connecting" | "live" | "reconnecting" | "polling";

const POLL_MS = 1000;
const KEEP = 1000;

interface Recent {
  events: FeedEvent[];
  cursor: number;
}

/**
 * Subscribes to the global, sanitized event feed (all scans): loads the last ~50 events,
 * then follows `/api/events/stream` (SSE), falling back to polling if streaming is unavailable.
 */
export function useGlobalFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [status, setStatus] = useState<FeedStatus>("connecting");

  useEffect(() => {
    let cancelled = false;
    let cursor = 0;
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const accept = (batch: FeedEvent[]) => {
      const fresh = batch.filter((e) => e.feedId > cursor);
      if (fresh.length === 0) return;
      cursor = fresh[fresh.length - 1].feedId;
      setEvents((prev) => [...prev, ...fresh].slice(-KEEP));
    };

    const poll = async () => {
      if (cancelled) return;
      setStatus("polling");
      try {
        const res = await fetch(`/api/events/recent?after=${cursor}`, { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as Recent;
          if (!cancelled) accept(body.events);
        }
      } catch {
        /* retry next tick */
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    };

    const connect = () => {
      if (typeof EventSource === "undefined") return void poll();
      source = new EventSource(`/api/events/stream?after=${cursor}`);
      source.onopen = () => !cancelled && setStatus("live");
      source.onmessage = (m) => {
        try {
          accept([JSON.parse(m.data) as FeedEvent]);
        } catch {
          /* ignore a malformed frame */
        }
      };
      source.onerror = () => {
        if (cancelled) return;
        // CLOSED means the browser gave up reconnecting: switch to polling.
        if (source?.readyState === EventSource.CLOSED) {
          source = null;
          void poll();
        } else {
          setStatus("reconnecting");
        }
      };
    };

    void (async () => {
      try {
        const res = await fetch("/api/events/recent", { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as Recent;
          if (cancelled) return;
          setEvents(body.events);
          cursor = body.cursor;
        }
      } catch {
        /* start streaming anyway */
      }
      if (!cancelled) connect();
    })();

    return () => {
      cancelled = true;
      source?.close();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { events, status };
}
