import { describe, it } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import {
  chunkPages,
  runExtractorAgent,
  runRankerAgent,
  resetKnowledgeStoreForTests,
  searchChunks,
  STIPULATION_PATTERNS,
  mockExtractRisks,
  validateCitations,
  resolveProvider,
} from "@fineprint/agent";
import type { DocumentPage, HandoffPayload } from "@fineprint/shared";

process.env.MODEL_PROVIDER = "mock";

const SAMPLE_PAGES: DocumentPage[] = [
  {
    page: 1,
    text: [
      "RESIDENTIAL LEASE",
      "3.1 Monthly rent is $2,450.00 USD payable on the first.",
      "Tenant may terminate early by paying an early termination fee equal to two months rent.",
      "This lease renews automatically unless Tenant gives 60 days written notice of non-renewal.",
      "A late fee of $50 applies if rent is more than five days past due.",
    ].join(" "),
  },
];

describe("M3 knowledge layer", () => {
  it("chunks pages and retrieves early-termination pattern hits", () => {
    const chunks = chunkPages("doc-test", SAMPLE_PAGES, 200, 40);
    assert.ok(chunks.length >= 1);
    const hits = searchChunks(chunks, "early termination fee", 5);
    assert.ok(hits.length >= 1);
    assert.ok(
      hits.some((h) => h.pattern_ids.includes("pat_early_term")),
      `expected pat_early_term in ${JSON.stringify(hits.map((h) => h.pattern_ids))}`
    );
  });

  it("exposes a non-empty stipulation pattern library", () => {
    assert.ok(STIPULATION_PATTERNS.length >= 6);
  });
});

describe("M3 multi-agent handoff", () => {
  it("Extractor → Ranker preserves quotes and may rewrite plain_english", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "fp-m3-"));
    resetKnowledgeStoreForTests(dir);
    process.env.FINEPRINT_KNOWLEDGE_DIR = dir;

    const provider = resolveProvider();
    const handoff = await runExtractorAgent({
      documentId: "doc-m3",
      scanId: "scan-m3",
      pages: SAMPLE_PAGES,
      provider,
    });

    assert.ok(handoff.reasoning_trace.length >= 2, "expected ReAct trace");
    assert.ok(
      handoff.reasoning_trace.some((s) => s.action.includes("document_search")),
      "expected document_search actions in trace"
    );
    assert.ok(handoff.findings.length >= 1);

    const quotesBefore = handoff.findings.map((f) => f.quote);
    const { findings, handoff: ranked } = runRankerAgent(handoff);
    const quotesAfter = findings.map((f) => f.quote);

    assert.deepEqual(quotesAfter.sort(), quotesBefore.sort());
    assert.ok(ranked.findings.every((f) => f.grounded));
    assert.ok(
      findings.some((f) => /trap:|you will owe/i.test(f.plain_english)),
      "ranker should refine plain_english"
    );
  });

  it("Ranker never lowers Extractor severity", () => {
    const { findings } = runRankerAgent({
      document_id: "d",
      scan_id: "s",
      prompt_version: "m3.v1",
      extractor_model: "mock",
      reasoning_trace: [],
      findings: [
        {
          risk_type: "early_termination",
          severity: "critical",
          plain_english: "Fee to leave early.",
          quote: "early termination fee equal to two months rent",
          page: 1,
          grounded: true,
        },
      ],
    });
    assert.equal(findings[0]?.severity, "critical");
  });

  it("Ranker cannot introduce a hallucinated quote", () => {
    const poisoned: HandoffPayload = {
      document_id: "d",
      scan_id: "s",
      prompt_version: "m3.v1",
      extractor_model: "mock",
      reasoning_trace: [],
      findings: [
        {
          risk_type: "early_termination",
          severity: "critical",
          plain_english: "Invented",
          quote: "early termination fee of $99999",
          page: 1,
          grounded: false,
        },
      ],
    };
    // Even if somehow marked, validate against pages first in real pipeline;
    // ranker still filters grounded:false
    const { findings } = runRankerAgent(poisoned);
    assert.equal(findings.length, 0);

    const raw = mockExtractRisks(SAMPLE_PAGES).findings;
    const grounded = validateCitations(
      [
        ...raw,
        {
          risk_type: "early_termination",
          severity: "critical",
          plain_english: "fake",
          quote: "early termination fee of $99999",
          page: 1,
        },
      ],
      SAMPLE_PAGES
    );
    assert.ok(!grounded.some((f) => /99999/.test(f.quote)));
  });
});
