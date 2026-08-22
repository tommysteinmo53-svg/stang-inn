import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {parseExternalPreseasonRaw} from "../../../../../lib/fantasy/preseason-raw-parser";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function serverClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw new Error("Supabase server-variabler mangler");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function validUrl(value:string){if(!value)return false;try{const u=new URL(value);return u.protocol==="https:"||u.protocol==="http:"}catch{return false}}
function hockeyLiveMatchId(value:string){try{const u=new URL(value);if(!/(^|\.)hockey\.no$/i.test(u.hostname))return null;const direct=u.searchParams.get("matchId");if(direct&&/^\d+$/.test(direct))return Number(direct);const decoded=decodeURIComponent(value);const m=decoded.match(/[?&]matchId=(\d+)/i);return m?Number(m[1]):null}catch{return null}}
function teamKey(value:any){return String(value??"").trim().toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"")}
function sameTeam(a:any,b:any){const ak=teamKey(a),bk=teamKey(b);return Boolean(ak&&bk&&(ak===bk||ak.includes(bk)||bk.includes(ak)))}
function optionalNumber(value:any){if(value===null||value===undefined||String(value).trim()==="")return null;const parsed=Number(value);return Number.isFinite(parsed)?parsed:null}
function rowValue(row:any,key:string,manualFields:string[]){if(manualFields.includes(key))return String(row?.[key]??0);const value=Number(row?.[key]??0);return value!==0?String(value):""}

async function getGame(sb:any,gameId:number){
 const{data:game,error}=await sb.from("fantasy_preseason_games").select("id,season,game_date,home_team,away_team,notes,source_quality,source_url,source_type,home_score,away_score,status").eq("id",gameId).eq("season","2026/27").maybeSingle();
 if(error)throw error;
 return game;
}

export async function GET(request:NextRequest){
 const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
 try{
  const gameId=Number(new URL(request.url).searchParams.get("gameId"));
  if(!Number.isFinite(gameId)||gameId<=0)return NextResponse.json({ok:false,error:"Velg en treningskamp"},{status:400});
  const sb=serverClient(),game=await getGame(sb,gameId);
  if(!game)return NextResponse.json({ok:false,error:"Fant ikke valgt preseason-kamp"},{status:404});

  const[{data:players,error:playerError},{data:existing,error:statsError}]=await Promise.all([
   sb.from("fantasy_players").select("id,name,team,position").eq("active",true).eq("on_current_roster",true).order("team").order("position").order("name"),
   sb.from("fantasy_preseason_player_stats").select("player_id,raw_player_name,team,position,did_play,goals,assists,shots,plus_minus,pim,saves,goals_against,minutes_played,raw").eq("preseason_game_id",gameId),
  ]);
  if(playerError)throw playerError;if(statsError)throw statsError;
  const eligible=(players||[]).filter((p:any)=>sameTeam(p.team,game.home_team)||sameTeam(p.team,game.away_team));
  const existingByPlayer=new Map((existing||[]).filter((r:any)=>r.player_id).map((r:any)=>[String(r.player_id),r]));
  const roster=eligible.map((p:any)=>{
   const current:any=existingByPlayer.get(String(p.id))||null;
   const manualFields=Array.isArray(current?.raw?.manualEntry?.fields)?current.raw.manualEntry.fields.map(String):[];
   return{
    playerId:p.id,playerName:p.name,team:p.team,position:p.position,
    didPlay:current?.did_play===true,
    goals:rowValue(current,"goals",manualFields),assists:rowValue(current,"assists",manualFields),
    shots:rowValue(current,"shots",manualFields),plusMinus:rowValue(current,"plus_minus",manualFields),
    pim:rowValue(current,"pim",manualFields),saves:rowValue(current,"saves",manualFields),
    goalsAgainst:rowValue(current,"goals_against",manualFields),minutesPlayed:rowValue(current,"minutes_played",manualFields),
    hasSavedData:Boolean(current),
   };
  });

  let homeShots:any="",awayShots:any="";
  const latestManual=String(game.notes||"").split("\n").reverse().find((line:string)=>line.startsWith("ADMIN_MANUAL_PRESEASON "));
  if(latestManual){try{const payload=JSON.parse(latestManual.slice("ADMIN_MANUAL_PRESEASON ".length));homeShots=payload.homeShots??"";awayShots=payload.awayShots??""}catch{}}
  if(homeShots===""&&awayShots===""){
   const sample=(existing||[]).find((r:any)=>r.raw?.team_shots!=null||r.raw?.opponent_shots!=null);
   if(sample){
    if(sameTeam(sample.team,game.home_team)){homeShots=sample.raw?.team_shots??"";awayShots=sample.raw?.opponent_shots??""}
    else if(sameTeam(sample.team,game.away_team)){awayShots=sample.raw?.team_shots??"";homeShots=sample.raw?.opponent_shots??""}
   }
  }

  return NextResponse.json({ok:true,game:{id:game.id,homeTeam:game.home_team,awayTeam:game.away_team,homeScore:game.home_score??"",awayScore:game.away_score??"",homeShots,awayShots,sourceUrl:game.source_url||""},players:roster});
 }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Kunne ikke laste spillerliste"},{status:500})}
}

