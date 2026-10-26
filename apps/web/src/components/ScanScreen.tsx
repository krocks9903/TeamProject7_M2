"use client";

import { motion } from "motion/react";
import { RISK_TYPES } from "@fineprint/shared";
import { PROGRESS_STEPS, RISK_LABELS, RISK_PLAIN } from "@/lib/findings";
import { DocIcon, InfoIcon } from "./Icons";
import { ProgressRing } from "./ProgressRing";
import { ScanStepper } from "./ScanStepper";

interface Props {
  step: number;
  fileName: string | null;
  cacheHit: boolean;
}

/** Light "scanning" screen: ring around a document, stepper, and what we look for. */
export function ScanScreen({ step, fileName, cacheHit }: Props) {
  const last = PROGRESS_STEPS.length - 1;
  const clamped = Math.min(step, last);
  const pct = Math.round(((clamped + 0.5) / PROGRESS_STEPS.length) * 100);

  return (
    <div className="scanscreen">
      <section className="scanscreen__main" aria-labelledby="scan-title">
        <ProgressRing percent={pct} size={168} stroke={6} spinning label="Scan progress">
          <span className="scanscreen__doc">
            <DocIcon size={44} />
          </span>
        </ProgressRing>
        <h1 id="scan-title" className="scanscreen__title">
          Reading your document…
        </h1>
        <p className="scanscreen__sub">
          {fileName ? <strong className="scanscreen__file">{fileName}</strong> : null}
          We&rsquo;re reading every page, looking for fees and deadlines, and
          throwing out anything we can&rsquo;t quote.
        </p>
        <ScanStepper step={step} cacheHit={cacheHit} />
      </section>

      <motion.aside
        className="panel panel--frost lookingfor"
        aria-labelledby="looking-title"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <h2 id="looking-title" className="lookingfor__title">
          What we&rsquo;re looking for
        </h2>
        <ul className="lookingfor__list">
          {RISK_TYPES.map((t) => (
            <li key={t} className="lookingfor__item">
              <span className="lookingfor__label">{RISK_LABELS[t]}</span>
              <span className="lookingfor__desc">{RISK_PLAIN[t]}</span>
            </li>
          ))}
        </ul>
        <p className="lookingfor__tip">
          <InfoIcon size={18} />
          You can leave this tab open. Results appear here as soon as they&rsquo;re ready.
        </p>
      </motion.aside>
    </div>
  );
}
