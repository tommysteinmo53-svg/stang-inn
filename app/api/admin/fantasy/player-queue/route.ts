import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function serverClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error("Supabase server-variabler mangler");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
  try{
    const sb=serverClient();
    const{data,error}=await sb
      .from("fantasy_player_admin_queue")
      .select("id,season,status,detected_at,updated_at,position_source,suggested_price,suggestion_model,price_confidence,pricing_basis,needs_manual_price,approved_price,approved_at,admin_note,player_id,fantasy_players!inner(name,team,position,on_current_roster,available_for_purchase,external_id)")
      .eq("season","2026/27")
      .order("status",{ascending:true})
      .order("detected_at",{ascending:false});
    if(error)throw error;
    return NextResponse.json({ok:true,rows:data||[]});
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Kunne ikke laste spillerkø"},{status:500})}
}

function validPrice(v:number){return Number.isFinite(v)&&v>=1&&v<=20&&Math.abs(v*2-Math.round(v*2))<1e-9}

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
