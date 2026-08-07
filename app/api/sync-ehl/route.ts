import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchTournamentMatches, normalizeMatch } from "../../../lib/ehl";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    return NextResponse.json({ ok: false, error: "Mangler SUPABASE_SECRET_KEY eller Supabase URL" }, { status: 500 });
  }

  try {
    const supabase = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const rawMatches = await fetchTournamentMatches();
    const rows = rawMatches
      .map(normalizeMatch)
      .filter((m: any) => m.external_id && m.home_team && m.away_team && m.match_time);

    if (!rows.length) {
      return NextResponse.json({ ok: true, imported: 0, message: "NIF returnerte ingen gyldige kamper" });
    }

    const { error } = await supabase
      .from("matches")
      .upsert(rows, { onConflict: "external_id" });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      imported: rows.length,
      tournamentId: process.env.NIF_TOURNAMENT_ID || "448981",
      syncedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Ukjent synkfeil" }, { status: 500 });
  }
}
