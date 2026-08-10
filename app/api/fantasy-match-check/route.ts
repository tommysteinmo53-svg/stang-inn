import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculate19FantasyPoints } from "../../../lib/fantasy/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { ok:false as const, response:NextResponse.json({ok:false,error:"Supabase public-konfigurasjon mangler."},{status:503}) };
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { ok:false as const, response:NextResponse.json({ok:false,error:"Mangler innlogging."},{status:401}) };
  const auth = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:userData,error:userError}=await auth.auth.getUser(token);
  if(userError||!userData.user)return{ok:false as const,response:NextResponse.json({ok:false,error:"Ugyldig innlogging."},{status:401})};
  const {data:player}=await auth.from("players").select("admin").eq("id",userData.user.id).maybeSingle();
  if(!player?.admin)return{ok:false as const,response:NextResponse.json({ok:false,error:"Kun admin kan se Fantasy-kontroll."},{status:403})};
  return {ok:true as const};
}

function serverClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error("Supabase server-variabler mangler");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function GET(request:NextRequest){
  const admin=await requireAdmin(request); if(!admin.ok)return admin.response;
  const url=new URL(request.url); const matchId=Number(url.searchParams.get("matchId")||"8183135");
  const supabase=serverClient();
  try{
    const candidates=[`hockeylive:${matchId}`,String(matchId),`nif:${matchId}`];
    const {data:game,error:gameError}=await supabase.from("fantasy_games").select("id,home_team,away_team,home_score,away_score,season").in("external_id",candidates).maybeSingle();
    if(gameError)throw gameError; if(!game)throw new Error(`Fant ikke kamp ${matchId}`);
    const {data:stats,error:statsError}=await supabase.from("fantasy_player_game_stats").select("player_id,goals,assists,shots,plus_minus,pim,saves,goals_against,minutes_played,win,shutout,did_play,position_snapshot,team_snapshot").eq("game_id",game.id);
    if(statsError)throw statsError;
    const ids=[...new Set((stats??[]).map((r:any)=>r.player_id))];
    const {data:players,error:playersError}=ids.length?await supabase.from("fantasy_players").select("id,name,team,position").in("id",ids):{data:[],error:null};
    if(playersError)throw playersError;
    const byId=new Map((players??[]).map((p:any)=>[p.id,p]));
    const rows=(stats??[]).map((s:any)=>{
      const p:any=byId.get(s.player_id)||{};
      const position=s.position_snapshot||p.position||"";
      const goaliePlayed=Number(s.minutes_played||0)>0||Number(s.saves||0)>0||Number(s.goals_against||0)>0;
      const didPlay=position==="G" ? goaliePlayed : Boolean(s.did_play);
      const base={
        name:p.name||"Ukjent",team:s.team_snapshot||p.team||"",position,
        goals:s.goals||0,assists:s.assists||0,shots:s.shots||0,plusMinus:s.plus_minus||0,pim:s.pim||0,
        saves:s.saves||0,goalsAgainst:s.goals_against||0,minutesPlayed:Number(s.minutes_played||0),
        win:s.win,shutout:s.shutout,didPlay,
      };
      const points=calculate19FantasyPoints(base);
      return {...base,fantasyPoints:points.total,pointBreakdown:points};
    }).sort((a:any,b:any)=>a.team.localeCompare(b.team)||a.position.localeCompare(b.position)||a.name.localeCompare(b.name));
    return NextResponse.json({ok:true,result:{matchId,game,rows}});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Ukjent kontrollfeil"},{status:500});}
}
