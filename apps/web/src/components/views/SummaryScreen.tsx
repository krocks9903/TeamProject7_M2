"use client";

import { RISK_LABELS, SEVERITY_LABELS, biggestAmount } from "@/lib/findings";
import { AnimatedNumber } from "../AnimatedNumber";
import { DeadlinePanel } from "../DeadlinePanel";
import { SeverityIcon } from "../Icons";
import { RiskCard } from "../RiskCard";
import { SourcesList } from "../SourcesList";
import type { ViewProps } from "./types";

/** Screen D: key takeaways on paper, plus a dark side panel. */
export function SummaryScreen({ noun, findings, deadlines, onOpen, onView }: ViewProps) {
  const biggest = biggestAmount(findings);
  const serious = findings.filter((f) => f.severity === "high" || f.severity === "critical");

  return (
    <div className="summarygrid">
      <div className="paper">
        <p className="eyebrow">Executive summary</p>
        <h1 id="view-title" tabIndex={-1} className="paper__title">
          Key takeaways
        </h1>
        <p className="paper__sub">
          {findings.length > 0
            ? `This ${noun} has ${findings.length} ${findings.length === 1 ? "area" : "areas"} that could cost you money. Here’s a clear summary of what we found.`
            : "No money-loss clauses found that we could quote. That’s not a guarantee, so skim the fee and termination sections yourself."}
        </p>

        {findings.length > 0 ? (
          <ul className="riskgrid riskgrid--paper" aria-label="Key takeaways">
            {findings.map((f, i) => (
              <RiskCard key={f.id} finding={f} index={i} onOpen={onOpen} tone="paper" numbered />
            ))}
          </ul>
        ) : null}

        <section className="checkbox" aria-labelledby="check-title">
          <h2 id="check-title" className="checkbox__title">
            What to check before you sign
          </h2>
          {serious.length > 0 ? (
            <ul className="checkbox__list">
              {serious.map((f) => (
                <li key={f.id}>
                  <span className={`badge badge--${f.severity}`}>
                    <SeverityIcon severity={f.severity} />
                    <span>{SEVERITY_LABELS[f.severity]}</span>
                  </span>
                  <span className="checkbox__what">
                    <strong>{RISK_LABELS[f.risk_type]}:</strong> {f.plain_english}
                  </span>
                  <button
                    type="button"
                    className="page-link"
                    onClick={() => onOpen({ findingId: f.id, page: f.page })}
                    aria-label={`${RISK_LABELS[f.risk_type]}: read page ${f.page} in the Document Map`}
                  >
                    Read page {f.page} →
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="checkbox__none">
              No high-severity findings were quoted. Still skim the fee and termination
              sections yourself.
            </p>
          )}
        </section>
      </div>

      <aside className="sidepanel" aria-label="Key figures and sources">
        <section className="sidepanel__block" aria-labelledby="side-amount">
          <h2 id="side-amount" className="sidepanel__label">
            Biggest dollar amount found
          </h2>
          {biggest ? (
            <>
              <p className="sidepanel__big">
                <AnimatedNumber text={biggest.text} />
              </p>
              <p className="sidepanel__sub">
                {RISK_LABELS[biggest.finding.risk_type]} · page {biggest.finding.page}
              </p>
            </>
          ) : (
            <p className="sidepanel__sub">No dollar amounts in the quoted clauses.</p>
          )}
        </section>

        <DeadlinePanel items={deadlines} onOpen={onOpen} />

        <section className="sidepanel__block" aria-labelledby="side-sources">
          <div className="sidepanel__row">
            <h2 id="side-sources" className="sidepanel__label">
              Sources
            </h2>
            <button type="button" className="link-btn" onClick={() => onView("sources")}>
              View all citations →
            </button>
          </div>
          <SourcesList findings={findings} onOpen={onOpen} limit={5} />
        </section>
      </aside>
    </div>
  );
}
