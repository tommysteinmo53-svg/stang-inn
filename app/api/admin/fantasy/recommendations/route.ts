import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {availabilityAdjustmentLabel,availabilityXfpFactor,normalizeFantasyAvailabilityStatus} from "../../../../../lib/fantasy/availability-policy";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function clientFor(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const header=request.headers.get("authorization");
  if(!url||!key||!header?.startsWith("Bearer "))return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:header}}});
}
const round2=(v:number)=>Math.round(v*100)/100;

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  const sb=clientFor(request);
  if(!sb)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});
  const[{data,error},{data:availability,error:availabilityError}]=await Promise.all([
    sb.rpc("get_fantasy_recommendation_data_admin_v1",{p_season:"2026/27"}),
    sb.from("fantasy_player_availability").select("player_id,status,note,expected_return"),
  ]);
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
  if(availabilityError)return NextResponse.json({ok:false,error:availabilityError.message},{status:500});
  const availabilityMap=new Map((availability||[]).map((r:any)=>[r.player_id,r]));

  // The command-center UI originally required >=5 current-season games before a player
  // could enter Spillerradar. xFP v2 now has a validated 2025/26 baseline, so medium/high
  // historical confidence is sufficient during preseason and games 1-4. Keep the actual
  // current-season game count separately for diagnostics while exposing an eligibility count
  // compatible with the existing UI. Low-confidence priors remain excluded.
  // Availability is an explicit, approved overlay: base model values are preserved for audit,
  // while adjusted values are what the recommendation ranking consumes.
  const rows=(data||[]).map((row:any)=>{
    const a:any=availabilityMap.get(row.player_id)||null;
    const status=normalizeFantasyAvailabilityStatus(a?.status);
    const factor=availabilityXfpFactor(status);
    const baseNext=Number(row.xfp_next_game||0);
    const baseNext3=Number(row.xfp_next3||0);
    const baseValue=Number(row.value_next3||0);
    return {
      ...row,
      actual_games_scored:Number(row.games_scored||0),
      games_scored:row.data_confidence!=="low"?Math.max(5,Number(row.games_scored||0)):Number(row.games_scored||0),
      base_xfp_next_game:baseNext,
      base_xfp_next3:baseNext3,
      base_value_next3:baseValue,
      xfp_next_game:round2(baseNext*factor),
      xfp_next3:round2(baseNext3*factor),
      value_next3:Math.round(baseValue*factor*1000)/1000,
      availability_status:status,
      availability_factor:factor,
      availability_note:a?.note||null,
      availability_expected_return:a?.expected_return||null,
      availability_adjustment:availabilityAdjustmentLabel(status),
    };
  });

  return NextResponse.json({ok:true,rows});
}
