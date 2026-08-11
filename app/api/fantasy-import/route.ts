import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { importFantasyMatch } from "../../../lib/fantasy/import-enrichment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return { ok: false as const, response: NextResponse.json({ ok: false, error: "Supabase public-konfigurasjon mangler." }, { status: 503 }) };
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { ok: false as const, response: NextResponse.json({ ok: false, error: "Mangler innlogging." }, { status: 401 }) };
  const authClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return { ok: false as const, response: NextResponse.json({ ok: false, error: "Ugyldig innlogging." }, { status: 401 }) };
  const { data: player } = await authClient.from("players").select("admin").eq("id", userData.user.id).maybeSingle();
  if (!player?.admin) return { ok: false as const, response: NextResponse.json({ ok: false, error: "Kun admin kan importere Fantasy-kamper." }, { status: 403 }) };
  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const url = new URL(request.url);
  const matchId = Number(url.searchParams.get("matchId") || "8183135");
  const season = url.searchParams.get("season") || "2025/26";
  const tournamentId = url.searchParams.get("tournamentId") || "435587";
  if (!Number.isInteger(matchId) || matchId <= 0) return NextResponse.json({ ok: false, error: "Ugyldig matchId." }, { status: 400 });
  try {
    const result:any = await importFantasyMatch(matchId, { season, tournamentId });
    const skaters=Number(result?.importedSkaters||0),goalies=Number(result?.importedGoalies||0);
    if(skaters<20||goalies<2){
      return NextResponse.json({ok:false,error:`Ufullstendig HockeyLive-data for kamp ${matchId}: ${skaters} utespillere + ${goalies} keepere. Kampen beholdes som ufullstendig og forsøkes igjen senere.`,result},{status:422});
    }
    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Ukjent importfeil" }, { status: 500 });
  }
}
