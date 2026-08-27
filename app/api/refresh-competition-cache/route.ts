import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase server-variabler mangler." },
      { status: 503 },
    );
  }

  const season = process.env.NIF_SEASON_LABEL || "2026/27";
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const startedAt = Date.now();
  const { data: tippingRows, error: tippingError } = await supabase.rpc(
    "refresh_tipping_leaderboard_cache_v1",
  );
  if (tippingError) {
    return NextResponse.json(
      { ok: false, error: `Tipping-cache: ${tippingError.message}` },
      { status: 500 },
    );
  }

  const { data: fantasyRows, error: fantasyError } = await supabase.rpc(
    "refresh_fantasy_season_leaderboard_cache_v1",
    { p_season: season },
  );
  if (fantasyError) {
    return NextResponse.json(
      { ok: false, error: `Fantasy-cache: ${fantasyError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    season,
    tippingRows: Number(tippingRows ?? 0),
    fantasyRows: Number(fantasyRows ?? 0),
    durationMs: Date.now() - startedAt,
    refreshedAt: new Date().toISOString(),
  });
}
