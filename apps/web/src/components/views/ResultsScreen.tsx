"use client";

import { motion } from "motion/react";
import {
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  formatPageRanges,
  biggestAmount,
  countBySeverity,
  summarySentence,
} from "@/lib/findings";
import { AnimatedNumber } from "../AnimatedNumber";
import { AlertIcon, SeverityIcon } from "../Icons";
import { QuoteCard } from "../QuoteCard";
import { RiskCard } from "../RiskCard";
import { RISK_LABELS } from "@/lib/findings";
import type { ViewProps } from "./types";

/** Screen A: headline, one card per finding, biggest amount, key clause. */
export function ResultsScreen({ noun, findings, unreadable, onOpen }: ViewProps) {
  const n = findings.length;
  const counts = countBySeverity(findings);
  const biggest = biggestAmount(findings);
  const key = findings[0];

  return (
    <div className="screen">
      <header className="hero2">
        <p className="eyebrow">The {noun} analysis is complete</p>
        {n > 0 ? (
          <h1 id="view-title" tabIndex={-1} className="hero2__title" aria-label={`FinePrint found ${n} ${n === 1 ? "way" : "ways"} this ${noun} can cost you money`}>
            <span aria-hidden="true">
              FinePrint found{" "}
              <em className="hero2__n">
                <AnimatedNumber text={String(n)} duration={0.5} />
              </em>{" "}
              {n === 1 ? "way" : "ways"} this {noun} can cost you money
            </span>
          </h1>
        ) : (
          <h1 id="view-title" tabIndex={-1} className="hero2__title">
            FinePrint found no clauses it could quote
          </h1>
        )}
        <p className="hero2__sub">
          {n > 0
            ? `We analyzed your ${noun} and found clauses that could cost you money. Here’s what matters most.`
            : "No money-loss clauses found that we could quote. That’s not a guarantee, so skim the fee and termination sections yourself."}
        </p>
        {n > 0 ? (
          <div className="hero2__summary">
            <p className="visually-hidden">{summarySentence(findings)}</p>
            <ul className="badges" aria-label="Risks by severity">
              {SEVERITY_ORDER.filter((s) => counts[s] > 0).map((s, i) => (
                <motion.li
                  key={s}
                  className={`badge badge--${s}`}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25, delay: 0.3 + i * 0.06 }}
                >
                  <SeverityIcon severity={s} />
                  <span>
                    {counts[s]} {SEVERITY_LABELS[s]}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>
        ) : null}
      </header>

      {unreadable.length > 0 ? (
        <div className="notice notice--warn" role="note">
          <AlertIcon size={20} />
          <div className="notice__body">
            <h2 className="notice__title">
              {unreadable.length === 1 ? "1 page" : `${unreadable.length} pages`} could not be scanned
            </h2>
            <p>
              Page{unreadable.length === 1 ? "" : "s"} {formatPageRanges(unreadable)} use fonts
              FinePrint can&rsquo;t decode, so any fees or rules there were <strong>not</strong>{" "}
              checked. Fee sheets and addenda often sit at the back of a lease. Read{" "}
              {unreadable.length === 1 ? "that page" : "those pages"} yourself, or re-export the PDF
              from the original program.
            </p>
          </div>
        </div>
      ) : null}

      {n > 0 ? (
        <>
          <ul className="riskgrid" aria-label="Risks, most serious first">
            {findings.map((f, i) => (
              <RiskCard key={f.id} finding={f} index={i} onOpen={onOpen} />
            ))}
          </ul>

          <div className="bottomrow">
            <section className="panel amountcard" aria-labelledby="amount-title">
              <h2 id="amount-title" className="panel__title">
                Biggest dollar amount found
              </h2>
              {biggest ? (
                <>
                  <p className="amountcard__value">
                    <span className="amountcard__big">
                      <AnimatedNumber text={biggest.text} />
                    </span>
                    <span className="amountcard__unit">{RISK_LABELS[biggest.finding.risk_type]}</span>
                  </p>
                  <p className="amountcard__note">
                    {biggest.finding.plain_english} This is the single largest amount in any
                    quote, not a total of different risks.
                  </p>
                  <button
                    type="button"
                    className="page-link"
                    onClick={() => onOpen({ findingId: biggest.finding.id, page: biggest.finding.page })}
                  >
                    Page {biggest.finding.page} →
                  </button>
                </>
              ) : (
                <p className="amountcard__note">
                  No dollar amounts appear in the quoted clauses. Check the pages linked above
                  for how fees are calculated.
                </p>
              )}
            </section>
            {key ? <QuoteCard finding={key} heading="Key clause" onOpen={onOpen} /> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
