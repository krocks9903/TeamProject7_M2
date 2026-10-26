"use client";

import { useEffect, useRef, useState } from "react";
import type { ScanAgentId, ScanEvent } from "@fineprint/shared";
import { AGENTS, AGENT_BY_ID } from "./agents";

const time = (ts: number) => {
  const d = new Date(ts);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
};

export function EventLog({
  events,
  showScan = false,
}: {
  events: Array<ScanEvent & { feedId?: number }>;
  /** Tag each row with its scan, for when several scans share the log. */
  showScan?: boolean;
}) {
  const [filter, setFilter] = useState<ScanAgentId | "all">("all");
  const listRef = useRef<HTMLOListElement>(null);
  const shown = filter === "all" ? events : events.filter((e) => e.agent === filter);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length]);

  return (
    <section className="mc-panel" aria-label="Event log">
      <h2 className="mc-panel__title">Event log</h2>
      <div className="mc-filters" role="group" aria-label="Filter by agent">
        <button
          type="button"
          className={`mc-chip${filter === "all" ? " is-on" : ""}`}
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        {AGENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`mc-chip${filter === a.id ? " is-on" : ""}`}
            aria-pressed={filter === a.id}
            onClick={() => setFilter(a.id)}
          >
            {a.name}
          </button>
        ))}
      </div>
      <ol className="mc-log" ref={listRef}>
        {shown.length === 0 ? (
          <li className="mc-log__empty">No events yet. Run a scan to see the pipeline work.</li>
        ) : (
          shown.map((e) => (
            <li
              key={`${e.scanId}-${e.seq}`}
              className={`mc-log__row mc-log__row--${e.type}${showScan ? " mc-log__row--scan" : ""}`}
            >
              <span className="mc-log__time">{time(e.ts)}</span>
              {showScan ? <span className="mc-log__scan">#{e.scanId.slice(0, 4)}</span> : null}
              <span className="mc-log__agent">{AGENT_BY_ID[e.agent]?.name ?? e.agent}</span>
              <span className="mc-log__msg">
                <b className="mc-log__type">{e.type}</b> {e.message}
              </span>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
