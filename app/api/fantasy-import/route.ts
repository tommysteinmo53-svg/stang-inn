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

async function persistedCoverage(matchId:number, season:string){
  const sbUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY;
  if(!sbUrl||!secret) throw new Error("Supabase server-konfigurasjon mangler");
  const db=createClient(sbUrl,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const candidates=[`hockeylive:${matchId}`,String(matchId),`nif:${matchId}`];
  const {data:games,error:ge}=await db.from("fantasy_games").select("id,external_id").eq("season",season).in("external_id",candidates);
  if(ge)throw ge;
  if(!games?.length) return {gameIds:[],skaters:0,goalies:0,total:0};
  const gameIds=games.map((g:any)=>g.id);
  const {data:rows,error:se}=await db.from("fantasy_player_game_stats").select("game_id,did_play,position_snapshot").in("game_id",gameIds);
  if(se)throw se;
  let skaters=0,goalies=0,total=0;
  for(const r of rows||[]){if(r.did_play===false)continue;total++;if(String(r.position_snapshot||"").toUpperCase()==="G")goalies++;else skaters++;}
  return {gameIds,externalIds:games.map((g:any)=>g.external_id),skaters,goalies,total};
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
    const before=await persistedCoverage(matchId,season);
    const result:any = await importFantasyMatch(matchId, { season, tournamentId });
    const after=await persistedCoverage(matchId,season);
    result.persistedCoverage={before,after};
    if(after.skaters<20||after.goalies<2){
      return NextResponse.json({ok:false,error:`Ufullstendig lagring for kamp ${matchId}: importer rapporterte ${Number(result?.importedSkaters||0)} utespillere + ${Number(result?.importedGoalies||0)} keepere, men databasen inneholder ${after.skaters} utespillere + ${after.goalies} keepere etter import.`,result},{status:422});
    }
    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Ukjent importfeil" }, { status: 500 });
  }
}
