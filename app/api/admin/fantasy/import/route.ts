import { NextRequest, NextResponse } from "next/server";
import { importFantasyMatch, syncFantasySchedule } from "../../../../../lib/fantasy/import-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const result = await syncFantasySchedule();
    return NextResponse.json({ ok: true, ...result, syncedAt: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Ukjent feil" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const matchId = Number(body?.matchId);
    if (!Number.isInteger(matchId) || matchId <= 0) {
      return NextResponse.json({ ok: false, error: "matchId må være et positivt heltall" }, { status: 400 });
    }
    const result = await importFantasyMatch(matchId);
    return NextResponse.json({ ok: true, ...result, syncedAt: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Ukjent feil" }, { status: 500 });
  }
}
