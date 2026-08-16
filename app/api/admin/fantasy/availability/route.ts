import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function sb(){const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.SUPABASE_SECRET_KEY;if(!u||!k)throw new Error("Supabase server-variabler mangler");return createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}})}
const statuses=new Set(["available","questionable","out","long_term","returning","not_in_lineup"]);

export async function GET(request:NextRequest){
 const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
 try{const c=sb();const[{data:players,error:pErr},{data:availability,error:aErr}]=await Promise.all([
  c.from("fantasy_players").select("id,name,team,position,active,on_current_roster").eq("active",true).eq("on_current_roster",true).order("team").order("name"),
  c.from("fantasy_player_availability").select("player_id,status,note,expected_return,source_url,source_label,source_published_at,updated_at")
 ]);if(pErr)throw pErr;if(aErr)throw aErr;const map=new Map((availability||[]).map((r:any)=>[r.player_id,r]));return NextResponse.json({ok:true,rows:(players||[]).map((p:any)=>({...p,availability:map.get(p.id)||{status:"available"}}))});}
 catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Kunne ikke hente tilgjengelighet"},{status:500})}
}

export async function POST(request:NextRequest){
 const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
 try{const body=await request.json();const playerId=String(body.playerId||"");const status=String(body.status||"");if(!playerId||!statuses.has(status))return NextResponse.json({ok:false,error:"Ugyldig spiller eller status"},{status:400});
 const row={player_id:playerId,status,note:String(body.note||"").trim()||null,expected_return:body.expectedReturn||null,source_url:String(body.sourceUrl||"").trim()||null,source_label:String(body.sourceLabel||"").trim()||null,source_published_at:body.sourcePublishedAt||null,updated_at:new Date().toISOString(),updated_by:admin.userId};const c=sb();const{error:uErr}=await c.from("fantasy_player_availability").upsert(row,{onConflict:"player_id"});if(uErr)throw uErr;const{error:hErr}=await c.from("fantasy_player_availability_history").insert({...row,updated_at:undefined,updated_by:undefined,created_by:admin.userId});if(hErr)throw hErr;return NextResponse.json({ok:true});}
 catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Kunne ikke lagre tilgjengelighet"},{status:500})}
}
