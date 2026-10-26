"use client";

import { motion } from "motion/react";
import type { PageRef } from "@/lib/nav";
import { RISK_LABELS, SEVERITY_LABELS, primaryValue, type ViewFinding } from "@/lib/findings";
import { AnimatedNumber } from "./AnimatedNumber";
import { SeverityIcon } from "./Icons";
import { RiskIcon } from "./NavIcons";

interface Props {
  finding: ViewFinding;
  index: number;
  onOpen: (ref: PageRef) => void;
  /** "paper" for the light summary page. */
  tone?: "dark" | "paper";
  /** Show "1." before the title (summary grid). */
  numbered?: boolean;
}

export function RiskCard({ finding: f, index, onOpen, tone = "dark", numbered }: Props) {
  const value = primaryValue(f);
  const label = RISK_LABELS[f.risk_type];
  return (
    <motion.li
      className={`riskcard riskcard--${tone}`}
      data-sev={f.severity}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3, ease: "easeOut", delay: index * 0.06 }}
    >
      <div className="riskcard__top">
        <span className="riskcard__icon">
          <RiskIcon type={f.risk_type} />
        </span>
        <span className={`badge badge--${f.severity}`}>
          <SeverityIcon severity={f.severity} />
          <span>{SEVERITY_LABELS[f.severity]}</span>
        </span>
      </div>
      <h3 className="riskcard__title">
        {numbered ? `${index + 1}. ` : ""}
        {label}
      </h3>
      <p className="riskcard__desc">{f.plain_english}</p>
      <div className="riskcard__foot">
        {value ? (
          <p className="riskcard__value">
            <span className="riskcard__big">
              <AnimatedNumber text={value.text} />
            </span>
            <span className="riskcard__unit">{value.unit}</span>
          </p>
        ) : (
          <p className="riskcard__value">
            <span className="riskcard__big">Page {f.page}</span>
            <span className="riskcard__unit">where the clause is</span>
          </p>
        )}
        {/* Stretched link: the whole card opens the quote in Document Map. */}
        <button
          type="button"
          className="riskcard__link"
          onClick={() => onOpen({ findingId: f.id, page: f.page })}
          aria-label={`${label}: open page ${f.page} in the Document Map with the quote highlighted`}
        >
          Page {f.page} <span aria-hidden="true">→</span>
        </button>
      </div>
    </motion.li>
  );
}
