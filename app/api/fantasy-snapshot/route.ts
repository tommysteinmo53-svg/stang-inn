import { NextRequest, NextResponse } from "next/server";
import { captureAndMaterializeFantasySnapshot, captureFantasySnapshot, materializeLatestSnapshotDelta } from "../../../lib/fantasy/snapshot-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "capture-and-materialize";
  try {
    if (action === "capture") return NextResponse.json({ ok: true, result: await captureFantasySnapshot() });
    if (action === "materialize") return NextResponse.json({ ok: true, result: await materializeLatestSnapshotDelta() });
    return NextResponse.json({ ok: true, result: await captureAndMaterializeFantasySnapshot() });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Ukjent snapshot-feil" }, { status: 500 });
  }
}
