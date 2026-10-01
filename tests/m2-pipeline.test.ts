import { describe, it } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import {
  mockExtractRisks,
  Orchestrator,
  resetStoreForTests,
  validateCitations,
} from "@fineprint/agent";
import { parsePdfBuffer } from "@fineprint/mcp-document";
import type { DocumentPage, RiskFinding } from "@fineprint/shared";
import {
  buildSimplePdf,
  FIXTURE_GYM_LINES,
  FIXTURE_LEASE_LINES,
  FIXTURE_TRAP_LINES,
} from "./fixtures/pdf.js";

process.env.MODEL_PROVIDER = "mock";

describe("MCP document_parse", () => {
  it("extracts page-mapped text from a lease PDF", async () => {
    const buf = await buildSimplePdf(FIXTURE_LEASE_LINES);
    const result = await parsePdfBuffer(buf);
    assert.ok(result.meta.pageCount >= 1);
    assert.ok(result.meta.charCount > 0);
    const blob = result.pages.map((p) => p.text).join(" ");
    assert.match(blob, /early termination fee/i);
    assert.match(blob, /renews automatically/i);
  });
});

describe("citation validator", () => {
  const pages: DocumentPage[] = [
    {
      page: 1,
      text: "Tenant pays a late fee of $50 if rent is past due.",
    },
  ];

  it("keeps grounded quotes", () => {
    const findings: RiskFinding[] = [
      {
        risk_type: "late_fee",
        severity: "medium",
        plain_english: "Late fee applies.",
        quote: "late fee of $50",
        page: 1,
      },
    ];
    const out = validateCitations(findings, pages);
    assert.equal(out.length, 1);
    assert.equal(out[0].grounded, true);
  });

  it("drops hallucinated fees (fail closed)", () => {
    const findings: RiskFinding[] = [
      {
        risk_type: "early_termination",
        severity: "critical",
        plain_english: "Invented fee",
        quote: "early termination fee of $2000",
        page: 1,
      },
    ];
    const out = validateCitations(findings, pages);
    assert.equal(out.length, 0);
  });
});

describe("M2 test cases (inputs + expected outputs)", () => {
  it("case 1 — golden lease: finds early termination + auto-renewal with citations", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "fp-lease-"));
    resetStoreForTests(dir);
    process.env.FINEPRINT_DATA_DIR = dir;
    const orch = new Orchestrator(resetStoreForTests(dir));
    const res = await orch.createAndProcess({
      ownerId: "test-owner",
      filename: "lease.pdf",
      mime: "application/pdf",
      buffer: await buildSimplePdf(FIXTURE_LEASE_LINES),
    });
    assert.equal(res.status, "done");
    const detail = await orch.getScanDetail(res.scan_id);
    assert.ok(detail);
    const types = new Set(detail!.findings.map((f) => f.risk_type));
    assert.ok(types.has("early_termination"), "expected early_termination");
    assert.ok(types.has("auto_renewal"), "expected auto_renewal");
    for (const f of detail!.findings) {
      assert.equal(f.grounded, true);
      assert.ok(f.quote.length >= 8);
    }
  });

  it("case 2 — gym contract: finds auto-renewal / notice / cancellation fee", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "fp-gym-"));
    const orch = new Orchestrator(resetStoreForTests(dir));
    const res = await orch.createAndProcess({
      ownerId: "test-owner",
      filename: "gym.pdf",
      mime: "application/pdf",
      buffer: await buildSimplePdf(FIXTURE_GYM_LINES),
    });
    assert.equal(res.status, "done");
    const detail = await orch.getScanDetail(res.scan_id);
    assert.ok(detail);
    const types = new Set(detail!.findings.map((f) => f.risk_type));
    assert.ok(
      types.has("auto_renewal") || types.has("notice_window") || types.has("early_termination"),
      `expected renewal/notice/fee risks, got ${[...types]}`
    );
  });

  it("case 3 — hallucination trap: must NOT invent early termination fee", async () => {
    const pages: DocumentPage[] = [
      { page: 1, text: FIXTURE_TRAP_LINES.join(" ") },
    ];
    // Simulate a bad model inventing a fee:
    const invented: RiskFinding[] = [
      {
        risk_type: "early_termination",
        severity: "critical",
        plain_english: "You owe $2000 to cancel.",
        quote: "early termination fee of $2000",
        page: 1,
      },
      ...mockExtractRisks(pages).findings,
    ];
    const grounded = validateCitations(invented, pages);
    assert.ok(
      grounded.every((f) => !/2000/.test(f.quote)),
      "invented $2000 fee must be dropped"
    );
    assert.ok(
      !grounded.some((f) => /early termination fee of \$2000/i.test(f.quote)),
      "hallucinated quote must fail closed"
    );

    const dir = await mkdtemp(path.join(os.tmpdir(), "fp-trap-"));
    const orch = new Orchestrator(resetStoreForTests(dir));
    const res = await orch.createAndProcess({
      ownerId: "test-owner",
      filename: "trap.pdf",
      mime: "application/pdf",
      buffer: await buildSimplePdf(FIXTURE_TRAP_LINES),
    });
    const detail = await orch.getScanDetail(res.scan_id);
    assert.ok(detail);
    assert.ok(
      !detail!.findings.some((f) => /\$2000|2000/.test(f.quote + f.plain_english)),
      "pipeline must not surface invented dollar amounts"
    );
  });
});
