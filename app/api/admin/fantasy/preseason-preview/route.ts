import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function clientFor(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const header=request.headers.get("authorization");
  if(!url||!key||!header?.startsWith("Bearer "))return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:header}}});
}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  const sb=clientFor(request);
  if(!sb)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});

  const [baseRes,preRes]=await Promise.all([
    sb.rpc("get_fantasy_xfp_admin_v1",{p_season:"2026/27"}),
    sb.rpc("get_fantasy_preseason_signal_admin_v1",{p_season:"2026/27"}),
  ]);

  if(baseRes.error)return NextResponse.json({ok:false,error:baseRes.error.message,source:"baseline"},{status:500});
  if(preRes.error)return NextResponse.json({ok:false,error:preRes.error.message,source:"preseason"},{status:500});

  const baseMap=new Map((baseRes.data||[]).map((r:any)=>[r.player_id,r]));
  const rows=(preRes.data||[]).map((p:any)=>{
    const b:any=baseMap.get(p.player_id)||{};
    const baseline=Number(b.xfp_next_game||0);
    const preseason=Number(p.preseason_ppg||0);
    const weight=Number(p.preseason_weight||0);
    const adjustment=(preseason-baseline)*weight;
    return {
      player_id:p.player_id,
      player_name:p.player_name,
      team:p.team,
      player_position:p.player_position,
      baseline_xfp:Number(baseline.toFixed(2)),
      preseason_ppg:Number(preseason.toFixed(2)),
      preseason_games:Number(p.preseason_games||0),
      preseason_weight:weight,
      preseason_adjustment:Number(adjustment.toFixed(2)),
      preview_xfp:Number((baseline+adjustment).toFixed(2)),
      avg_opponent_factor:Number(p.avg_opponent_factor||0),
      avg_data_weight:Number(p.avg_data_weight||0),
      regular_games:Number(p.regular_games||0),
      data_confidence:p.data_confidence||"low",
    };
  }).sort((a:any,b:any)=>b.preview_xfp-a.preview_xfp||String(a.player_name).localeCompare(String(b.player_name),"nb"));

  return NextResponse.json({ok:true,rows});
}
