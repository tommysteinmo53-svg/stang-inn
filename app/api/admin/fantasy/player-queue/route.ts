import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {IMPORT_HISTORY_2026} from "../../../../../lib/fantasy/import-history-2026";
import {importEstimateV46} from "../../../../../lib/fantasy/import-pricing-v4-6";
import type {V43Position} from "../../../../../lib/fantasy/import-pricing-v4-3";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function serverClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error("Supabase server-variabler mangler");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

function validPrice(v:number){return Number.isFinite(v)&&v>=1&&v<=20&&Math.abs(v*2-Math.round(v*2))<1e-9}
function roundedHalf(v:number){return Math.round(v*2)/2}
function validPosition(v:any):v is V43Position{return ["C","W","D","G"].includes(String(v))}

async function autoSuggest(sb:any,row:any){
  if(row.status!=="pending"||row.suggested_price!=null)return;
  const p=row.fantasy_players||{};
  const history=IMPORT_HISTORY_2026[p.name];
  let price:number|null=null,confidence="manuell",needsManual=true;
  let basis:any={source:"V4.6 auto",player:p.name||null};

  if(history&&validPosition(p.position)){
    const estimate=importEstimateV46(history,p.position,p.team,p.name);
    if(estimate){
      price=roundedHalf(estimate.raw);
      confidence=estimate.confidence;
      needsManual=estimate.confidence==="Lav"||estimate.weight<0.35;
      basis={
        source:"V4.6 auto",
        historySource:history.source,
        historyLeague:history.league,
        historyGames:history.games,
        previousTeam:history.previousTeam,
        metric:estimate.metric,
        raw:estimate.raw,
        rounded:price,
        prior:estimate.prior,
        sampleWeight:estimate.weight,
        translation:estimate.translation,
        empiricalDelta:estimate.empiricalDelta,
        empiricalBasis:estimate.empiricalBasis,
        note:estimate.note,
      };
    }else basis={...basis,reason:"V4.6 kunne ikke beregne gyldig estimat fra tilgjengelig historikk"};
  }else{
    basis={...basis,reason:history?"Ugyldig/manglende fantasy-posisjon":"Ingen dokumentert 2025/26-importhistorikk i prismodellen"};
  }

  const{error}=await sb.rpc("set_fantasy_player_price_suggestion_v1",{
    p_queue_id:row.id,
    p_suggested_price:price,
    p_model:"V4.6_AUTO",
    p_confidence:confidence,
    p_basis:basis,
    p_needs_manual:needsManual,
  });
  if(error)throw error;
}

async function loadRows(sb:any){
  const{data,error}=await sb
    .from("fantasy_player_admin_queue")
    .select("id,season,status,detected_at,updated_at,position_source,suggested_price,suggestion_model,price_confidence,pricing_basis,needs_manual_price,approved_price,approved_at,admin_note,player_id,fantasy_players!inner(name,team,position,on_current_roster,available_for_purchase,external_id)")
    .eq("season","2026/27")
    .order("status",{ascending:true})
    .order("detected_at",{ascending:false});
  if(error)throw error;
  return data||[];
}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
  try{
    const sb=serverClient();
    let rows=await loadRows(sb);
    const missing=rows.filter((r:any)=>r.status==="pending"&&r.suggested_price==null&&r.suggestion_model==null);
    for(const row of missing)await autoSuggest(sb,row);
    if(missing.length)rows=await loadRows(sb);
    return NextResponse.json({ok:true,rows,autoSuggested:missing.length});
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Kunne ikke laste spillerkø"},{status:500})}
}

export async function POST(request:NextRequest){
  const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
  try{
    const body=await request.json();
    const action=String(body?.action||"");
    const queueId=String(body?.queueId||"");
    if(!queueId)return NextResponse.json({ok:false,error:"Mangler queueId"},{status:400});
    const sb=serverClient();

    if(action==="approve"){
      const price=Number(body?.price);
      if(!validPrice(price))return NextResponse.json({ok:false,error:"Pris må være 1.0–20.0 i steg på 0.5m"},{status:400});
      const{data,error}=await sb.rpc("approve_fantasy_player_price_v1",{p_queue_id:queueId,p_admin:admin.userId,p_price:price,p_note:body?.note?String(body.note):null});
      if(error)throw error;
      return NextResponse.json({ok:true,result:data});
    }

    if(action==="reject"){
      const{data,error}=await sb.rpc("reject_fantasy_player_queue_v1",{p_queue_id:queueId,p_admin:admin.userId,p_note:body?.note?String(body.note):null});
      if(error)throw error;
      return NextResponse.json({ok:true,result:data});
    }

    if(action==="auto-suggest"){
      const rows=await loadRows(sb);const row=rows.find((r:any)=>r.id===queueId);
      if(!row)return NextResponse.json({ok:false,error:"Spilleren finnes ikke i køen"},{status:404});
      await sb.from("fantasy_player_admin_queue").update({suggested_price:null,suggestion_model:null,price_confidence:null,pricing_basis:null,needs_manual_price:true,updated_at:new Date().toISOString()}).eq("id",queueId).eq("status","pending");
      const refreshed=(await loadRows(sb)).find((r:any)=>r.id===queueId);if(refreshed)await autoSuggest(sb,refreshed);
      return NextResponse.json({ok:true});
    }

    if(action==="suggest"){
      const price=body?.price==null||body?.price===""?null:Number(body.price);
      if(price!==null&&!validPrice(price))return NextResponse.json({ok:false,error:"Prisforslag må være 1.0–20.0 i steg på 0.5m"},{status:400});
      const{data,error}=await sb.rpc("set_fantasy_player_price_suggestion_v1",{
        p_queue_id:queueId,
        p_suggested_price:price,
        p_model:String(body?.model||"MIDSEASON_ADMIN_V1"),
        p_confidence:String(body?.confidence||"manual"),
        p_basis:body?.basis&&typeof body.basis==="object"?body.basis:{source:"admin"},
        p_needs_manual:Boolean(body?.needsManual??true),
      });
      if(error)throw error;
      return NextResponse.json({ok:true,result:data});
    }

    return NextResponse.json({ok:false,error:"Ukjent handling"},{status:400});
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Spillerkø-operasjon feilet"},{status:500})}
}
