import type { DeadlineItem } from "@/lib/deadlines";
import {
  RISK_LABELS,
  SEVERITY_LABELS,
  formatPageRanges,
  summarySentence,
  type ViewFinding,
} from "@/lib/findings";

/** Plain, light report that only appears when printing ("Download as PDF"). */
export function PrintReport({
  fileName,
  findings,
  deadlines,
  unreadable,
}: {
  fileName: string;
  findings: ViewFinding[];
  deadlines: DeadlineItem[];
  unreadable: number[];
}) {
  return (
    <section className="printonly" aria-hidden="true">
      <h1>FinePrint report: {fileName}</h1>
      <p>
        <strong>{summarySentence(findings)}</strong>
      </p>
      {unreadable.length > 0 ? (
        <p>
          <strong>Not scanned:</strong> page{unreadable.length === 1 ? "" : "s"}{" "}
          {formatPageRanges(unreadable)} could not be read, so any fees or rules there were not
          checked. Read {unreadable.length === 1 ? "it" : "them"} yourself.
        </p>
      ) : null}
      <ol>
        {findings.map((f) => (
          <li key={f.id}>
            <p>
              <strong>
                [{SEVERITY_LABELS[f.severity]}] {RISK_LABELS[f.risk_type]}
              </strong>{" "}
              (page {f.page}): {f.plain_english}
            </p>
            {f.values.length > 0 ? <p>Key terms: {f.values.map((v) => v.text).join(", ")}</p> : null}
            <blockquote>&ldquo;{f.quote}&rdquo;</blockquote>
          </li>
        ))}
      </ol>
      {deadlines.length > 0 ? (
        <>
          <h2>Deadlines to calendar</h2>
          <ul>
            {deadlines.map((d) => (
              <li key={d.key}>
                {d.action} (page {d.page})
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p>
        FinePrint only flags clauses it can quote. It may miss things, and it&rsquo;s not legal
        advice.
      </p>
    </section>
  );
}
