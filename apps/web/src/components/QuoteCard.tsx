"use client";

import { useState } from "react";
import type { PageRef } from "@/lib/nav";
import { RISK_LABELS, type ViewFinding } from "@/lib/findings";
import { QuoteIcon } from "./NavIcons";

const LONG = 240;

interface Props {
  finding: ViewFinding;
  heading: string;
  /** Omit when already on that page (Document Map). */
  onOpen?: (ref: PageRef) => void;
}

/** Quote in plain display case; the original wording is in the tooltip. */
export function QuoteCard({ finding: f, heading, onOpen }: Props) {
  const [expanded, setExpanded] = useState(false);
  const long = f.shortQuote.length > LONG;
  const canToggle = f.hasMore || long;
  const id = `qc-${f.id}-${heading.replace(/\W/g, "")}`;
  return (
    <article className="quotecard" aria-label={heading}>
      <h3 className="quotecard__head">
        <QuoteIcon size={18} /> {heading}
      </h3>
      <blockquote
        id={id}
        className={`quote${long && !expanded ? " quote--clamped" : ""}`}
        title={f.quote}
      >
        &ldquo;{expanded ? f.fullQuote : f.shortQuote}&rdquo;
      </blockquote>
      {canToggle ? (
        <button
          type="button"
          className="link-btn"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Show full quote"}
        </button>
      ) : null}
      <p className="quotecard__foot">
        <span>{RISK_LABELS[f.risk_type]}</span>
        {onOpen ? (
          <button
            type="button"
            className="page-link"
            onClick={() => onOpen({ findingId: f.id, page: f.page })}
            aria-label={`Open page ${f.page} in the Document Map with this quote highlighted`}
          >
            Page {f.page} →
          </button>
        ) : (
          <span>Page {f.page}</span>
        )}
      </p>
    </article>
  );
}
