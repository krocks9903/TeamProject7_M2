import { describe, it } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import {
  EventEmitter,
  GlobalFeed,
  JsonlEventSink,
  Orchestrator,
  TeeSink,
  publicEvent,
  resetStoreForTests,
  truncateFilename,
} from "@fineprint/agent";
import type { FeedEvent, ScanEvent } from "@fineprint/shared";
import { groupScans } from "../apps/web/src/mission-control/feedScans.ts";
import { buildSimplePdf, FIXTURE_LEASE_LINES } from "./fixtures/pdf.js";

process.env.MODEL_PROVIDER = "mock";

const SECRET = "Tenant shall forfeit the entire security deposit of $9,999";

describe("publicEvent (no document text in the global feed)", () => {
  it("removes dropped quotes from message and data", () => {
    const e: ScanEvent = {
      scanId: "s",
      ts: 1,
      seq: 3,
      agent: "validator",
      type: "progress",
      message: `Not in document: "${SECRET}"`,
      data: { droppedQuote: { quote: SECRET, page: 2, reason: "not in document" } },
    };
    const out = publicEvent(e);
    assert.ok(!JSON.stringify(out).includes("forfeit"), JSON.stringify(out));
    assert.match(out.message, /not in document/);
    assert.equal(out.data?.droppedQuote, undefined);
  });

  it("drops the quote list from the validator finish but keeps the counts", () => {
    const out = publicEvent({
      scanId: "s",
      ts: 1,
      seq: 4,
      agent: "validator",
      type: "finish",
      message: "Kept 5, threw out 2 I couldn't find in the document",
      data: {
        kept: 5,
        dropped: 2,
        droppedQuotes: [{ quote: SECRET, page: 1, reason: "not in document" }],
      },
    });
    assert.equal(out.data?.kept, 5);
    assert.equal(out.data?.dropped, 2);
    assert.ok(!JSON.stringify(out).includes("forfeit"));
  });

  it("truncates filenames in both message and data", () => {
    const name = "sec-1692415-ex10-1-commercial-lease-confidential-john-smith.pdf";
    const out = publicEvent({
      scanId: "s",
      ts: 1,
      seq: 1,
      agent: "intake",
      type: "start",
      message: `Received ${name}`,
      data: { filename: name, bytes: 100 },
    });
    assert.ok(out.message.length < 40, out.message);
    assert.ok((out.data?.filename as string).length <= 24);
    assert.ok((out.data?.filename as string).endsWith(".pdf"));
    assert.ok(!JSON.stringify(out).includes("john-smith"));
  });

  it("masks anything between double quotes and caps the length", () => {
    const out = publicEvent({
      scanId: "s",
      ts: 1,
      seq: 1,
      agent: "parser",
      type: "error",
      message: `Bad page near "${SECRET}" ${"x".repeat(400)}`,
    });
    assert.ok(!out.message.includes("forfeit"));
    assert.ok(out.message.length <= 160);
  });

  it("drops unknown data fields", () => {
    const out = publicEvent({
      scanId: "s",
      ts: 1,
      seq: 1,
      agent: "extractor",
      type: "progress",
      message: "ok",
      data: { proposed: 3, plain_english: SECRET } as never,
    });
    assert.equal(out.data?.proposed, 3);
    assert.ok(!JSON.stringify(out).includes("forfeit"));
  });
});

describe("truncateFilename", () => {
  it("keeps short names and the extension of long ones", () => {
    assert.equal(truncateFilename("lease.pdf"), "lease.pdf");
    const t = truncateFilename("a-very-long-document-name-indeed.pdf");
    assert.ok(t.length <= 24 && t.endsWith(".pdf") && t.includes("…"));
  });
});

describe("GlobalFeed", () => {
  it("returns the last N on first load, then only newer events by cursor", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "fp-feed-"));
    const feed = new GlobalFeed(dir);
    for (let i = 1; i <= 5; i++) {
      await feed.append({ scanId: "a", ts: i, seq: i, agent: "intake", type: "progress", message: `m${i}` });
    }
    const recent = await feed.list(0, 3);
    assert.deepEqual(recent.events.map((e) => e.message), ["m3", "m4", "m5"]);
    assert.equal(recent.cursor, 5);
    assert.deepEqual(recent.events.map((e) => e.feedId), [3, 4, 5]);
    await feed.append({ scanId: "b", ts: 6, seq: 1, agent: "intake", type: "start", message: "m6" });
    const next = await feed.list(recent.cursor);
    assert.deepEqual(next.events.map((e) => e.message), ["m6"]);
    assert.equal(next.cursor, 6);
  });

  it("is empty when nothing has run", async () => {
    const feed = new GlobalFeed(await mkdtemp(path.join(os.tmpdir(), "fp-feed-")));
    assert.deepEqual(await feed.list(0, 50), { events: [], cursor: 0 });
  });

  it("TeeSink keeps the full event per scan but only the sanitized one in the feed", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "fp-tee-"));
    const feed = new GlobalFeed(dir);
    const sink = new TeeSink(new JsonlEventSink(dir), feed);
    const id = "99999999-2222-3333-4444-555555555555";
    await new EventEmitter(id, sink).emit("validator", "progress", `Not in document: "${SECRET}"`, {
      droppedQuote: { quote: SECRET, page: 1, reason: "not in document" },
    });
    const full = await sink.list(id);
    assert.equal(full[0].data?.droppedQuote?.quote, SECRET);
    const pub = await feed.list(0, 10);
    assert.ok(!JSON.stringify(pub.events).includes("forfeit"));
  });
});

describe("orchestrator feeds the global feed", () => {
  it("a real scan appears in the feed with counts and no document text", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "fp-orch-feed-"));
    const store = resetStoreForTests(dir);
    const orch = new Orchestrator(store);
    const buffer = await buildSimplePdf(FIXTURE_LEASE_LINES);
    await orch.createAndProcess({ ownerId: "o", filename: "lease.pdf", mime: "application/pdf", buffer });
    const { events } = await store.feed.list(0, 50);
    assert.ok(events.some((e) => e.agent === "validator" && e.type === "finish"));
    assert.ok(events.at(-1)?.data?.scanDone);
    const blob = JSON.stringify(events).toLowerCase();
    for (const line of FIXTURE_LEASE_LINES) {
      assert.ok(!blob.includes(line.toLowerCase().slice(0, 25)), `leaked: ${line}`);
    }
  });
});

describe("groupScans", () => {
  const ev = (scanId: string, seq: number, ts: number, data?: ScanEvent["data"]): FeedEvent => ({
    scanId,
    seq,
    ts,
    feedId: ts,
    agent: "intake",
    type: "progress",
    message: "m",
    data,
  });

  it("groups by scan, newest first, and marks running vs finished", () => {
    const now = 100_000;
    const scans = groupScans(
      [ev("old", 1, 1000, { filename: "a.pdf" }), ev("old", 2, 2000, { scanDone: true }), ev("new", 1, 99_000)],
      now
    );
    assert.deepEqual(scans.map((s) => s.id), ["new", "old"]);
    assert.equal(scans[0].active, true);
    assert.equal(scans[1].active, false);
    assert.equal(scans[1].done, true);
    assert.equal(scans[1].filename, "a.pdf");
  });

  it("treats a long-silent unfinished scan as stalled, not running", () => {
    const scans = groupScans([ev("x", 1, 1000)], 1000 + 10 * 60_000);
    assert.equal(scans[0].active, false);
  });

  it("is empty with no events", () => {
    assert.deepEqual(groupScans([], Date.now()), []);
  });
});
