import { NextResponse } from "next/server";
import { getMailboxStore } from "@fineprint/mcp-mailbox";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") ?? "";
  const messages = await getMailboxStore().listEmails(query);
  return NextResponse.json({
    query,
    messages: messages.map((m) => ({
      id: m.id,
      from: m.from,
      subject: m.subject,
      received_at: m.received_at,
      snippet: m.snippet,
      labels: m.labels,
      attachment_count: m.attachments.length,
    })),
  });
}
