import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://sf34-terminlister-prod-app.azurewebsites.net/icehockey";
type Row = Record<string, any>;
const n=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
const first=(...v:any[])=>v.find(x=>x!==undefined&&x!==null&&x!=="");
const nk=(v:any)=>String(v??"").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const toks=(v:any)=>nk(v).split(/\s+/).filter(Boolean);
function sameName(a:any,b:any){if(nk(a)===nk(b))return true;const x=toks(a),y=toks(b);return x.length>=2&&y.length>=2&&x[0]===y[0]&&x.at(-1)===y.at(-1)}
function rows(p:any):Row[]{if(Array.isArray(p))return p;if(Array.isArray(p?.data))return p.data;if(Array.isArray(p?.players))return p.players;if(Array.isArray(p?.data?.players))return p.data.players;return []}
function fullName(r:Row){return String(first(r.playerName,r.PlayerName,r.name,r.Name,r.fullName,r.personName,[r.firstName,r.lastName].filter(Boolean).join(" "),[r.FirstName,r.LastName].filter(Boolean).join(" "))??"").trim()}
function hasAnyKey(r:Row,names:string[]){const keys=new Set(Object.keys(r).map(k=>k.toLowerCase()));return names.some(k=>keys.has(k.toLowerCase()))}
function officialStat(r:Row){
 const plusMinusAvailable=hasAnyKey(r,["plusMinus","PlusMinus","plusminus"]);
 return{
  games:n(first(r.gamesPlayed,r.GamesPlayed,r.games,r.Games,r.gp,r.GP)),
  goals:n(first(r.goalsScored,r.GoalsScored,r.goals,r.Goals,r.g,r.G)),
  assists:n(first(r.assists,r.Assists,r.a,r.A)),
  shots:n(first(r.shots,r.Shots,r.shotsOnGoal,r.ShotsOnGoal,r.sog,r.SOG)),
  plusMinus:plusMinusAvailable?n(first(r.plusMinus,r.PlusMinus,r.plusminus)):null,
  plusMinusAvailable,
  pim:n(first(r.pim,r.PIM,r.penaltyMinutes,r.PenaltyMinutes)),
  team:String(first(r.teamName,r.TeamName,r.team,r.Team,r.clubName,r.orgName)??""),
 }}
async function requireAdmin(request:NextRequest){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)return{ok:false as const,response:NextResponse.json({ok:false,error:"Supabase public-konfigurasjon mangler."},{status:503})};const h=request.headers.get("authorization"),token=h?.startsWith("Bearer ")?h.slice(7):null;if(!token)return{ok:false as const,response:NextResponse.json({ok:false,error:"Mangler innlogging."},{status:401})};const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});const{data:u,error:e}=await auth.auth.getUser(token);if(e||!u.user)return{ok:false as const,response:NextResponse.json({ok:false,error:"Ugyldig innlogging."},{status:401})};const{data:p}=await auth.from("players").select("admin").eq("id",u.user.id).maybeSingle();if(!p?.admin)return{ok:false as const,response:NextResponse.json({ok:false,error:"Kun admin."},{status:403})};return{ok:true as const}}

export async function GET(request:NextRequest){const admin=await requireAdmin(request);if(!admin.ok)return admin.response;const url=new URL(request.url),season=url.searchParams.get("season")||"2025/26",tournamentId=(url.searchParams.get("tournamentId")||"435587").replace(/\D/g,"");try{const sbUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY;if(!sbUrl||!secret)throw new Error("Supabase server-konfigurasjon mangler");const db=createClient(sbUrl,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const hr=await fetch(`${BASE}/TournamentPlayers/${tournamentId}`,{headers:{Accept:"application/json","User-Agent":"StangInn/1.0 skater-season-check"},cache:"no-store"});if(!hr.ok)throw new Error(`HockeyLive TournamentPlayers svarte ${hr.status}`);const payload=await hr.json(),officialRows=rows(payload);
 const{data:games,error:ge}=await db.from("fantasy_games").select("id").eq("season",season).eq("status","finished");if(ge)throw ge;const gameIds=new Set((games||[]).map((g:any)=>g.id));
 // Supabase caps a normal select at 1000 rows. Read the complete stats table page by page,
 // then keep rows belonging to this season. Without this, the diagnostic looked like every
 // skater had only a handful of games even though all 225 matches were imported.
 const stats:any[]=[];for(let from=0;;from+=1000){const{data,error}=await db.from("fantasy_player_game_stats").select("player_id,game_id,goals,assists,shots,plus_minus,pim,did_play,position_snapshot").range(from,from+999);if(error)throw error;const batch=data||[];for(const s of batch)if(gameIds.has(s.game_id))stats.push(s);if(batch.length<1000)break}
 const ids=[...new Set(stats.map(s=>s.player_id))],players:any[]=[];for(let i=0;i<ids.length;i+=500){const{data,error}=await db.from("fantasy_players").select("id,name,team,position").in("id",ids.slice(i,i+500));if(error)throw error;players.push(...(data||[]))}
 const byId=new Map(players.map(p=>[p.id,p])),agg=new Map<string,any>();for(const s of stats){const p:any=byId.get(s.player_id);if(!p)continue;const pos=String(s.position_snapshot||p.position||"").toUpperCase();if(pos==="G"||!s.did_play)continue;const a=agg.get(p.id)||{id:p.id,name:p.name,team:p.team,position:p.position,games:0,goals:0,assists:0,shots:0,plusMinus:0,pim:0};a.games++;a.goals+=n(s.goals);a.assists+=n(s.assists);a.shots+=n(s.shots);a.plusMinus+=n(s.plus_minus);a.pim+=n(s.pim);agg.set(p.id,a)}
 const result=[...agg.values()].map((local:any)=>{const raw=officialRows.find((r:Row)=>sameName(fullName(r),local.name));const official=raw?officialStat(raw):null;const diffs=official?{games:local.games-official.games,goals:local.goals-official.goals,assists:local.assists-official.assists,shots:local.shots-official.shots,plusMinus:official.plusMinusAvailable?local.plusMinus-n(official.plusMinus):null,pim:local.pim-official.pim}:null;const clean=diffs?[diffs.goals,diffs.assists,diffs.shots,diffs.pim,...(official?.plusMinusAvailable?[diffs.plusMinus]:[])].every(v=>v===0):false;return{local,official,diffs,matched:Boolean(raw),rawKeys:raw?Object.keys(raw).sort():[],clean}}).sort((a:any,b:any)=>Number(b.matched)-Number(a.matched)||a.local.name.localeCompare(b.local.name,"nb"));
 return NextResponse.json({ok:true,season,tournamentId,finishedGames:gameIds.size,statRows:stats.length,officialCount:officialRows.length,matched:result.filter((r:any)=>r.matched).length,clean:result.filter((r:any)=>r.clean).length,result,sampleOfficial:officialRows.slice(0,2)});
 }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Utespilleravstemming feilet"},{status:500})}}
