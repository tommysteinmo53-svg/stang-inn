import { NextRequest, NextResponse } from "next/server";
import { probePublicHockeyLiveStats } from "../../../lib/fantasy/public-hockeylive";

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

  const url = new URL(request.url);
  const seasonId = url.searchParams.get("seasonId") || undefined;
  const tournamentId = url.searchParams.get("tournamentId") || undefined;

  try {
    const result = await probePublicHockeyLiveStats({ seasonId, tournamentId });
    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Ukjent feil ved offentlig HockeyLive-probe" },
      { status: 500 },
    );
  }
}
