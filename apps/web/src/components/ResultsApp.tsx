"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScanDetail } from "@fineprint/shared";
import {
  buildSummaryText,
  deadlinesFor,
  docNoun,
  pagesWithFindings,
  toViewFindings,
} from "@/lib/findings";
import type { ActiveRef, PageRef } from "@/lib/nav";
import { AppShell } from "./AppShell";
import { CopyButton } from "./CopyButton";
import { Disclaimer } from "./Disclaimer";
import { DocumentMap } from "./DocumentMap";
import { PrintIcon, RefreshIcon, type ViewId } from "./NavIcons";
import { PrintReport } from "./PrintReport";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ResultsScreen } from "./views/ResultsScreen";
import { SummaryScreen } from "./views/SummaryScreen";
import { ClausesScreen, CostsScreen, SourcesScreen, TermsScreen } from "./views/ListScreens";

interface Props {
  detail: ScanDetail;
  cacheHit: boolean;
  fileUrl: string | null;
  onReset: () => void;
}

/** Everything after a finished scan: sidebar, top bar and the seven views. */
export function ResultsApp({ detail, cacheHit, fileUrl, onReset }: Props) {
  const [view, setView] = useState<ViewId>("results");
  const [active, setActive] = useState<ActiveRef | null>(null);
  const nonceRef = useRef(0);
  const mounted = useRef(false);

  const fileName = detail.document.original_filename;
  const noun = docNoun(fileName);
  const findings = useMemo(() => toViewFindings(detail.findings), [detail.findings]);
  const deadlines = useMemo(() => deadlinesFor(findings), [findings]);

  // Move focus to the new view's heading after navigation (not on first render).
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    document.getElementById("view-title")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [view]);

  const select = useCallback((ref: PageRef) => {
    nonceRef.current += 1;
    setActive({ ...ref, nonce: nonceRef.current });
  }, []);

  /** Every card and page link lands here: Document Map, quote highlighted. */
  const open = useCallback(
    (ref: PageRef) => {
      select(ref);
      setView("map");
    },
    [select]
  );

  const mapActive: ActiveRef | null =
    active ?? (findings[0] ? { findingId: findings[0].id, page: findings[0].page, nonce: 0 } : null);

  const unreadable = detail.unreadable_pages ?? [];
  const common = { fileName, noun, findings, deadlines, cacheHit, unreadable, onOpen: open, onView: setView };
  const pages = detail.pages?.length ?? 0;
  const flagged = pagesWithFindings(detail.findings).length;
  const Noun = noun === "lease" ? "Lease" : "Contract";

  return (
    <AppShell theme="dark" backdrop="dusk" sidebar={<Sidebar view={view} onView={setView} />}>
      <TopBar
        title={`${Noun} analysis`}
        file={{
          name: fileName,
          sub: pages ? `${pages} pages` : `${flagged} ${flagged === 1 ? "page" : "pages"} with findings`,
        }}
        ring={{ percent: 100, caption: "Analysis complete" }}
        actions={
          <>
            <button type="button" className="btn btn--primary btn--sm" onClick={onReset}>
              <RefreshIcon size={16} /> Scan another document
            </button>
            <CopyButton getText={() => buildSummaryText(detail)} />
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => window.print()}>
              <PrintIcon size={16} /> Download as PDF
            </button>
          </>
        }
      />
      <Disclaimer />
      <main id="main" className="view">
        {view === "results" && <ResultsScreen {...common} />}
        {view === "summary" && <SummaryScreen {...common} />}
        {view === "terms" && <TermsScreen {...common} />}
        {view === "costs" && <CostsScreen {...common} />}
        {view === "clauses" && <ClausesScreen {...common} />}
        {view === "sources" && <SourcesScreen {...common} />}
        {view === "map" && (
          <div className="screen">
            <header className="listhead">
              <p className="eyebrow">Verify any claim</p>
              <h1 id="view-title" tabIndex={-1} className="listhead__title">
                Document Map
              </h1>
            </header>
            {mapActive ? (
              <DocumentMap
                pages={detail.pages}
                findings={findings}
                active={mapActive}
                fileUrl={fileUrl}
                fileName={fileName}
                onSelect={select}
              />
            ) : (
              <section className="panel">
                <p className="docmap__none">
                  No clauses were quoted, so there&rsquo;s nothing to map. Skim the fee and
                  termination sections yourself.
                </p>
              </section>
            )}
          </div>
        )}
      </main>
      <PrintReport fileName={fileName} findings={findings} deadlines={deadlines} unreadable={unreadable} />
    </AppShell>
  );
}
