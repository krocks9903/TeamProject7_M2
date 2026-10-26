"use client";

import type { PageRef } from "@/lib/nav";
import { RISK_LABELS, type ViewFinding } from "@/lib/findings";

interface Props {
  findings: ViewFinding[];
  onOpen: (ref: PageRef) => void;
  limit?: number;
  /** Show the quote under each row. */
  withQuote?: boolean;
}

/** Every citation, as a page link into the Document Map. */
export function SourcesList({ findings, onOpen, limit, withQuote }: Props) {
  const rows = [...findings].sort((a, b) => a.page - b.page).slice(0, limit);
  return (
    <ol className="sources">
      {rows.map((f, i) => (
        <li key={f.id}>
          <button
            type="button"
            className="sources__row"
            onClick={() => onOpen({ findingId: f.id, page: f.page })}
            aria-label={`${RISK_LABELS[f.risk_type]}, page ${f.page}: open in the Document Map`}
          >
            <span className="sources__label">
              {i + 1}. {RISK_LABELS[f.risk_type]}
            </span>
            <span className="sources__pg">p. {f.page}</span>
            {withQuote ? <span className="sources__quote">&ldquo;{f.shortQuote}&rdquo;</span> : null}
          </button>
        </li>
      ))}
    </ol>
  );
}
