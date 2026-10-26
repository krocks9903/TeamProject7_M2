/**
 * Extract deadline / payment-due style dates from email or document text
 * for calendar proposals. Deterministic regex — citations preferred when present.
 */

import { randomUUID } from "node:crypto";
import type { CalendarEvent } from "@fineprint/shared";

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return dt.toISOString().slice(0, 10);
}

/**
 * Pull dated reminders from free text. Returns proposed CalendarEvent drafts (no ids persisted).
 */
export function extractDeadlineEvents(
  text: string,
  opts: {
    related_email_id?: string;
    related_scan_id?: string;
    source?: CalendarEvent["source"];
    titlePrefix?: string;
  } = {}
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const seen = new Set<string>();

  const patterns: Array<{ re: RegExp; title: string }> = [
    {
      re: /(?:notice|signing|payment|due|deadline|renew(?:al)?)[^\n.]{0,40}?(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/gi,
      title: "Contract deadline",
    },
    {
      re: /(?:notice|signing|payment|due|deadline)[^\n.]{0,60}?(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:,\s*)?(\d{4})/gi,
      title: "Contract deadline",
    },
    {
      re: /(?:notice deadline|payment due|signing deadline)\s*:\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})/gi,
      title: "Stated deadline",
    },
  ];

  for (const { re, title } of patterns) {
    let m: RegExpExecArray | null;
    const regex = new RegExp(re.source, re.flags);
    while ((m = regex.exec(text)) !== null) {
      let iso: string | null = null;
      const quote = m[0].replace(/\s+/g, " ").trim().slice(0, 160);

      if (/^\d/.test(m[1] ?? "")) {
        // numeric date mm/dd/yyyy or dd/mm — assume US mm/dd/yyyy for demo
        let month = Number(m[1]);
        let day = Number(m[2]);
        let year = Number(m[3]);
        if (year < 100) year += 2000;
        iso = toIsoDate(year, month, day);
      } else {
        const month = MONTHS[(m[1] ?? "").toLowerCase()];
        const day = Number(m[2]);
        const year = Number(m[3]);
        if (month) iso = toIsoDate(year, month, day);
      }

      if (!iso) continue;
      const key = `${iso}|${quote}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const lower = quote.toLowerCase();
      let specific = title;
      if (lower.includes("notice")) specific = "Notice / non-renewal deadline";
      else if (lower.includes("payment") || lower.includes("due")) specific = "Payment due";
      else if (lower.includes("signing") || lower.includes("sign")) specific = "Signing deadline";

      events.push({
        id: randomUUID(),
        title: opts.titlePrefix ? `${opts.titlePrefix}: ${specific}` : specific,
        starts_at: iso,
        all_day: true,
        source: opts.source ?? "email",
        related_email_id: opts.related_email_id,
        related_scan_id: opts.related_scan_id,
        quote,
      });
    }
  }

  return events;
}
