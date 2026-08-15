import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function serverClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw new Error("Supabase server-variabler mangler");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function validUrl(value:string){try{const u=new URL(value);return u.protocol==="https:"||u.protocol==="http:"}catch{return false}}
function hockeyLiveMatchId(value:string){try{const u=new URL(value);if(!/(^|\.)hockey\.no$/i.test(u.hostname))return null;const direct=u.searchParams.get("matchId");if(direct&&/^\d+$/.test(direct))return Number(direct);const decoded=decodeURIComponent(value);const m=decoded.match(/[?&]matchId=(\d+)/i);return m?Number(m[1]):null}catch{return null}}

export async function POST(request:NextRequest){
 const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
 try{
  const body=await request.json();const gameId=Number(body.gameId);const sourceUrl=String(body.sourceUrl||"").trim();const sourceLabel=String(body.sourceLabel||"").trim();const rawData=String(body.rawData||"").trim();
  if(!Number.isFinite(gameId)||gameId<=0)return NextResponse.json({ok:false,error:"Velg en treningskamp"},{status:400});
  if(!validUrl(sourceUrl))return NextResponse.json({ok:false,error:"Legg inn en gyldig http/https-kilde-URL"},{status:400});
  const sb=serverClient();const{data:game,error:readError}=await sb.from("fantasy_preseason_games").select("id,season,home_team,away_team,notes,source_quality").eq("id",gameId).eq("season","2026/27").maybeSingle();if(readError)throw readError;if(!game)return NextResponse.json({ok:false,error:"Fant ikke valgt preseason-kamp"},{status:404});
  const matchId=hockeyLiveMatchId(sourceUrl);const entry={type:matchId?"admin_hockeylive_source":"admin_external_source",url:sourceUrl,label:sourceLabel||new URL(sourceUrl).hostname,rawData:rawData||null,matchId,addedAt:new Date().toISOString()};
  const notes=[game.notes,`${matchId?"ADMIN_HOCKEYLIVE_SOURCE":"ADMIN_EXTERNAL_SOURCE"} ${JSON.stringify(entry)}`].filter(Boolean).join("\n");
  const patch:any={source_url:sourceUrl,source_type:matchId?"hockeylive":"web",source_quality:matchId?0.95:Math.max(Number(game.source_quality||0),rawData?0.8:0.65),notes,updated_at:new Date().toISOString()};if(matchId)patch.hockeylive_match_id=matchId;
  const{error:updateError}=await sb.from("fantasy_preseason_games").update(patch).eq("id",gameId);if(updateError)throw updateError;
  return NextResponse.json({ok:true,gameId,game:`${game.home_team} – ${game.away_team}`,sourceUrl,label:entry.label,hasRawData:!!rawData,hockeyliveMatchId:matchId||null});
 }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Kunne ikke lagre ekstern kilde"},{status:500})}
}
