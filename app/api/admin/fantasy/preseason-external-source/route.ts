import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function serverClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw new Error("Supabase server-variabler mangler");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function validUrl(value:string){try{const u=new URL(value);return u.protocol==="https:"||u.protocol==="http:"}catch{return false}}

export async function POST(request:NextRequest){
 const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
 try{
  const body=await request.json();const gameId=Number(body.gameId);const sourceUrl=String(body.sourceUrl||"").trim();const sourceLabel=String(body.sourceLabel||"").trim();const rawData=String(body.rawData||"").trim();
  if(!Number.isFinite(gameId)||gameId<=0)return NextResponse.json({ok:false,error:"Velg en treningskamp"},{status:400});
  if(!validUrl(sourceUrl))return NextResponse.json({ok:false,error:"Legg inn en gyldig http/https-kilde-URL"},{status:400});
  const sb=serverClient();const{data:game,error:readError}=await sb.from("fantasy_preseason_games").select("id,season,home_team,away_team,notes,source_quality").eq("id",gameId).eq("season","2026/27").maybeSingle();if(readError)throw readError;if(!game)return NextResponse.json({ok:false,error:"Fant ikke valgt preseason-kamp"},{status:404});
  const entry={type:"admin_external_source",url:sourceUrl,label:sourceLabel||new URL(sourceUrl).hostname,rawData:rawData||null,addedAt:new Date().toISOString()};
  const notes=[game.notes,`ADMIN_EXTERNAL_SOURCE ${JSON.stringify(entry)}`].filter(Boolean).join("\n");
  const{error:updateError}=await sb.from("fantasy_preseason_games").update({source_url:sourceUrl,source_type:"web",source_quality:Math.max(Number(game.source_quality||0),rawData?0.8:0.65),notes,updated_at:new Date().toISOString()}).eq("id",gameId);if(updateError)throw updateError;
  return NextResponse.json({ok:true,gameId,game:`${game.home_team} – ${game.away_team}`,sourceUrl,label:entry.label,hasRawData:!!rawData});
 }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Kunne ikke lagre ekstern kilde"},{status:500})}
}
