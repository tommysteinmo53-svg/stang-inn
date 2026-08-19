import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {scanHockeyLiveMatchSquads,type AvailabilityGame} from "../../../../../lib/fantasy/hockeylive-availability-scan";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const EHL_2026_27_TOURNAMENT_ID=448981;
function sb(){const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.SUPABASE_SECRET_KEY;if(!u||!k)throw new Error("Supabase server-variabler mangler");return createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}})}
function numericMatchId(v:unknown){const m=String(v??"").trim().match(/(?:^|:)(\d+)$/);if(!m)return null;const n=Number(m[1]);return Number.isInteger(n)&&n>0?n:null}
function tournamentIdFromUrl(v:unknown){const text=String(v??"");const m=text.match(/[?&]tournamentId=(\d+)/i);if(!m)return null;const n=Number(m[1]);return Number.isInteger(n)&&n>0?n:null}

export async function POST(request:NextRequest){const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;try{const c=sb(),now=Date.now(),today=new Date(now).toISOString().slice(0,10),cutoffDate=new Date(now-3*86400000).toISOString().slice(0,10),fromIso=new Date(now-3*86400000).toISOString(),toIso=new Date(now+86400000).toISOString();
 const[{data:preseason,error:preErr},{data:regular,error:regErr},{data:players,error:pErr}]=await Promise.all([
  c.from("fantasy_preseason_games").select("id,game_date,home_team,away_team,hockeylive_match_id,source_url").eq("season","2026/27").gte("game_date",cutoffDate).lte("game_date",today).not("hockeylive_match_id","is",null).order("game_date",{ascending:false}),
  c.from("fantasy_games").select("id,external_id,starts_at,home_team,away_team").eq("season","2026/27").gte("starts_at",fromIso).lte("starts_at",toIso).order("starts_at",{ascending:false}),
  c.from("fantasy_players").select("id,external_id,name,team").eq("active",true).eq("on_current_roster",true)
 ]);if(preErr)throw preErr;if(regErr)throw regErr;if(pErr)throw pErr;
 const games:AvailabilityGame[]=[
  ...(preseason||[]).map((g:any)=>({id:`pre:${g.id}`,game_date:g.game_date,home_team:g.home_team,away_team:g.away_team,match_id:Number(g.hockeylive_match_id)||null,tournament_id:tournamentIdFromUrl(g.source_url),source_url:g.source_url||null,game_type:"preseason" as const})),
  ...(regular||[]).map((g:any)=>({id:`reg:${g.id}`,game_date:String(g.starts_at).slice(0,10),home_team:g.home_team,away_team:g.away_team,match_id:numericMatchId(g.external_id),tournament_id:EHL_2026_27_TOURNAMENT_ID,source_url:null,game_type:"regular" as const}))
 ];
 const scan=await scanHockeyLiveMatchSquads(games,(players||[]) as any[]),urls=[...new Set(scan.findings.map(f=>f.sourceUrl))],existingKeys=new Set<string>();
 if(urls.length){const{data:existing,error:eErr}=await c.from("fantasy_availability_findings").select("source_url,raw_player_name,raw_status").in("source_url",urls);if(eErr)throw eErr;for(const r of existing||[])existingKeys.add(`${r.source_url}|${r.raw_player_name}|${r.raw_status}`)}
 const fresh=scan.findings.filter(f=>!existingKeys.has(`${f.sourceUrl}|${f.rawPlayerName}|${f.rawStatus}`));let inserted=0;if(fresh.length){const rows=fresh.map(f=>({source_kind:f.sourceKind,source_label:f.sourceLabel,source_url:f.sourceUrl,source_published_at:f.sourcePublishedAt,raw_player_name:f.rawPlayerName,raw_team:f.rawTeam,raw_status:f.rawStatus,raw_note:f.rawNote,proposed_player_id:f.proposedPlayerId,match_method:f.matchMethod,match_confidence:f.matchConfidence,match_reason:f.matchReason,review_status:f.reviewStatus,created_by:admin.userId}));const{error:iErr}=await c.from("fantasy_availability_findings").insert(rows);if(iErr)throw iErr;inserted=rows.length}
 return NextResponse.json({ok:true,gamesChecked:games.length,preseasonGames:(preseason||[]).length,regularGames:(regular||[]).length,candidates:scan.findings.length,inserted,duplicates:scan.findings.length-inserted,diagnostics:scan.diagnostics});
 }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Kunne ikke skanne HockeyLive-kamptropper"},{status:500})}}
