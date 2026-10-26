import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractValues, hasDeadline } from "../apps/web/src/lib/extract.ts";
import { splitByQuotes } from "../apps/web/src/lib/highlight.ts";

const texts = (q: string) => extractValues(q).map((v) => v.text);

describe("extractValues", () => {
  it("pulls money amounts, including thousands separators and cents", () => {
    assert.deepEqual(texts("Deposit of $2,500 and a fee of $75.50 apply."), [
      "$2,500",
      "$75.50",
    ]);
  });

  it("pulls percentages and normalizes the rate period", () => {
    assert.deepEqual(texts("Interest accrues at 18% per year."), ["18%/yr"]);
    assert.deepEqual(texts("A fee of 1.5 percent per month applies."), ["1.5%/mo"]);
    assert.deepEqual(texts("A 10% fee applies."), ["10%"]);
  });

  it("pulls day counts, number words and business days", () => {
    assert.deepEqual(texts("Give 60 days written notice."), ["60 days"]);
    assert.deepEqual(texts("within five (5) business days"), ["5 business days"]);
    assert.deepEqual(texts("thirty days after the term"), ["30 days"]);
    assert.deepEqual(texts("one day"), ["1 day"]);
  });

  it("pulls calendar dates", () => {
    assert.deepEqual(texts("Rent is due by January 5, 2026."), ["January 5, 2026"]);
    assert.deepEqual(texts("Ends 12/31/2026."), ["12/31/2026"]);
  });

  it("returns values in document order and flags deadlines", () => {
    const v = extractValues("Pay $50 within 5 days or 10% applies.");
    assert.deepEqual(v.map((x) => x.kind), ["money", "days", "percent"]);
    assert.equal(hasDeadline(v), true);
    assert.equal(hasDeadline(extractValues("A fee of $50 applies.")), false);
  });

  it("returns nothing for text without values", () => {
    assert.deepEqual(extractValues("Disputes go to binding arbitration."), []);
  });
});

describe("splitByQuotes", () => {
  it("highlights a quote even when the page text wraps lines", () => {
    const segs = splitByQuotes("Intro. Late fee of $50\napplies here. End.", [
      { id: "a", quote: "Late fee of $50 applies here." },
    ]);
    assert.equal(segs.find((s) => s.findingId === "a")?.text, "Late fee of $50\napplies here.");
    assert.equal(segs.map((s) => s.text).join(""), "Intro. Late fee of $50\napplies here. End.");
  });
});

import { buildDeadlines } from "../apps/web/src/lib/deadlines.ts";
import { pickSentence, splitSentences, stripHeading, toDisplayCase } from "../apps/web/src/lib/sentences.ts";

describe("sentences", () => {
  it("splits on sentence boundaries and picks the one matching the risk type", () => {
    const q = "Rent is $1,850 due monthly. A late fee of $75 applies after 5 days. Pets are allowed.";
    const s = splitSentences(q);
    assert.equal(s.length, 3);
    const pick = pickSentence(s, "late_fee");
    assert.match(pick, /late fee/);
    // chips come only from the matching sentence, not "$1,850"
    assert.deepEqual(extractValues(pick).map((v) => v.text), ["$75", "5 days"]);
  });

  it("strips a glued ALL-CAPS heading and sentence-cases caps runs for display", () => {
    assert.equal(
      stripHeading("SECURITY DEPOSIT AND TERM Tenant will pay a security deposit of $2,500."),
      "Tenant will pay a security deposit of $2,500."
    );
    assert.equal(
      toDisplayCase("THE LANDLORD SHALL NOT BE LIABLE. Tenant pays rent."),
      "The landlord shall not be liable. Tenant pays rent."
    );
    assert.equal(toDisplayCase("Tenant pays $50 to LLC."), "Tenant pays $50 to LLC.");
  });
});

