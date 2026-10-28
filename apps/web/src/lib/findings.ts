import type {
  FindingRecord,
  RiskType,
  ScanDetail,
  ScanStatus,
  Severity,
} from "@fineprint/shared";
import { buildDeadlines, type DeadlineItem } from "./deadlines";
import { extractValues, type ExtractedValue } from "./extract";
import { pickSentence, splitSentences, stripHeading, toDisplayCase } from "./sentences";

export const RISK_LABELS: Record<RiskType, string> = {
  early_termination: "Early termination",
  auto_renewal: "Auto-renewal",
  deposit_forfeiture: "Deposit",
  late_fee: "Late fee",
  notice_window: "Notice window",
  liability_shift: "Liability",
  mandatory_arbitration: "Arbitration",
  fee_trap: "Hidden fee",
  payment_obligation: "Payment",
  other: "Other",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Highest first. */
export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export const CHECKED_FOR =
  "late fees, deposits, renewals, termination, notice windows, liability, arbitration, hidden fees";

export interface ViewFinding extends FindingRecord {
  /** Chips come only from the sentence that matches the risk type. */
  values: ExtractedValue[];
  /** The matching sentence (raw). */
  sentence: string;
  /** Matching sentence in display case, without a glued-on section heading. */
  shortQuote: string;
  /** Whole quote in display case. */
  fullQuote: string;
  /** True when the full quote has more than the matching sentence. */
  hasMore: boolean;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export function toViewFindings(findings: FindingRecord[]): ViewFinding[] {
  return findings
    .map((f) => {
      const sentences = splitSentences(f.quote);
      const sentence = pickSentence(sentences, f.risk_type);
      const shortQuote = toDisplayCase(stripHeading(sentence));
      const fullQuote = toDisplayCase(f.quote.replace(/\s+/g, " ").trim());
      return {
        ...f,
        values: extractValues(sentence),
        sentence,
        shortQuote,
        fullQuote,
        hasMore: squash(shortQuote) !== squash(fullQuote),
      };
    })
    .sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
        a.page - b.page
    );
}

export function deadlinesFor(findings: ViewFinding[]): DeadlineItem[] {
  return buildDeadlines(findings);
}

export function countBySeverity(findings: FindingRecord[]) {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

export function countByRisk(findings: FindingRecord[]) {
  const counts = new Map<RiskType, number>();
  for (const f of findings) counts.set(f.risk_type, (counts.get(f.risk_type) ?? 0) + 1);
  return counts;
}

/** "6 risks found: 2 high, 3 medium, 1 low" */
export function summarySentence(findings: FindingRecord[]): string {
  const n = findings.length;
  if (n === 0) return "No money-loss clauses found that we could quote";
  const counts = countBySeverity(findings);
  const parts = SEVERITY_ORDER.filter((s) => counts[s] > 0).map(
    (s) => `${counts[s]} ${s}`
  );
  return `${n} ${n === 1 ? "risk" : "risks"} found: ${parts.join(", ")}`;
}

export function buildSummaryText(detail: ScanDetail): string {
  const items = toViewFindings(detail.findings);
  const lines = [
    `FinePrint summary for ${detail.document.original_filename}`,
    summarySentence(detail.findings),
    "",
  ];
  items.forEach((f, i) => {
    lines.push(
      `${i + 1}. [${SEVERITY_LABELS[f.severity]}] ${RISK_LABELS[f.risk_type]} (page ${f.page}): ${f.plain_english}`
    );
    if (f.values.length) lines.push(`   Key terms: ${f.values.map((v) => v.text).join(", ")}`);
    lines.push(`   Quote: "${f.quote}"`);
  });
  const deadlines = deadlinesFor(items);
  if (deadlines.length) {
    lines.push("", "Deadlines to calendar:");
    for (const d of deadlines) lines.push(`- ${d.action} (page ${d.page})`);
  }
  const skipped = detail.unreadable_pages ?? [];
  if (skipped.length) {
    lines.push(
      "",
      `Not scanned: page${skipped.length === 1 ? "" : "s"} ${formatPageRanges(skipped)} could not be read (the PDF's fonts can't be decoded). Read ${skipped.length === 1 ? "it" : "them"} yourself.`
    );
  }
  lines.push(
    "",
    "FinePrint only flags clauses it can quote. It may miss things, and it's not legal advice."
  );
  return lines.join("\n");
}

export const PROGRESS_STEPS = [
  "Reading document",
  "Finding risks",
  "Checking quotes",
  "Done",
] as const;

/** Index into PROGRESS_STEPS for a given server status. */
export function stepForStatus(status: ScanStatus | "uploading"): number {
  switch (status) {
    case "analyzing":
      return 1;
    case "validating":
      return 2;
    case "done":
      return 3;
    default:
      return 0; // uploading, queued, parsing
  }
}

/** Plain-English descriptions of the risk types we look for. */
export const RISK_PLAIN: Record<RiskType, string> = {
  early_termination: "Fees or rent owed if you leave early.",
  auto_renewal: "Terms that renew on their own unless you act.",
  deposit_forfeiture: "Deposits you could lose or not get back.",
  late_fee: "Charges and interest for paying late.",
  notice_window: "How many days' notice you must give, and by when.",
  liability_shift: "Costs and repairs that fall on you.",
  mandatory_arbitration: "Disputes that can't go to court.",
  fee_trap: "Extra fees and charges buried in the text.",
  payment_obligation: "Scheduled amounts you agree to pay, like rent or retainers.",
  other: "Anything else that can cost you money.",
};

/** "lease" when the file looks like a lease, otherwise "contract". */
export function docNoun(fileName: string): "lease" | "contract" {
  return /lease|rent|tenan/i.test(fileName) ? "lease" : "contract";
}

export interface PrimaryValue {
  /** Display text, e.g. "$2,500" or "60 days". */
  text: string;
  /** What kind of number it is, in plain words. */
  unit: string;
}

const UNIT_LABEL: Record<ExtractedValue["kind"], string> = {
  money: "dollar amount in the clause",
  percent: "rate in the clause",
  days: "time window in the clause",
  date: "date in the clause",
};

/** The one number a card leads with: biggest dollar amount, else percent, days, date. All from the quote. */
export function primaryValue(f: ViewFinding): PrimaryValue | null {
  const money = f.values
    .filter((v) => v.kind === "money")
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0];
  const pick =
    money ??
    f.values.find((v) => v.kind === "percent") ??
    f.values.find((v) => v.kind === "days") ??
    f.values.find((v) => v.kind === "date");
  return pick ? { text: pick.text, unit: UNIT_LABEL[pick.kind] } : null;
}

export interface BiggestAmount {
  text: string;
  amount: number;
  finding: ViewFinding;
}

/** The single largest dollar amount found in any quote. Never a sum of different risks. */
export function biggestAmount(findings: ViewFinding[]): BiggestAmount | null {
  let best: BiggestAmount | null = null;
  for (const f of findings) {
    for (const v of f.values) {
      if (v.kind === "money" && v.amount !== undefined && (!best || v.amount > best.amount)) {
        best = { text: v.text, amount: v.amount, finding: f };
      }
    }
  }
  return best;
}

export function pagesWithFindings(findings: FindingRecord[]): number[] {
  return [...new Set(findings.map((f) => f.page))].sort((a, b) => a - b);
}

/** [31, 32, 36, 37, 38] -> "31–32, 36–38" */
export function formatPageRanges(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j > i ? `${sorted[i]}\u2013${sorted[j]}` : String(sorted[i]));
    i = j + 1;
  }
  return parts.join(", ");
}
