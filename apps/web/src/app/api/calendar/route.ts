import { NextResponse } from "next/server";
import { getMailboxStore } from "@fineprint/mcp-mailbox";

export const runtime = "nodejs";

export async function GET() {
  const events = await getMailboxStore().listCalendar();
  return NextResponse.json({ events });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.title || !body?.starts_at) {
      return NextResponse.json(
        { error: "title and starts_at required" },
        { status: 400 }
      );
    }
    const event = await getMailboxStore().proposeCalendarEvent({
      title: body.title,
      starts_at: body.starts_at,
      all_day: body.all_day ?? true,
      source: body.source ?? "manual",
      quote: body.quote,
      notes: body.notes,
      related_email_id: body.related_email_id,
      related_scan_id: body.related_scan_id,
    });
    return NextResponse.json(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
