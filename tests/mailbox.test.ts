import { describe, it } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import {
  DEMO_INBOX,
  resetMailboxStoreForTests,
} from "@fineprint/mcp-mailbox";
import {
  extractDeadlineEvents,
  triageEmailBodyMock,
} from "@fineprint/agent";

describe("mailbox + calendar (M3)", () => {
  it("lists non-noise demo emails by default", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "fp-mail-"));
    const store = resetMailboxStoreForTests(dir);
    const listed = await store.listEmails("");
    assert.ok(listed.every((m) => !m.labels.includes("noise")));
    assert.ok(listed.some((m) => m.id === "msg_lease_renewal"));
    assert.equal(
      listed.find((m) => m.id === "msg_spam"),
      undefined
    );
  });

  it("extracts notice deadline from lease renewal email", () => {
    const lease = DEMO_INBOX.find((m) => m.id === "msg_lease_renewal")!;
    const events = extractDeadlineEvents(lease.body_text, {
      related_email_id: lease.id,
      source: "email",
    });
    assert.ok(
      events.some((e) => e.starts_at.startsWith("2026-11-15")),
      `expected Nov 15 2026, got ${JSON.stringify(events)}`
    );
  });

  it("mock-triages contractor email for payment / retainer language", () => {
    const msg = DEMO_INBOX.find((m) => m.id === "msg_contractor")!;
    const findings = triageEmailBodyMock(msg);
    assert.ok(findings.length >= 1, "expected at least one grounded finding");
    assert.ok(
      findings.some(
        (f) =>
          f.risk_type === "payment_obligation" ||
          f.risk_type === "deposit_forfeiture"
      ),
      `unexpected types: ${findings.map((f) => f.risk_type)}`
    );
  });

  it("proposes calendar events into the mailbox store", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "fp-cal-"));
    const store = resetMailboxStoreForTests(dir);
    const before = await store.listCalendar();
    await store.proposeCalendarEvent({
      title: "Test reminder",
      starts_at: "2026-12-01",
      all_day: true,
      source: "manual",
    });
    const after = await store.listCalendar();
    assert.equal(after.length, before.length + 1);
  });
});
