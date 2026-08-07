import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMatchProvider, type ProviderName } from "../../../lib/providers";
import type { ImportedMatch } from "../../../types/data-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    return NextResponse.json({ ok: false, error: "Supabase server-variabler mangler." }, { status: 503 });
  }

  let body: { provider?: ProviderName; matches?: ImportedMatch[] } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const providerName: ProviderName = body.provider === "manual" ? "manual" : "nif";
  const provider = getMatchProvider(providerName, body.matches || []);

  try {
    const imported = await provider.fetchMatches();
    const rows = imported.map((match) => ({
      external_id: match.externalId,
      season: match.season,
      round: match.round,
      home_team: match.homeTeam,
      away_team: match.awayTeam,
      match_time: match.matchTime,
      home_score: match.homeScore,
      away_score: match.awayScore,
      finished: match.finished,
    }));

    if (!rows.length) {
      return NextResponse.json({ ok: true, provider: provider.name, imported: 0, message: "Ingen kamper returnert." });
    }

    const supabase = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase.from("matches").upsert(rows, { onConflict: "external_id" });
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      provider: provider.name,
      imported: rows.length,
      finished: rows.filter((row) => row.finished).length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, provider: provider.name, error: error?.message || "Ukjent synkfeil" },
      { status: 500 },
    );
  }
}