export async function POST(request:NextRequest){
 const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
 try{
  const body=await request.json();const action=String(body.action||"save");const gameId=Number(body.gameId);const sourceUrl=String(body.sourceUrl||"").trim();const sourceLabel=String(body.sourceLabel||"").trim();const rawData=String(body.rawData||"").trim();
  if(!Number.isFinite(gameId)||gameId<=0)return NextResponse.json({ok:false,error:"Velg en treningskamp"},{status:400});
  if(!validUrl(sourceUrl))return NextResponse.json({ok:false,error:"Legg inn en gyldig http/https-kilde-URL"},{status:400});
  const sb=serverClient(),game=await getGame(sb,gameId);
  if(!game)return NextResponse.json({ok:false,error:"Fant ikke valgt preseason-kamp"},{status:404});

  if(action==="manual"){
   const incoming=Array.isArray(body.players)?body.players:[];
   const playerIds=[...new Set(incoming.map((p:any)=>String(p.playerId||"")).filter(Boolean))];
   const[{data:roster,error:rosterError},{data:existing,error:existingError}]=await Promise.all([
    playerIds.length?sb.from("fantasy_players").select("id,name,team,position").in("id",playerIds).eq("active",true).eq("on_current_roster",true):Promise.resolve({data:[],error:null}),
    sb.from("fantasy_preseason_player_stats").select("*").eq("preseason_game_id",gameId),
   ]);
   if(rosterError)throw rosterError;if(existingError)throw existingError;
   const rosterById=new Map((roster||[]).filter((p:any)=>sameTeam(p.team,game.home_team)||sameTeam(p.team,game.away_team)).map((p:any)=>[String(p.id),p]));
   const existingByPlayer=new Map((existing||[]).filter((r:any)=>r.player_id).map((r:any)=>[String(r.player_id),r]));
   const numericFields=[["goals","goals"],["assists","assists"],["shots","shots"],["plusMinus","plus_minus"],["pim","pim"],["saves","saves"],["goalsAgainst","goals_against"],["minutesPlayed","minutes_played"]] as const;
   let imported=0;
   for(const input of incoming){
    const player:any=rosterById.get(String(input.playerId||""));if(!player)continue;
    const entered=numericFields.filter(([client])=>String(input?.[client]??"").trim()!=="");
    const didPlay=input.didPlay===true;
    if(!didPlay&&!entered.length)continue;
    const current:any=existingByPlayer.get(String(player.id))||{};
    const row:any={
     preseason_game_id:gameId,player_id:player.id,raw_player_name:player.name,team:player.team,position:player.position,
     did_play:didPlay||current.did_play===true,
     goals:Number(current.goals||0),assists:Number(current.assists||0),shots:Number(current.shots||0),plus_minus:Number(current.plus_minus||0),pim:Number(current.pim||0),
     saves:Number(current.saves||0),goals_against:Number(current.goals_against||0),minutes_played:Number(current.minutes_played||0),
     win:current.win??null,shutout:current.shutout??null,powerplay_goals:Number(current.powerplay_goals||0),powerplay_assists:Number(current.powerplay_assists||0),shorthanded_goals:Number(current.shorthanded_goals||0),shorthanded_assists:Number(current.shorthanded_assists||0),
     source_type:"manual",source_quality:0.80,
     raw:{...(current.raw||{}),manualEntry:{sourceUrl,label:sourceLabel||new URL(sourceUrl).hostname,fields:entered.map(([,db])=>db),savedAt:new Date().toISOString()}},
     updated_at:new Date().toISOString(),
    };
    for(const[client,db]of entered){const value=optionalNumber(input[client]);if(value!==null)row[db]=value}
    const{error}=await sb.from("fantasy_preseason_player_stats").upsert(row,{onConflict:"preseason_game_id,raw_player_name,team"});if(error)throw error;imported++;
   }
   const homeScore=optionalNumber(body.homeScore),awayScore=optionalNumber(body.awayScore),homeShots=optionalNumber(body.homeShots),awayShots=optionalNumber(body.awayShots);
   const entry={type:"admin_manual_preseason",url:sourceUrl,label:sourceLabel||new URL(sourceUrl).hostname,homeScore,awayScore,homeShots,awayShots,playerRows:imported,addedAt:new Date().toISOString()};
   const notes=[game.notes,`ADMIN_MANUAL_PRESEASON ${JSON.stringify(entry)}`].filter(Boolean).join("\n");
   const patch:any={source_url:sourceUrl,source_type:"manual",source_quality:Math.max(Number(game.source_quality||0),0.80),notes,updated_at:new Date().toISOString()};
   if(homeScore!==null)patch.home_score=homeScore;if(awayScore!==null)patch.away_score=awayScore;if(homeScore!==null&&awayScore!==null)patch.status="finished";
   const{error:updateError}=await sb.from("fantasy_preseason_games").update(patch).eq("id",gameId);if(updateError)throw updateError;
   return NextResponse.json({ok:true,gameId,game:`${game.home_team} – ${game.away_team}`,label:entry.label,imported,manual:true});
  }

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
  return NextResponse.json({ok:true,gameId,game:`${game.home_team} – ${game.away_team}`,sourceUrl,label:entry.label,hasRawData:!!rawData,hockeyLiveMatchId:null,parsed,imported});
 }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Kunne ikke behandle ekstern kilde"},{status:500})}
}
