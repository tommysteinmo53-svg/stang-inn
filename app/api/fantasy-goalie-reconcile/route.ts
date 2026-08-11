import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const BASE="https://sf34-terminlister-prod-app.azurewebsites.net/";

type Row=Record<string,any>;
function num(v:any,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function nk(v:any){return String(v??"").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function tokens(v:any){return nk(v).split(/\s+/).filter(Boolean)}
function sameName(a:any,b:any){const ak=nk(a),bk=nk(b);if(ak===bk)return true;const at=tokens(a),bt=tokens(b);return at.length>=2&&bt.length>=2&&at[0]===bt[0]&&at[at.length-1]===bt[bt.length-1]}
function rows(payload:any){if(Array.isArray(payload))return payload;if(Array.isArray(payload?.data))return payload.data;if(Array.isArray(payload?.goalies))return payload.goalies;if(Array.isArray(payload?.data?.goalies))return payload.data.goalies;return[]}
function rawSeconds(raw:any){return num(raw?.secondsPlayed??raw?.SecondsPlayed??raw?.playerTimeSeconds??raw?.PlayerTimeSeconds,0)}
function teamKey(v:any){const s=nk(v);if(s.includes("nidaros"))return"nidaros";if(s.includes("lorenskog"))return"lorenskog";if(s.includes("storhamar"))return"storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"oilers";if(s.includes("valerenga"))return"valerenga";if(s.includes("frisk"))return"frisk";if(s.includes("sparta"))return"sparta";if(s.includes("narvik"))return"narvik";if(s.includes("stjernen"))return"stjernen";if(s.includes("lillehammer"))return"lillehammer";if(s.includes("ringerike"))return"ringerike";return s}

async function requireAdmin(request:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return{ok:false as const,response:NextResponse.json({ok:false,error:"Supabase public-konfigurasjon mangler."},{status:503})};
 const header=request.headers.get("authorization"),token=header?.startsWith("Bearer ")?header.slice(7):null;
 if(!token)return{ok:false as const,response:NextResponse.json({ok:false,error:"Mangler innlogging."},{status:401})};
 const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 const{data:userData,error:userError}=await auth.auth.getUser(token);
 if(userError||!userData.user)return{ok:false as const,response:NextResponse.json({ok:false,error:"Ugyldig innlogging."},{status:401})};
 const{data:player}=await auth.from("players").select("admin").eq("id",userData.user.id).maybeSingle();
 if(!player?.admin)return{ok:false as const,response:NextResponse.json({ok:false,error:"Kun admin."},{status:403})};
 return{ok:true as const};
}

export async function POST(request:NextRequest){
 const admin=await requireAdmin(request);if(!admin.ok)return admin.response;
 const url=new URL(request.url),season=url.searchParams.get("season")||"2025/26",tournamentId=(url.searchParams.get("tournamentId")||"435587").replace(/\D/g,"");
 try{
  const secret=process.env.SUPABASE_SECRET_KEY,base=process.env.NEXT_PUBLIC_SUPABASE_URL;if(!secret||!base)throw new Error("Supabase server-konfigurasjon mangler");
  const db=createClient(base,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const hr=await fetch(`${BASE}icehockey/TournamentGoalieLeaders/${tournamentId}`,{headers:{Accept:"application/json","User-Agent":"StangInn/1.0 goalie-reconcile"},cache:"no-store"});
  if(!hr.ok)throw new Error(`HockeyLive svarte ${hr.status}`);
  const official=rows(await hr.json());
  const{data:players,error:pe}=await db.from("fantasy_players").select("id,name,team,position").eq("position","G");if(pe)throw pe;
  const{data:games,error:ge}=await db.from("fantasy_games").select("id,home_team,away_team,home_score,away_score,season,starts_at").eq("season",season);if(ge)throw ge;
  const gameMap=new Map((games||[]).map((g:any)=>[g.id,g]));
  const playerMap=new Map((players||[]).map((p:any)=>[p.id,p]));
  const playerIds=(players||[]).map((p:any)=>p.id);
  const{data:stats,error:se}=playerIds.length?await db.from("fantasy_player_game_stats").select("id,player_id,game_id,saves,goals_against,minutes_played,shutout,raw").in("player_id",playerIds):{data:[],error:null};if(se)throw se;
  const byPlayer=new Map<string,any[]>(),byGame=new Map<string,any[]>();
  for(const s of stats||[]){const a=byPlayer.get(s.player_id)||[];a.push(s);byPlayer.set(s.player_id,a);const b=byGame.get(s.game_id)||[];b.push(s);byGame.set(s.game_id,b)}
  const results:any[]=[];
  for(const p of players||[]){
   const off=official.find((r:Row)=>sameName(`${r.firstName??""} ${r.lastName??""}`,p.name));if(!off)continue;
   const target=num(off.so,0),ps=byPlayer.get(p.id)||[];
   const candidateGames:any[]=[];
   for(const s of ps){
    const g:any=gameMap.get(s.game_id);if(!g)continue;
    const pk=teamKey(p.team),hk=teamKey(g.home_team),ak=teamKey(g.away_team),home=pk===hk,away=pk===ak;
    if(!home&&!away)continue;
    const opp=home?num(g.away_score,-1):num(g.home_score,-1),own=home?num(g.home_score,-1):num(g.away_score,-1);
    const sameTeamGoalies=(byGame.get(s.game_id)||[]).filter((x:any)=>{const q:any=playerMap.get(x.player_id);return q&&teamKey(q.team)===pk});
    const otherActive=sameTeamGoalies.filter((x:any)=>x.player_id!==p.id&&(num(x.saves,0)>0||num(x.goals_against,0)>0||rawSeconds(x.raw)>0));
    const eligible=opp===0&&own>0&&num(s.goals_against,0)===0&&num(s.saves,0)>0&&otherActive.length===0;
    if(eligible)candidateGames.push({stat:s,game:g,otherActive});
   }
   const secondsUpdates=ps.filter((s:any)=>rawSeconds(s.raw)>0).map((s:any)=>({id:s.id,minutes:rawSeconds(s.raw)/60}));
   for(const u of secondsUpdates){const{error}=await db.from("fantasy_player_game_stats").update({minutes_played:u.minutes}).eq("id",u.id);if(error)throw error}
   let applied=false;
   if(candidateGames.length===target){
    const ids=ps.map((s:any)=>s.id);if(ids.length){const{error}=await db.from("fantasy_player_game_stats").update({shutout:false}).in("id",ids);if(error)throw error}
    const cids=candidateGames.map((x:any)=>x.stat.id);if(cids.length){const{error}=await db.from("fantasy_player_game_stats").update({shutout:true}).in("id",cids);if(error)throw error}
    applied=true;
   }
   const details=candidateGames.map((x:any)=>{const s=x.stat,g=x.game,pk=teamKey(p.team),home=pk===teamKey(g.home_team);return{gameId:s.game_id,date:g.starts_at??null,homeTeam:g.home_team??"",awayTeam:g.away_team??"",score:`${g.home_score??"–"}–${g.away_score??"–"}`,side:home?"H":"B",saves:num(s.saves,0),seconds:rawSeconds(s.raw),minutes:Math.round((rawSeconds(s.raw)/60)*10)/10,ga:num(s.goals_against,0),otherActive:x.otherActive.map((o:any)=>playerMap.get(o.player_id)?.name||o.player_id)}});
   results.push({name:p.name,team:p.team,targetSO:target,candidates:details.length,applied,secondsFixed:secondsUpdates.length,candidateGames:details});
  }
  return NextResponse.json({ok:true,season,tournamentId,results});
 }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Keeperavstemming feilet"},{status:500})}
}
