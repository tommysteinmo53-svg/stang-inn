import { NextRequest, NextResponse } from "next/server";
import { compareRosters, PreviousPlayer } from "@/lib/fantasy/roster-diff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const previous: PreviousPlayer[] = Array.isArray(body?.previous) ? body.previous : [];

    const origin = new URL(req.url).origin;
    const response = await fetch(`${origin}/api/fantasy-roster-2026`, { cache: "no-store" });
    const current = await response.json();
    if (!response.ok || !current?.ok) {
      return NextResponse.json({ ok: false, error: current?.error || "Kunne ikke hente 26/27-roster" }, { status: 502 });
    }

    const diff = compareRosters(current.rows || [], previous);
    return NextResponse.json({
      ok: true,
      tournamentId: current.tournamentId,
      ...diff,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Ukjent feil" }, { status: 500 });
  }
}
