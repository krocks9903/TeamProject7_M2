import { NextResponse } from "next/server";
import { getStore } from "@fineprint/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECENT = 50;

/**
 * GET /api/events/recent: the last ~50 sanitized events across all scans, plus a cursor.
 * With ?after=<cursor> it returns only newer events (the polling fallback for the stream).
 * Sanitized means counts, timing and truncated filenames only; never quotes or document text.
 */
export async function GET(req: Request) {
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0) || 0;
  const { events, cursor } = await getStore().feed.list(after, after === 0 ? RECENT : undefined);
  return NextResponse.json({ events, cursor });
}
