import { getStore } from "@fineprint/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICK_MS = 400;
const HEARTBEAT_MS = 15_000;
/** The browser reconnects on its own with Last-Event-ID, so streams need not live forever. */
const MAX_STREAM_MS = 5 * 60_000;

/**
 * GET /api/events/stream: Server-Sent Events for ALL scans as they happen (sanitized).
 * Starts after ?after=<cursor> or Last-Event-ID; with neither, it starts from "now".
 * It ends when the client disconnects or after MAX_STREAM_MS.
 */
export async function GET(req: Request) {
  const feed = getStore().feed;
  const url = new URL(req.url);
  const given = url.searchParams.get("after") ?? req.headers.get("last-event-id");
  let cursor = given !== null ? Number(given) || 0 : (await feed.list(0)).cursor;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const started = Date.now();
      let lastSent = started;
      send("retry: 1500\n\n");
      try {
        while (!req.signal.aborted && Date.now() - started < MAX_STREAM_MS) {
          const { events } = await feed.list(cursor);
          for (const e of events) {
            cursor = e.feedId;
            send(`id: ${e.feedId}\ndata: ${JSON.stringify(e)}\n\n`);
            lastSent = Date.now();
          }
          if (events.length === 0 && Date.now() - lastSent > HEARTBEAT_MS) {
            send(": keep-alive\n\n");
            lastSent = Date.now();
          }
          await new Promise((r) => setTimeout(r, TICK_MS));
        }
      } catch {
        /* client went away */
      }
      try {
        controller.close();
      } catch {
        /* already closed */
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
