/**
 * M3 Agent 2 — Ranker / Explainer
 * May rewrite plain_english and reorder severity — MUST NOT add findings or change quotes.
 */

import type { HandoffFinding, HandoffPayload, RiskFinding } from "@fineprint/shared";
import { rankFindings } from "./validator.js";

const SEVERITY_RANK: Record<HandoffFinding["severity"], number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/** Minimum severity per risk type; never lowers what the Extractor assigned. */
const SEVERITY_FLOOR: Partial<Record<string, HandoffFinding["severity"]>> = {
  early_termination: "high",
  auto_renewal: "high",
  notice_window: "high",
  late_fee: "medium",
  deposit_forfeiture: "medium",
  payment_obligation: "low",
};

function refinePlainEnglish(f: HandoffFinding): string {
  if (f.risk_type === "payment_obligation") {
    return f.plain_english.startsWith("You will owe")
      ? f.plain_english
      : `You will owe / pay: ${f.plain_english.replace(/\.$/, "")}.`;
  }
  if (f.risk_type === "early_termination") {
    return "Trap: ending early can trigger a fee or remaining payment obligation — see quoted clause.";
  }
  if (f.risk_type === "auto_renewal") {
    return "Trap: the agreement may renew automatically unless you meet the notice rules in the quote.";
  }
  if (f.risk_type === "notice_window") {
    return "Trap: miss this notice window and you may be locked in or lose options.";
  }
  return f.plain_english;
}

/**
 * Ranker handoff: reorder + clarify copy; quotes frozen from Extractor.
 */
export function runRankerAgent(payload: HandoffPayload): {
  findings: RiskFinding[];
  handoff: HandoffPayload;
} {
  const refined: HandoffFinding[] = payload.findings.map((f) => {
    const floor = SEVERITY_FLOOR[f.risk_type];
    const severity =
      floor && SEVERITY_RANK[floor] > SEVERITY_RANK[f.severity] ? floor : f.severity;
    return {
      ...f,
      // Never touch quote / page / risk_type identity of the citation.
      quote: f.quote,
      page: f.page,
      plain_english: refinePlainEnglish(f),
      severity,
      // Preserve Extractor grounding — never "promote" ungrounded quotes.
      grounded: f.grounded === true,
    };
  });

  // Drop ungrounded if any slipped through (fail closed).
  const groundedOnly = refined.filter((f) => f.grounded && f.quote.length >= 8);
  const ranked = rankFindings(groundedOnly);

  return {
    findings: ranked,
    handoff: {
      ...payload,
      findings: ranked.map((f) => ({
        ...f,
        grounded: true as const,
      })),
    },
  };
}
