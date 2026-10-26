"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useMemo, useState } from "react";
import { RISK_LABELS, countByRisk, type ViewFinding } from "@/lib/findings";
import { AnimatedNumber } from "../AnimatedNumber";
import { DeadlinePanel } from "../DeadlinePanel";
import { FilterChips, type RiskFilter } from "../FilterChips";
import { QuoteCard } from "../QuoteCard";
import { SourcesList } from "../SourcesList";
import type { ViewProps } from "./types";

function Title({ eyebrow, children }: { eyebrow: string; children: string }) {
  return (
    <header className="listhead">
      <p className="eyebrow">{eyebrow}</p>
      <h1 id="view-title" tabIndex={-1} className="listhead__title">
        {children}
      </h1>
    </header>
  );
}

/** Key Terms: deadlines plus every amount, rate, window and date found. */
export function TermsScreen({ findings, deadlines, onOpen }: ViewProps) {
  const withValues = findings.filter((f) => f.values.length > 0);
  return (
    <div className="screen">
      <Title eyebrow="From your quotes">Key terms</Title>
      <div className="termsgrid">
        <div className="sidepanel">
          <DeadlinePanel items={deadlines} onOpen={onOpen} />
        </div>
        <section className="panel" aria-labelledby="values-title">
          <h2 id="values-title" className="panel__title">
            Amounts, rates and windows
          </h2>
          {withValues.length === 0 ? (
            <p className="docmap__none">No numbers appear in the quoted clauses.</p>
          ) : (
            <ul className="valuelist">
              {withValues.map((f) => (
                <li key={f.id}>
                  <span className="valuelist__label">{RISK_LABELS[f.risk_type]}</span>
                  <ul className="values">
                    {f.values.map((v, i) => (
                      <li key={`${v.text}-${i}`} className="value">
                        {v.text}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="page-link"
                    onClick={() => onOpen({ findingId: f.id, page: f.page })}
                  >
                    Page {f.page} →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** Costs: each dollar amount and rate on its own. Never added together. */
export function CostsScreen({ findings, onOpen }: ViewProps) {
  const rows = useMemo(() => {
    const out: Array<{ f: ViewFinding; text: string; amount: number; kind: "money" | "percent" }> = [];
    for (const f of findings) {
      for (const v of f.values) {
        if (v.kind === "money" && v.amount !== undefined) out.push({ f, text: v.text, amount: v.amount, kind: "money" });
        if (v.kind === "percent") out.push({ f, text: v.text, amount: -1, kind: "percent" });
      }
    }
    return out.sort((a, b) => b.amount - a.amount);
  }, [findings]);

  return (
    <div className="screen">
      <Title eyebrow="From your quotes">Costs</Title>
      <p className="listhead__note">
        Each amount is listed on its own, with the clause it comes from. FinePrint doesn&rsquo;t
        add different amounts together.
      </p>
      {rows.length === 0 ? (
        <section className="panel">
          <p className="docmap__none">No dollar amounts or rates appear in the quoted clauses.</p>
        </section>
      ) : (
        <ul className="costlist">
          {rows.map((r, i) => (
            <motion.li
              key={`${r.f.id}-${r.text}-${i}`}
              className="panel costrow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
            >
              <p className="costrow__big">
                <AnimatedNumber text={r.text} />
              </p>
              <div className="costrow__body">
                <p className="costrow__label">
                  {RISK_LABELS[r.f.risk_type]} · {r.kind === "money" ? "dollar amount" : "rate"}
                </p>
                <p className="costrow__quote" title={r.f.quote}>
                  &ldquo;{r.f.shortQuote}&rdquo;
                </p>
              </div>
              <button
                type="button"
                className="page-link"
                onClick={() => onOpen({ findingId: r.f.id, page: r.f.page })}
              >
                Page {r.f.page} →
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Clauses: every quote, filterable by risk type. */
export function ClausesScreen({ findings, onOpen }: ViewProps) {
  const [filter, setFilter] = useState<RiskFilter>("all");
  const counts = useMemo(() => countByRisk(findings), [findings]);
  const visible = filter === "all" ? findings : findings.filter((f) => f.risk_type === filter);
  return (
    <div className="screen">
      <Title eyebrow="Exact words from your document">Clauses</Title>
      <LayoutGroup>
        <FilterChips counts={counts} total={findings.length} value={filter} onChange={setFilter} />
        <motion.ul layout className="clauselist">
          <AnimatePresence mode="popLayout">
            {visible.map((f, i) => (
              <motion.li
                key={f.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.3, delay: filter === "all" ? i * 0.06 : 0 }}
              >
                <p className="clauselist__plain">{f.plain_english}</p>
                <QuoteCard finding={f} heading={RISK_LABELS[f.risk_type]} onOpen={onOpen} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </LayoutGroup>
    </div>
  );
}

/** Sources: every citation, with its quote. */
export function SourcesScreen({ findings, onOpen }: ViewProps) {
  return (
    <div className="screen">
      <Title eyebrow="Where each claim comes from">Sources</Title>
      <section className="panel">
        <SourcesList findings={findings} onOpen={onOpen} withQuote />
      </section>
    </div>
  );
}
