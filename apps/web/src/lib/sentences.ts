/**
 * Pure helpers for working with quotes sentence by sentence.
 * A quote can span several sentences; money/date chips should come only from
 * the sentence that actually matches the finding's risk type.
 */

export type RiskKey =
  | "early_termination"
  | "auto_renewal"
  | "deposit_forfeiture"
  | "late_fee"
  | "notice_window"
  | "liability_shift"
  | "mandatory_arbitration"
  | "fee_trap"
  | "payment_obligation"
  | "other";

const RISK_PATTERNS: Record<RiskKey, RegExp | null> = {
  early_termination: /early terminat|terminat|break(?:ing)? (?:the )?lease|cancel/i,
  auto_renewal: /renew/i,
  deposit_forfeiture: /deposit|non[- ]refundable|forfeit/i,
  late_fee: /late (?:fee|charge)|past due|delinquen|interest/i,
  notice_window: /notice|\bdays?\b/i,
  liability_shift: /responsible|liab|expense|indemn/i,
  mandatory_arbitration: /arbitrat|jury/i,
  fee_trap: /\bfees?\b|charge|\$/i,
  payment_obligation: /\$|rent|retainer|per (?:hour|month)|payable/i,
  other: null,
};

/** Split on sentence boundaries; glues stray list numbers ("1.") onto the next sentence. */
export function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const raw = clean.split(/(?<=[.!?]["”')\]]?)\s+(?=["“(\[]?[A-Z0-9$])/);
  const out: string[] = [];
  for (const part of raw) {
    const prev = out[out.length - 1];
    if (prev !== undefined && prev.length <= 4) out[out.length - 1] = `${prev} ${part}`;
    else out.push(part);
  }
  return out;
}

/** The sentence that matches the risk type, falling back to the first sentence. */
export function pickSentence(sentences: string[], risk: RiskKey): string {
  if (sentences.length === 0) return "";
  const re = RISK_PATTERNS[risk];
  if (re) {
    const hit = sentences.find((s) => re.test(s));
    if (hit) return hit;
  }
  return sentences[0];
}

const HEADING_RE =
  /^(?:[A-Z0-9][A-Z0-9&'’\/-]*[,;:]?\s+){2,}(?=[A-Z][a-z])/;

/** Drop a leading ALL-CAPS section heading glued onto a sentence ("SECURITY DEPOSIT Tenant will…"). */
export function stripHeading(sentence: string): string {
  const m = HEADING_RE.exec(sentence);
  if (!m) return sentence;
  const rest = sentence.slice(m[0].length);
  return rest.length >= 20 ? rest : sentence;
}

const CAPS_WORD = /^[("“]*[A-Z][A-Z'’-]+[)"”.,;:]*$/;

/** Display only: turn runs of ALL-CAPS words into sentence case. The original stays in the tooltip. */
export function toDisplayCase(text: string): string {
  const tokens = text.split(" ");
  const out = tokens.slice();
  let changed = false;
  let i = 0;
  while (i < tokens.length) {
    if (!CAPS_WORD.test(tokens[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < tokens.length && CAPS_WORD.test(tokens[j])) j++;
    if (j - i >= 2) {
      for (let k = i; k < j; k++) out[k] = tokens[k].toLowerCase();
      changed = true;
    }
    i = j;
  }
  if (!changed) return text;
  return out
    .join(" ")
    .replace(/(^|[.!?]\s+)(["“(]?)([a-z])/g, (_m, a: string, q: string, c: string) => a + q + c.toUpperCase());
}
