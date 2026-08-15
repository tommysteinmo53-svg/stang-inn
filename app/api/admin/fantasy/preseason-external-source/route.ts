import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {parseExternalPreseasonRaw} from "../../../../../lib/fantasy/preseason-raw-parser";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function serverClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw new Error("Supabase server-variabler mangler");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function validUrl(value:string){try{const u=new URL(value);return u.protocol==="https:"||u.protocol==="http:"}catch{return false}}
function hockeyLiveMatchId(value:string){try{const u=new URL(value);if(!/(^|\.)hockey\.no$/i.test(u.hostname))return null;const direct=u.searchParams.get("matchId");if(direct&&/^\d+$/.test(direct))return Number(direct);const decoded=decodeURIComponent(value);const m=decoded.match(/[?&]matchId=(\d+)/i);return m?Number(m[1]):null}catch{return null}}

export async function POST(request:NextRequest){
 const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
 try{
  const body=await request.json();const action=String(body.action||"save");const gameId=Number(body.gameId);const sourceUrl=String(body.sourceUrl||"").trim();const sourceLabel=String(body.sourceLabel||"").trim();const rawData=String(body.rawData||"").trim();
  if(!Number.isFinite(gameId)||gameId<=0)return NextResponse.json({ok:false,error:"Velg en treningskamp"},{status:400});
  if(!validUrl(sourceUrl))return NextResponse.json({ok:false,error:"Legg inn en gyldig http/https-kilde-URL"},{status:400});
  const sb=serverClient();const{data:game,error:readError}=await sb.from("fantasy_preseason_games").select("id,season,home_team,away_team,notes,source_quality,home_score,away_score,status").eq("id",gameId).eq("season","2026/27").maybeSingle();if(readError)throw readError;if(!game)return NextResponse.json({ok:false,error:"Fant ikke valgt preseason-kamp"},{status:404});

  const matchId=hockeyLiveMatchId(sourceUrl);
  if(matchId&&action!=="preview"){
    const entry={type:"admin_hockeylive_source",url:sourceUrl,label:sourceLabel||new URL(sourceUrl).hostname,rawData:rawData||null,matchId,addedAt:new Date().toISOString()};
    const notes=[game.notes,`ADMIN_HOCKEYLIVE_SOURCE ${JSON.stringify(entry)}`].filter(Boolean).join("\n");
    const{error:updateError}=await sb.from("fantasy_preseason_games").update({source_url:sourceUrl,source_type:"hockeylive",source_quality:0.95,hockeylive_match_id:matchId,notes,updated_at:new Date().toISOString()}).eq("id",gameId);if(updateError)throw updateError;
    return NextResponse.json({ok:true,gameId,game:`${game.home_team} – ${game.away_team}`,sourceUrl,label:entry.label,hasRawData:!!rawData,hockeyliveMatchId:matchId,parsed:null});
  }

  let parsed:any=null;
  if(rawData){
    const{data:players,error:playerError}=await sb.from("fantasy_players").select("id,name,team,position").eq("active",true).eq("on_current_roster",true);if(playerError)throw playerError;
    parsed=parseExternalPreseasonRaw({rawData,homeTeam:game.home_team,awayTeam:game.away_team,players:(players||[]) as any[]});
  }
  if(action==="preview")return NextResponse.json({ok:true,gameId,game:`${game.home_team} – ${game.away_team}`,parsed});

  const entry={type:"admin_external_source",url:sourceUrl,label:sourceLabel||new URL(sourceUrl).hostname,rawData:rawData||null,parsedSummary:parsed?{matchedPlayers:parsed.matchedPlayers,goalEvents:parsed.goalEvents,score:parsed.score}:null,addedAt:new Date().toISOString()};
  const notes=[game.notes,`ADMIN_EXTERNAL_SOURCE ${JSON.stringify(entry)}`].filter(Boolean).join("\n");
  const quality=rawData?0.80:0.65;
  const patch:any={source_url:sourceUrl,source_type:"web",source_quality:Math.max(Number(game.source_quality||0),quality),notes,updated_at:new Date().toISOString()};
  if(action==="apply"&&parsed?.score){patch.home_score=parsed.score.home;patch.away_score=parsed.score.away;patch.status="finished"}
  const{error:updateError}=await sb.from("fantasy_preseason_games").update(patch).eq("id",gameId);if(updateError)throw updateError;

  let imported=0;
  if(action==="apply"&&parsed){
    for(const p of parsed.rows||[]){
      const isGoalie=String(p.position||"")==="G";const hasGoalieData=(p.knownFields||[]).includes("saves")||(p.knownFields||[]).includes("goalsAgainst");
      const row={preseason_game_id:gameId,player_id:p.playerId,raw_player_name:p.playerName,team:p.team,position:p.position,did_play:isGoalie?hasGoalieData:true,goals:Number(p.goals||0),assists:Number(p.assists||0),shots:0,plus_minus:0,pim:0,saves:Number(p.saves||0),goals_against:Number(p.goalsAgainst||0),minutes_played:Number(p.minutesPlayed||0),win:null,shutout:null,powerplay_goals:0,powerplay_assists:0,shorthanded_goals:0,shorthanded_assists:0,source_type:"web",source_quality:quality,raw:{source:"admin-external-raw-parser",sourceUrl,label:entry.label,knownFields:p.knownFields,evidence:p.evidence,parser:"v1"},updated_at:new Date().toISOString()};
      const{error}=await sb.from("fantasy_preseason_player_stats").upsert(row,{onConflict:"preseason_game_id,raw_player_name,team"});if(error)throw error;imported++;
    }
  }
  return NextResponse.json({ok:true,gameId,game:`${game.home_team} – ${game.away_team}`,sourceUrl,label:entry.label,hasRawData:!!rawData,hockeyliveMatchId:null,parsed,imported});
 }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Kunne ikke behandle ekstern kilde"},{status:500})}
}
