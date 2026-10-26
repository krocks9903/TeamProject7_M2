import { describe, it } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readdir } from "node:fs/promises";
import {
  EventEmitter,
  JsonlEventSink,
  MemoryEventSink,
  Orchestrator,
  resetStoreForTests,
  validateCitations,
  validateCitationsDetailed,
  type EventSink,
} from "@fineprint/agent";
import type { RiskFinding, ScanEvent } from "@fineprint/shared";
import { buildSimplePdf, FIXTURE_LEASE_LINES } from "./fixtures/pdf.js";

process.env.MODEL_PROVIDER = "mock";

describe("EventEmitter", () => {
  it("stamps scanId, ts and increasing seq, and persists in order", async () => {
    const sink = new MemoryEventSink();
    let t = 1000;
    const em = new EventEmitter("scan-1", sink, () => t++);
    await em.emit("intake", "start", "hello", { filename: "a.pdf" });
    await em.emit("parser", "finish", "Read 2 pages", { pageCount: 2 });
    const all = await sink.list("scan-1");
    assert.deepEqual(all.map((e) => e.seq), [1, 2]);
    assert.equal(all[0].scanId, "scan-1");
    assert.equal(all[0].ts, 1000);
    assert.equal(all[1].data?.pageCount, 2);
  });

  it("lists only events after a given seq and isolates scans", async () => {
    const sink = new MemoryEventSink();
    const a = new EventEmitter("a", sink);
    const b = new EventEmitter("b", sink);
    await a.emit("intake", "start", "1");
    await a.emit("intake", "finish", "2");
    await b.emit("intake", "start", "x");
    assert.equal((await sink.list("a", 1)).length, 1);
    assert.equal((await sink.list("b")).length, 1);
  });

  it("never throws into the pipeline when the sink fails", async () => {
    const bad: EventSink = {
      append: async () => {
        throw new Error("disk full");
      },
      list: async () => [],
    };
    const em = new EventEmitter("s", bad);
    const e = await em.emit("intake", "start", "still fine");
    assert.equal(e.message, "still fine");
  });

  it("round-trips through the JSONL sink, keeping emit order", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "fp-ev-"));
    const sink = new JsonlEventSink(dir);
    const id = "11111111-2222-3333-4444-555555555555";
    const em = new EventEmitter(id, sink);
    await Promise.all([
      em.emit("intake", "start", "one"),
      em.emit("intake", "finish", "two"),
      em.emit("parser", "start", "three"),
    ]);
    const list = await sink.list(id);
    assert.deepEqual(list.map((e) => e.message), ["one", "two", "three"]);
  });
});

describe("validateCitationsDetailed", () => {
  const pages = [{ page: 1, text: "Tenant pays a late fee of $50 if rent is past due." }];
  const finding = (quote: string): RiskFinding => ({
    risk_type: "late_fee",
    severity: "medium",
    plain_english: "x",
    quote,
    page: 1,
  });

  it("reports dropped quotes with reasons and matches validateCitations", () => {
    const input = [finding("late fee of $50"), finding("a $9,999 termination penalty applies")];
    const { kept, dropped } = validateCitationsDetailed(input, pages);
    assert.equal(kept.length, 1);
    assert.equal(dropped.length, 1);
    assert.equal(dropped[0].quote, "a $9,999 termination penalty applies");
    assert.equal(dropped[0].reason, "not in document");
    assert.deepEqual(validateCitations(input, pages), kept);
  });
});

describe("orchestrator events", () => {
  async function setup() {
    const dir = await mkdtemp(path.join(os.tmpdir(), "fp-orch-"));
    const orch = new Orchestrator(resetStoreForTests(dir));
    const buffer = await buildSimplePdf(FIXTURE_LEASE_LINES);
    const input = { ownerId: "o", filename: "lease.pdf", mime: "application/pdf", buffer };
    return { dir, orch, input };
  }

  async function waitDone(orch: Orchestrator, id: string): Promise<ScanEvent[]> {
    for (let i = 0; i < 100; i++) {
      const ev = await orch.getEvents(id);
      if (ev.some((e) => e.data?.scanDone || e.data?.scanFailed)) return ev;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("scan never finished");
  }

  it("emits the real step sequence for a scan", async () => {
    const { orch, input } = await setup();
    const res = await orch.createAndProcess(input);
    const ev = await orch.getEvents(res.scan_id);
    const steps = ev.map((e) => `${e.agent}:${e.type}`);
    for (const expected of [
      "intake:start",
      "intake:finish",
      "parser:start",
      "parser:finish",
      "extractor:start",
      "extractor:finish",
      "validator:start",
      "validator:finish",
      "ranker:start",
      "ranker:finish",
    ]) {
      assert.ok(steps.includes(expected), `missing ${expected} in ${steps.join(", ")}`);
    }
    assert.deepEqual(ev.map((e) => e.seq), ev.map((_, i) => i + 1));
    const parserDone = ev.find((e) => e.agent === "parser" && e.type === "finish");
    assert.ok((parserDone?.data?.pageCount ?? 0) >= 1);
    const validatorDone = ev.find((e) => e.agent === "validator" && e.type === "finish");
    assert.equal(typeof validatorDone?.data?.kept, "number");
    assert.equal(validatorDone?.data?.dropped, 0);
    assert.equal(ev.at(-1)?.data?.scanDone, true);
  });

  it("startScan returns before the pipeline finishes and still completes", async () => {
    const { orch, input } = await setup();
    const res = await orch.startScan(input);
    assert.equal(res.status, "queued");
    const ev = await waitDone(orch, res.scan_id);
    assert.equal(ev.at(-1)?.data?.scanDone, true);
    const detail = await orch.getScanDetail(res.scan_id);
    assert.equal(detail?.scan.status, "done");
  });

  it("reports a cache hit honestly, with no model events", async () => {
    const { orch, input } = await setup();
    await orch.createAndProcess(input);
    const second = await orch.createAndProcess(input);
    assert.equal(second.cache_hit, true);
    const ev = await orch.getEvents(second.scan_id);
    assert.ok(!ev.some((e) => e.agent === "extractor"));
    assert.equal(ev.at(-1)?.data?.cacheHit, true);
    assert.equal(ev.at(-1)?.data?.scanDone, true);
  });

  it("emits an error event when the scan fails", async () => {
    const { dir, orch } = await setup();
    const junk = Buffer.from("%PDF-1.4 not really a pdf");
    await assert.rejects(
      orch.createAndProcess({ ownerId: "o", filename: "bad.pdf", mime: "application/pdf", buffer: junk })
    );
    const files = (await readdir(path.join(dir, "events"))).filter((f) => !f.startsWith("_"));
    assert.equal(files.length, 1);
    const ev = await orch.getEvents(files[0].replace(".jsonl", ""));
    const err = ev.find((e) => e.type === "error");
    assert.ok(err, "expected an error event");
    assert.equal(err?.data?.scanFailed, true);
  });
});
