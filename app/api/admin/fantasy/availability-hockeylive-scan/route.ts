import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {scanHockeyLiveMatchSquads} from "../../../../../lib/fantasy/hockeylive-availability-scan";

export const runtime="nodejs";
export const dynamic="force-dynamic";
function sb(){const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.SUPABASE_SECRET_KEY;if(!u||!k)throw new Error("Supabase server-variabler mangler");return createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}})}

export async function POST(request:NextRequest){const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;try{const c=sb(),today=new Date().toISOString().slice(0,10),cutoff=new Date(Date.now()-3*86400000).toISOString().slice(0,10);
 const[{data:games,error:gErr},{data:players,error:pErr}]=await Promise.all([
  c.from("fantasy_preseason_games").select("id,game_date,home_team,away_team,hockeylive_match_id,source_url").eq("season","2026/27").gte("game_date",cutoff).lte("game_date",today).not("hockeylive_match_id","is",null).order("game_date",{ascending:false}),
  c.from("fantasy_players").select("id,external_id,name,team").eq("active",true).eq("on_current_roster",true)
 ]);if(gErr)throw gErr;if(pErr)throw pErr;
 const scan=await scanHockeyLiveMatchSquads((games||[]) as any[],(players||[]) as any[]),urls=[...new Set(scan.findings.map(f=>f.sourceUrl))],existingKeys=new Set<string>();
 if(urls.length){const{data:existing,error:eErr}=await c.from("fantasy_availability_findings").select("source_url,raw_player_name,raw_status").in("source_url",urls);if(eErr)throw eErr;for(const r of existing||[])existingKeys.add(`${r.source_url}|${r.raw_player_name}|${r.raw_status}`)}
 const fresh=scan.findings.filter(f=>!existingKeys.has(`${f.sourceUrl}|${f.rawPlayerName}|${f.rawStatus}`));let inserted=0;if(fresh.length){const rows=fresh.map(f=>({source_kind:f.sourceKind,source_label:f.sourceLabel,source_url:f.sourceUrl,source_published_at:f.sourcePublishedAt,raw_player_name:f.rawPlayerName,raw_team:f.rawTeam,raw_status:f.rawStatus,raw_note:f.rawNote,proposed_player_id:f.proposedPlayerId,match_method:f.matchMethod,match_confidence:f.matchConfidence,match_reason:f.matchReason,review_status:f.reviewStatus,created_by:admin.userId}));const{error:iErr}=await c.from("fantasy_availability_findings").insert(rows);if(iErr)throw iErr;inserted=rows.length}
 return NextResponse.json({ok:true,gamesChecked:(games||[]).length,candidates:scan.findings.length,inserted,duplicates:scan.findings.length-inserted,diagnostics:scan.diagnostics});
 }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Kunne ikke skanne HockeyLive-kamptropper"},{status:500})}}
