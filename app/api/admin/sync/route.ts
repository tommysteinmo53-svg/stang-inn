import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncMatches } from "../../../../lib/sync-service";
import type { ImportedMatch } from "../../../../types/data-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({ ok: false, error: "Supabase public-konfigurasjon mangler." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ ok: false, error: "Mangler innlogging." }, { status: 401 });

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ ok: false, error: "Ugyldig innlogging." }, { status: 401 });

  const { data: player } = await authClient
    .from("players")
    .select("admin")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!player?.admin) return NextResponse.json({ ok: false, error: "Kun admin kan synkronisere." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const testMatchId = Number(body?.testMatchId);

  if (Number.isInteger(testMatchId) && testMatchId > 0) {
    const { data: match, error } = await authClient
      .from("matches")
      .select("id,external_id,season,round,home_team,away_team,match_time,home_score,away_score,finished")
      .eq("id", testMatchId)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    if (!match) return NextResponse.json({ ok: false, error: "Testkampen ble ikke funnet." }, { status: 404 });
    if (!match.external_id || !match.match_time) {
      return NextResponse.json({ ok: false, error: "Testkampen mangler external_id eller kampstart." }, { status: 400 });
    }

    // Testmodus toggler status gjennom nøyaktig samme sync-service som ekte import.
    // Dermed kan vi teste både ferdig -> åpnet og åpnet -> ferdig uten å røre andre kamper.
    const targetFinished = !match.finished;
    const manualMatch: ImportedMatch = {
      externalId: match.external_id,
      season: match.season || "TEST",
      round: match.round,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      matchTime: match.match_time,
      homeScore: match.home_score,
      awayScore: match.away_score,
      finished: targetFinished,
    };

    const result = await syncMatches("manual", [manualMatch]);
    return NextResponse.json({ ...result, testMatchId, testFinished: targetFinished }, { status: result.ok ? 200 : 500 });
  }

  const result = await syncMatches("hockeylive");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
