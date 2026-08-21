import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {availabilityAdjustmentLabel,availabilityXfpFactor,normalizeFantasyAvailabilityStatus} from "../../../../../lib/fantasy/availability-policy";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function userClient(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const header=request.headers.get("authorization");
  if(!url||!key||!header?.startsWith("Bearer "))return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:header}}});
}
function serviceClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
const r2=(v:number)=>Math.round(v*100)/100;
const r3=(v:number)=>Math.round(v*1000)/1000;

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  const sb=userClient(request),service=serviceClient();
  if(!sb||!service)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});

  const[{data,error},{data:availability,error:availabilityError}]=await Promise.all([
    sb.rpc("get_fantasy_xfp_round_horizons_admin_v2",{p_season:"2026/27"}),
    service.from("fantasy_player_availability").select("player_id,status,note,expected_return"),
  ]);
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
  if(availabilityError)return NextResponse.json({ok:false,error:availabilityError.message},{status:500});

  const availabilityMap=new Map((availability||[]).map((a:any)=>[a.player_id,a]));
  const rows=(data||[]).map((row:any)=>{
    const a:any=availabilityMap.get(row.player_id)||null;
    const status=normalizeFantasyAvailabilityStatus(a?.status);
    const factor=availabilityXfpFactor(status);
    const price=Number(row.price||0);
    const baseGame=Number(row.base_xfp_next_game||0);
    const baseRound=Number(row.base_xfp_next_round||0);
    const base3=Number(row.base_xfp_next3_rounds||0);
    const adjustedGame=r2(baseGame*factor);
    const adjustedRound=r2(baseRound*factor);
    const adjusted3=r2(base3*factor);
    return{
      ...row,
      price,
      availability_status:status,
      availability_factor:factor,
      availability_adjustment:availabilityAdjustmentLabel(status),
      availability_note:a?.note||null,
      availability_expected_return:a?.expected_return||null,
      adjusted_xfp_next_game:adjustedGame,
      adjusted_xfp_next_round:adjustedRound,
      adjusted_xfp_next3_rounds:adjusted3,
      value_next3_rounds:price>0?r3(adjusted3/price):0,
    };
  });

  return NextResponse.json({
    ok:true,
    definition:{
      base:"Spillerens modell-xFP før availability og før lagoppstillingsmultiplikatorer.",
      adjusted:"Base-xFP multiplisert med autoritativ availability-faktor.",
      effective:"Rekke 1/2 og C/VC brukes først i konkret lag/optimizer og er ikke del av denne generiske spillerrangeringen.",
      value:"Availability-justert xFP for de neste tre fantasy-rundene per million i spillerpris.",
    },
    rows,
  });
}
