"use client";

import { useReducedMotion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { useEffect } from "react";
import type { DocumentPage } from "@fineprint/shared";
import { splitByQuotes } from "@/lib/highlight";
import type { ActiveRef, PageRef } from "@/lib/nav";
import {
  RISK_LABELS,
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  type ViewFinding,
} from "@/lib/findings";
import { SeverityIcon } from "./Icons";
import { ChevronIcon, SearchIcon } from "./NavIcons";
import { QuoteCard } from "./QuoteCard";

interface Props {
  /** Full page text. The API currently omits it; we fall back to quoted passages. */
  pages?: DocumentPage[];
  findings: ViewFinding[];
  active: ActiveRef;
  fileUrl: string | null;
  fileName: string;
  onSelect: (ref: PageRef) => void;
}

/** Left: findings by page. Center: page with highlighted quotes. Right: the selected finding. */
export function DocumentMap({ pages, findings, active, fileUrl, fileName, onSelect }: Props) {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement | null>(null);

  const byPage = useMemo(
    () =>
      [...findings].sort(
        (a, b) =>
          a.page - b.page ||
          SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      ),
    [findings]
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byPage;
    return byPage.filter((f) =>
      `${RISK_LABELS[f.risk_type]} ${f.plain_english} ${f.quote}`.toLowerCase().includes(q)
    );
  }, [byPage, query]);

  const pageNumbers = useMemo(() => {
    const set = new Set<number>(pages?.map((p) => p.page) ?? []);
    for (const f of findings) set.add(f.page);
    return [...set].sort((a, b) => a - b);
  }, [pages, findings]);

  const page = active.page;
  const selected = findings.find((f) => f.id === active.findingId) ?? null;
  const pageFindings = useMemo(() => findings.filter((f) => f.page === page), [findings, page]);
  const pageText = pages?.find((p) => p.page === page)?.text;
  const segments = useMemo(
    () =>
      pageText
        ? splitByQuotes(pageText, pageFindings.map((f) => ({ id: f.id, quote: f.quote })))
        : null,
    [pageText, pageFindings]
  );

  const idx = pageNumbers.indexOf(page);
  const go = (n: number) => {
    const first = byPage.find((f) => f.page === n);
    onSelect({ page: n, findingId: first?.id ?? "" });
  };

  // Scroll the quote into the middle of the page pane only (never the whole window).
  useEffect(() => {
    const body = bodyRef.current;
    const mark = markRef.current;
    if (!body || !mark) return;
    const b = body.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    body.scrollTo({
      top: body.scrollTop + (m.top - b.top) - body.clientHeight / 2 + m.height / 2,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [active.nonce, active.page, segments, reduce]);

  const isActive = (id: string) => id === active.findingId;
  // Re-keying the active mark replays the left-to-right highlighter sweep.
  const markKey = (id: string, i: number) => (isActive(id) ? `a-${active.nonce}-${i}` : `m-${i}`);
  const pdfHref = fileUrl ? `${fileUrl}#page=${page}` : null;

  return (
    <div className="docmap">
      <section className="panel docmap__list" aria-labelledby="map-list-title">
        <h2 id="map-list-title" className="panel__title">
          Document Map
        </h2>
        <label className="search">
          <SearchIcon size={16} />
          <span className="visually-hidden">Search clauses</span>
          <input
            type="search"
            placeholder="Search clauses…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {shown.length === 0 ? (
          <p className="docmap__none">No clauses match &ldquo;{query}&rdquo;.</p>
        ) : (
          <ol className="docmap__items">
            {shown.map((f, i) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="docmap__item"
                  aria-current={isActive(f.id) ? "true" : undefined}
                  onClick={() => onSelect({ findingId: f.id, page: f.page })}
                >
                  <span>
                    {i + 1}. {RISK_LABELS[f.risk_type]}
                  </span>
                  <span className="docmap__pg">p. {f.page}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="panel docmap__viewer" aria-label="Page viewer">
        <header className="docmap__bar">
          <h2 className="docmap__pagetitle">
            Page {page}
            {pages?.length ? ` of ${pages.length}` : ""}
          </h2>
          <div className="docmap__nav">
            <button
              type="button"
              className="iconbtn"
              aria-label="Previous page with a finding"
              disabled={idx <= 0}
              onClick={() => go(pageNumbers[idx - 1])}
            >
              <ChevronIcon dir="left" size={18} />
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label="Next page with a finding"
              disabled={idx < 0 || idx >= pageNumbers.length - 1}
              onClick={() => go(pageNumbers[idx + 1])}
            >
              <ChevronIcon dir="right" size={18} />
            </button>
          </div>
        </header>
        <div className="docmap__scroll" ref={bodyRef} tabIndex={0} aria-label={`Text of page ${page}`}>
          <div className="paperpage">
            {segments ? (
              <p className="page-text">
                {segments.map((s, i) =>
                  s.findingId ? (
                    <mark
                      key={markKey(s.findingId, i)}
                      ref={isActive(s.findingId) ? markRef : undefined}
                      className={isActive(s.findingId) ? "mark mark--active" : "mark"}
                    >
                      {s.text}
                    </mark>
                  ) : (
                    <span key={i}>{s.text}</span>
                  )
                )}
              </p>
            ) : (
              <>
                <p className="paperpage__note">
                  Showing the passages quoted from page {page}. The full page
                  text isn&rsquo;t sent to your browser, to keep your document private.
                </p>
                {pageFindings.map((f, i) => (
                  <div key={f.id} className="paperpage__passage">
                    <span className="paperpage__label">{RISK_LABELS[f.risk_type]}</span>
                    <p className="page-text">
                      <mark
                        key={markKey(f.id, i)}
                        ref={isActive(f.id) ? markRef : undefined}
                        className={isActive(f.id) ? "mark mark--active" : "mark"}
                      >
                        {f.quote}
                      </mark>
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        {pdfHref ? (
          <footer className="docmap__foot">
            <a href={pdfHref} target="_blank" rel="noopener noreferrer">
              Open {fileName} at page {page} in a new tab
            </a>
          </footer>
        ) : null}
      </section>

      <aside className="docmap__side" aria-label="Selected finding">
        {selected ? (
          <>
            <section className="panel">
              <p className="eyebrow">Selected finding</p>
              <div className="docmap__selhead">
                <h2 className="panel__title">{RISK_LABELS[selected.risk_type]}</h2>
                <span className={`badge badge--${selected.severity}`}>
                  <SeverityIcon severity={selected.severity} />
                  <span>{SEVERITY_LABELS[selected.severity]}</span>
                </span>
              </div>
              <p className="docmap__plain">{selected.plain_english}</p>
              {selected.values.length > 0 ? (
                <ul className="values" aria-label="Amounts and dates in this clause">
                  {selected.values.map((v, i) => (
                    <li key={`${v.text}-${i}`} className="value">
                      {v.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
            <QuoteCard finding={selected} heading="Key quote" />
          </>
        ) : (
          <section className="panel">
            <p className="docmap__none">Pick a clause on the left to see it here.</p>
          </section>
        )}
      </aside>
    </div>
  );
}
