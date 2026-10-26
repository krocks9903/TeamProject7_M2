"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentRoster } from "./AgentRoster";
import { EventLog } from "./EventLog";
import { groupScans, type FeedScan } from "./feedScans";
import { OfficeCanvas } from "./OfficeCanvas";
import { RunBar } from "./RunBar";
import { ScanCard } from "./ScanCard";
import { reduceEvents } from "./scanState";
import { useGlobalFeed } from "./useGlobalFeed";
import "./mission-control.css";

const SAMPLE_NAME = "sec-1692415-ex10-1-commercial-lease.pdf";

/**
 * Private "watch the agents work" screen. It follows the global feed of every scan, animates the
 * most recent active one, and lists the rest in the log. With nothing running, it is all lounge.
 */
export function MissionControl() {
  const { events, status } = useGlobalFeed();
  const [now, setNow] = useState(() => Date.now());
  const [pick, setPick] = useState("auto");
  const [autoId, setAutoId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scans = useMemo(() => groupScans(events, now), [events, now]);
  const latestActive = scans.find((s) => s.active) ?? null;
  const anyActive = latestActive !== null;

  // Follow the newest running scan. When it ends, stay on it until another one starts.
  useEffect(() => {
    if (latestActive && latestActive.id !== autoId) setAutoId(latestActive.id);
  }, [latestActive, autoId]);

  // Tick only while something is running so elapsed times count up; an idle page does no work.
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [anyActive]);

  const focusId = pick === "auto" ? autoId : pick;
  const focus = scans.find((s) => s.id === focusId) ?? null;
  const focusEvents = useMemo(() => focus?.events ?? [], [focus]);
  const state = useMemo(() => reduceEvents(focusEvents), [focusEvents]);

  const runSample = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      const pdf = await fetch("/api/sample-lease");
      if (!pdf.ok) throw new Error("The sample lease could not be loaded.");
      const form = new FormData();
      form.append("file", new File([await pdf.blob()], SAMPLE_NAME, { type: "application/pdf" }));
      const res = await fetch("/api/scans?async=1", { method: "POST", body: form });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
      setPick("auto");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the sample scan.");
    } finally {
      setStarting(false);
    }
  }, []);

  const label = (s: FeedScan) => {
    const t = new Date(s.startedAt).toLocaleTimeString();
    const st = s.failed ? "failed" : s.done ? "done" : s.active ? "running" : "stalled";
    return `${t} · ${s.filename ?? `#${s.id.slice(0, 4)}`} · ${st}`;
  };

  return (
    <div className="mc-root">
      <header className="mc-header">
        <h1 className="mc-title">FinePrint Mission Control</h1>
        <span className="mc-transport" aria-live="polite">
          {anyActive ? `live (${status})` : `nothing running — everyone is in the lounge (${status})`}
        </span>
        {scans.length > 0 ? (
          <label className="mc-picker">
            Scan
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="auto">Auto: latest running</option>
              {scans.map((s) => (
                <option key={s.id} value={s.id}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>
      <div className="mc-grid">
        <div className="mc-col mc-col--left">
          <AgentRoster state={state} now={now} />
        </div>
        <div className="mc-col mc-col--center">
          <OfficeCanvas key={focusId ?? "none"} events={focusEvents} />
        </div>
        <div className="mc-col mc-col--right">
          <ScanCard state={state} now={now} />
          <EventLog events={events} showScan={scans.length > 1} />
        </div>
      </div>
      <RunBar busy={starting} error={error} onSample={runSample} />
    </div>
  );
}
