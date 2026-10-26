/**
 * Pure helper: pull money, percent, day-count and date values out of a quote.
 * No imports so it can be unit-tested directly with node:test.
 */

export type ChipKind = "money" | "percent" | "days" | "date";

export interface ExtractedValue {
  kind: ChipKind;
  /** Short label shown in the chip, e.g. "$2,500", "18%/yr", "5 business days". */
  text: string;
  /** Character offset in the quote (used for ordering). */
  index: number;
  /** Numeric dollar amount, for money values. */
  amount?: number;
  /** Day count (weeks are converted to 7 days each), for day values. */
  days?: number;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  thirty: 30, forty: 40, "forty-five": 45, sixty: 60, ninety: 90,
};

const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d+)`;
const WORD = Object.keys(NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .join("|");

const MONEY_RE = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?/g;
const MONEY_WORDS_RE = new RegExp(`\\b${NUM}\\s+dollars\\b`, "gi");
const PERCENT_RE = /(\d+(?:\.\d+)?)\s?(?:%|percent\b)(\s+(?:per\s+(?:annum|year|month)|annually|a\s+year|monthly|a\s+month|each\s+month|per\s+day|daily))?/gi;
// "five (5) business days", "30 days", "thirty days", "2 weeks"
const DAYS_RE = new RegExp(
  `\\b(?:(${WORD})(?:\\s*\\(\\s*(\\d+)\\s*\\))?|(\\d+))[\\s-]+((?:business|calendar|working|consecutive)\\s+)?(days?|weeks?)\\b`,
  "gi"
);
const MONTHS =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?";
const DATE_RES = [
  new RegExp(`\\b${MONTHS}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b`, "g"),
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:day\\s+of\\s+)?${MONTHS}(?:,?\\s+\\d{4})?\\b`, "g"),
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  /\b\d{4}-\d{2}-\d{2}\b/g,
];

function formatPercentSuffix(raw: string | undefined): string {
  if (!raw) return "";
  const s = raw.toLowerCase();
  if (/annum|year|annually/.test(s)) return "/yr";
  if (/month/.test(s)) return "/mo";
  if (/day|daily/.test(s)) return "/day";
  return "";
}

export function extractValues(quote: string): ExtractedValue[] {
  const out: ExtractedValue[] = [];
  const taken: Array<[number, number]> = [];
  const overlaps = (s: number, e: number) =>
    taken.some(([a, b]) => s < b && e > a);
  const push = (
    kind: ChipKind,
    text: string,
    index: number,
    len: number,
    extra: { amount?: number; days?: number } = {}
  ) => {
    if (overlaps(index, index + len)) return;
    taken.push([index, index + len]);
    out.push({ kind, text, index, ...extra });
  };

  for (const m of quote.matchAll(MONEY_RE)) {
    const text = `$${m[1]}${m[2] ?? ""}`;
    const amount = Number(`${m[1].replace(/,/g, "")}${m[2] ?? ""}`);
    push("money", text, m.index ?? 0, m[0].length, { amount });
  }
  for (const m of quote.matchAll(MONEY_WORDS_RE)) {
    push("money", `$${m[1]}`, m.index ?? 0, m[0].length, {
      amount: Number(m[1].replace(/,/g, "")),
    });
  }
  for (const m of quote.matchAll(PERCENT_RE)) {
    const suffix = formatPercentSuffix(m[2]);
    push("percent", `${m[1]}%${suffix}`, m.index ?? 0, m[0].length);
  }
  for (const m of quote.matchAll(DAYS_RE)) {
    const n = m[3] ?? m[2] ?? String(NUMBER_WORDS[(m[1] ?? "").toLowerCase()] ?? "");
    if (!n) continue;
    const qualifier = (m[4] ?? "").trim().toLowerCase();
    const unit = (m[5] ?? "days").toLowerCase();
    const plural = Number(n) === 1 ? unit.replace(/s$/, "") : unit.replace(/s?$/, "s");
    push("days", `${n} ${qualifier ? qualifier + " " : ""}${plural}`, m.index ?? 0, m[0].length, {
      days: Number(n) * (unit.startsWith("week") ? 7 : 1),
    });
  }
  for (const re of DATE_RES) {
    for (const m of quote.matchAll(re)) {
      push("date", m[0].replace(/\s+/g, " ").trim(), m.index ?? 0, m[0].length);
    }
  }

  return out.sort((a, b) => a.index - b.index);
}

/** True when the quote contains a day count or a calendar date worth calendaring. */
export function hasDeadline(values: ExtractedValue[]): boolean {
  return values.some((v) => v.kind === "days" || v.kind === "date");
}
