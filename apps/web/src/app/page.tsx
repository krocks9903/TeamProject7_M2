"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CalendarEvent,
  FindingRecord,
  RiskFinding,
  ScanDetail,
} from "@fineprint/shared";

type Tab = "upload" | "inbox" | "calendar";

interface InboxRow {
  id: string;
  from: string;
  subject: string;
  received_at: string;
  snippet: string;
  labels: string[];
  attachment_count: number;
}

interface TriageResult {
  email: { id: string; subject: string; body_text: string };
  body_findings: RiskFinding[];
  attachment_scans: Array<{
    filename: string;
    scan_id?: string;
    status: string;
    findings: RiskFinding[];
    error?: string;
  }>;
  calendar_events: CalendarEvent[];
}

function FindingCard({ f }: { f: RiskFinding | FindingRecord }) {
  const id = "id" in f ? f.id : `${f.risk_type}-${f.quote.slice(0, 12)}`;
  return (
    <li key={id} className="finding">
      <header>
        <strong>{f.risk_type.replaceAll("_", " ")}</strong>
        <span className={`pill ${f.severity}`}>{f.severity}</span>
        <span className="pill">
          {f.risk_type === "payment_obligation" ? "costs money" : "trap"}
        </span>
      </header>
      <div>{f.plain_english}</div>
      <blockquote className="quote">&ldquo;{f.quote}&rdquo;</blockquote>
      <div className="meta">page {f.page} · grounded citation</div>
    </li>
  );
}

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [scanMeta, setScanMeta] = useState<string>("");

  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const pollScan = useCallback(async (scanId: string) => {
    for (let i = 0; i < 60; i++) {
      const res = await fetch(`/api/scans/${scanId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Poll failed (${res.status})`);
      }
      const detail = (await res.json()) as ScanDetail;
      setStatus(detail.scan.status);
      if (detail.scan.status === "done") {
        setFindings(detail.findings);
        setScanMeta(
          `${detail.document.original_filename} · model ${detail.scan.model} · ${detail.findings.length} grounded finding(s)`
        );
        return;
      }
      if (detail.scan.status === "failed") {
        throw new Error(detail.scan.error ?? "Scan failed");
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    throw new Error("Timed out waiting for scan");
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFindings([]);
    setScanMeta("");
    if (!file) {
      setError("Choose a PDF first.");
      return;
    }
    setBusy(true);
    setStatus("uploading");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/scans", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setStatus(json.cache_hit ? "done (cache)" : json.status);
      await pollScan(json.scan_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function loadInbox() {
    setError("");
    try {
      const res = await fetch("/api/inbox");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Inbox failed");
      setInbox(json.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadCalendar() {
    setError("");
    try {
      const res = await fetch("/api/calendar");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Calendar failed");
      setEvents(json.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (tab === "inbox") void loadInbox();
    if (tab === "calendar") void loadCalendar();
  }, [tab]);

  async function runTriage(id: string) {
    setBusy(true);
    setError("");
    setTriage(null);
    setStatus("triaging email…");
    try {
      const res = await fetch(`/api/inbox/${id}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanAttachments: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Triage failed");
      setTriage(json);
      setStatus("triage done");
      await loadCalendar();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <div className="brand">FinePrint Agent · Team DNK · M3</div>
      <h1>Ways this document can cost you money</h1>
      <p className="lede">
        Upload a PDF, or triage demo inbox mail for renewals and fees. Deadlines
        land on the calendar. Every finding quotes the source. Not legal advice.
      </p>

      <div className="upload-row" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          disabled={tab === "upload"}
          onClick={() => setTab("upload")}
        >
          Upload
        </button>
        <button
          type="button"
          disabled={tab === "inbox"}
          onClick={() => setTab("inbox")}
        >
          Inbox
        </button>
        <button
          type="button"
          disabled={tab === "calendar"}
          onClick={() => setTab("calendar")}
        >
          Calendar
        </button>
      </div>

      {tab === "upload" ? (
        <form className="panel" onSubmit={onSubmit}>
          <div className="upload-row">
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
              disabled={busy}
            />
            <button type="submit" disabled={busy || !file}>
              {busy ? "Scanning…" : "Scan document"}
            </button>
          </div>
          {status ? <p className="status">status: {status}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </form>
      ) : null}

      {tab === "inbox" ? (
        <div className="panel">
          <p className="meta">
            Demo mailbox (fixture MCP) — lease renewal, equipment invoice,
            contractor sign request. Pizza spam is filtered out.
          </p>
          <ul className="findings">
            {inbox.map((m) => (
              <li key={m.id} className="finding">
                <header>
                  <strong>{m.subject}</strong>
                  {m.labels.map((l) => (
                    <span key={l} className="pill">
                      {l}
                    </span>
                  ))}
                </header>
                <div className="meta">
                  {m.from} · {new Date(m.received_at).toLocaleString()} ·{" "}
                  {m.attachment_count} attachment(s)
                </div>
                <div>{m.snippet}</div>
                <div className="upload-row" style={{ marginTop: "0.75rem" }}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runTriage(m.id)}
                  >
                    {busy ? "Working…" : "Triage + scan attachments"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {status ? <p className="status">status: {status}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </div>
      ) : null}

      {tab === "calendar" ? (
        <div className="panel">
          <p className="meta">
            Deadlines from demo email + any events proposed during triage.
            Google Calendar push comes later — this is the local reminder layer.
          </p>
          <ul className="findings">
            {events.map((ev) => (
              <li key={ev.id} className="finding">
                <header>
                  <strong>{ev.title}</strong>
                  <span className="pill">{ev.source}</span>
                </header>
                <div>
                  {ev.all_day ? ev.starts_at.slice(0, 10) : ev.starts_at}
                </div>
                {ev.quote ? (
                  <blockquote className="quote">&ldquo;{ev.quote}&rdquo;</blockquote>
                ) : null}
                {ev.notes ? <div className="meta">{ev.notes}</div> : null}
              </li>
            ))}
          </ul>
          {error ? <p className="error">{error}</p> : null}
        </div>
      ) : null}

      {scanMeta ? <p className="status">{scanMeta}</p> : null}

      {findings.length > 0 ? (
        <ul className="findings">
          {findings.map((f) => (
            <FindingCard key={f.id} f={f} />
          ))}
        </ul>
      ) : null}

      {triage ? (
        <div style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>Triage: {triage.email.subject}</h2>
          <p className="meta">From email body</p>
          <ul className="findings">
            {triage.body_findings.map((f, i) => (
              <FindingCard key={`b-${i}`} f={f} />
            ))}
          </ul>
          {triage.attachment_scans.map((att) => (
            <div key={att.filename}>
              <p className="meta">
                Attachment {att.filename} · {att.status}
                {att.error ? ` · ${att.error}` : ""}
              </p>
              <ul className="findings">
                {att.findings.map((f, i) => (
                  <FindingCard key={`a-${att.filename}-${i}`} f={f} />
                ))}
              </ul>
            </div>
          ))}
          {triage.calendar_events.length > 0 ? (
            <p className="status">
              Proposed {triage.calendar_events.length} calendar event(s) — see
              Calendar tab.
            </p>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