describe("buildDeadlines", () => {
  const base = { id: "f1", page: 2, values: [] as ReturnType<typeof extractValues> };

  it("phrases day counts as actions and de-duplicates", () => {
    const sentence = "Renews unless Tenant gives 60 days written notice.";
    const values = extractValues(sentence);
    const items = buildDeadlines([
      { ...base, risk_type: "auto_renewal", sentence, values },
      { ...base, id: "f2", risk_type: "notice_window", sentence, values },
    ]);
    assert.equal(items.length, 1);
    assert.equal(items[0].action, "Give notice at least 60 days before the term ends");
  });

  it("keeps dates that follow an action word and skips plain start/end dates", () => {
    const keep = "Notice must be given before June 14, 2026.";
    const skip = "This lease begins on June 1, 2026 and ends May 31, 2027.";
    const items = buildDeadlines([
      { ...base, risk_type: "notice_window", sentence: keep, values: extractValues(keep) },
      { ...base, id: "f3", risk_type: "other", sentence: skip, values: extractValues(skip) },
    ]);
    assert.deepEqual(items.map((i) => i.action), ["Give notice before June 14, 2026"]);
  });
});

import { soonestDeadline } from "../apps/web/src/lib/deadlines.ts";
import { biggestAmount, primaryValue, stepForStatus, toViewFindings } from "../apps/web/src/lib/findings.ts";
import { ridgePath } from "../apps/web/src/lib/mountains.ts";
import type { FindingRecord } from "@fineprint/shared";

const rec = (over: Partial<FindingRecord>): FindingRecord => ({
  id: "x",
  scan_id: "s",
  risk_type: "late_fee",
  severity: "medium",
  plain_english: "p",
  quote: "A late fee of $75 applies.",
  page: 1,
  grounded: true,
  ...over,
});

describe("numbers come only from quotes", () => {
  it("picks the biggest dollar amount without summing", () => {
    const f = toViewFindings([
      rec({ id: "a", quote: "A late fee of $75 applies after 5 days." }),
      rec({ id: "b", risk_type: "deposit_forfeiture", quote: "A security deposit of $2,500 may be forfeited.", page: 2 }),
    ]);
    const big = biggestAmount(f);
    assert.equal(big?.text, "$2,500");
    assert.equal(big?.amount, 2500);
    assert.equal(big?.finding.id, "b");
  });

  it("returns null when no quote has a dollar amount", () => {
    const f = toViewFindings([rec({ quote: "Disputes go to binding arbitration.", risk_type: "mandatory_arbitration" })]);
    assert.equal(biggestAmount(f), null);
    assert.equal(primaryValue(f[0]), null);
  });

  it("falls back from money to percent to days for a card's number", () => {
    const [f] = toViewFindings([rec({ quote: "Interest accrues at 18% per year." })]);
    assert.equal(primaryValue(f)?.text, "18%/yr");
  });
});

describe("deadlines and steps", () => {
  const input = (id: string, sentence: string) => ({
    id, page: 1, risk_type: "notice_window" as const, sentence, values: extractValues(sentence),
  });

  it("marks the smallest known window as soonest", () => {
    const items = buildDeadlines([
      input("a", "Give 60 days written notice."),
      input("b", "Request inspection 10 days before move-out."),
    ]);
    assert.equal(soonestDeadline(items)?.findingId, "b");
  });

  it("never calls a past date soonest", () => {
    const now = Date.parse("2026-01-01");
    const items = buildDeadlines([input("a", "Notice is due before June 14, 2010.")], now);
    assert.equal(items.length, 1);
    assert.equal(soonestDeadline(items), null);
  });

  it("maps ScanStatus to the four stepper steps", () => {
    assert.deepEqual(
      (["queued", "parsing", "analyzing", "validating", "done"] as const).map(stepForStatus),
      [0, 0, 1, 2, 3]
    );
  });
});

describe("mountains", () => {
  it("is deterministic for a seed", () => {
    assert.equal(ridgePath(5), ridgePath(5));
    assert.notEqual(ridgePath(5), ridgePath(6));
  });
});
