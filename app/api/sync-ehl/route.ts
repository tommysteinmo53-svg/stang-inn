import { NextRequest, NextResponse } from "next/server";
import { syncMatches } from "../../../lib/sync-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncMatches("hockeylive");
  return NextResponse.json(
    { ...result, syncedAt: new Date().toISOString() },
    { status: result.ok ? 200 : 500 },
  );
}
