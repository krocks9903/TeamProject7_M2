import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CalendarEvent, EmailMessage } from "@fineprint/shared";
import { DEMO_CALENDAR, DEMO_INBOX } from "./fixtures.js";

interface MailboxDb {
  emails: EmailMessage[];
  calendar: CalendarEvent[];
}

function emptyDb(): MailboxDb {
  return {
    emails: structuredClone(DEMO_INBOX),
    calendar: structuredClone(DEMO_CALENDAR),
  };
}

export class MailboxStore {
  private dbPath: string;

  constructor(root = path.join(process.cwd(), "data", "mailbox")) {
    this.dbPath = path.join(root, "mailbox.json");
  }

  private async ensure(): Promise<MailboxDb> {
    await mkdir(path.dirname(this.dbPath), { recursive: true });
    try {
      const raw = await readFile(this.dbPath, "utf8");
      return JSON.parse(raw) as MailboxDb;
    } catch {
      const fresh = emptyDb();
      await writeFile(this.dbPath, JSON.stringify(fresh, null, 2), "utf8");
      return fresh;
    }
  }

  private async save(db: MailboxDb): Promise<void> {
    await mkdir(path.dirname(this.dbPath), { recursive: true });
    await writeFile(this.dbPath, JSON.stringify(db, null, 2), "utf8");
  }

  async listEmails(query = ""): Promise<EmailMessage[]> {
    const db = await this.ensure();
    const q = query.trim().toLowerCase();
    if (!q) {
      return db.emails.filter((m) => !m.labels.includes("noise"));
    }
    return db.emails.filter((m) => {
      const hay = `${m.subject} ${m.snippet} ${m.body_text} ${m.from} ${m.labels.join(" ")}`.toLowerCase();
      // Simple token match; supports phrases like "renewal OR invoice"
      const tokens = q.split(/\s+or\s+|[\s]+/i).filter(Boolean);
      return tokens.some((t) => hay.includes(t.replace(/[()]/g, "")));
    });
  }

  async getEmail(id: string): Promise<EmailMessage | null> {
    const db = await this.ensure();
    return db.emails.find((m) => m.id === id) ?? null;
  }

  async listCalendar(): Promise<CalendarEvent[]> {
    const db = await this.ensure();
    return [...db.calendar].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  async proposeCalendarEvent(
    input: Omit<CalendarEvent, "id"> & { id?: string }
  ): Promise<CalendarEvent> {
    const db = await this.ensure();
    const event: CalendarEvent = {
      ...input,
      id: input.id ?? randomUUID(),
    };
    const existing = db.calendar.findIndex((e) => e.id === event.id);
    if (existing >= 0) db.calendar[existing] = event;
    else db.calendar.push(event);
    await this.save(db);
    return event;
  }
}

let singleton: MailboxStore | null = null;

export function getMailboxStore(): MailboxStore {
  if (!singleton) {
    const root = process.env.FINEPRINT_MAILBOX_DIR
      ? process.env.FINEPRINT_MAILBOX_DIR
      : path.join(process.cwd(), "data", "mailbox");
    singleton = new MailboxStore(root);
  }
  return singleton;
}

export function resetMailboxStoreForTests(root: string): MailboxStore {
  singleton = new MailboxStore(root);
  return singleton;
}
