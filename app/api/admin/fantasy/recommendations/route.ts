import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {availabilityAdjustmentLabel,availabilityXfpFactor,normalizeFantasyAvailabilityStatus} from "../../../../../lib/fantasy/availability-policy";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const VALUE_DEFINITION={version:"v1",unit:"xFP per million",nextGame:"availability-adjusted xFP next game / price",next3:"availability-adjusted xFP next 3 fixtures / price"};

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
const round2=(v:number)=>Math.round(v*100)/100;
const round3=(v:number)=>Math.round(v*1000)/1000;
const valuePerMillion=(xfp:number,price:number)=>price>0?round3(xfp/price):0;

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  const sb=userClient(request);
  const service=serviceClient();
  if(!sb)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});
  if(!service)return NextResponse.json({ok:false,error:"Supabase server-konfigurasjon mangler."},{status:503});
  const[{data,error},{data:availability,error:availabilityError}]=await Promise.all([
    sb.rpc("get_fantasy_recommendation_data_admin_v1",{p_season:"2026/27"}),
    service.from("fantasy_player_availability").select("player_id,status,note,expected_return"),
  ]);
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
  if(availabilityError)return NextResponse.json({ok:false,error:availabilityError.message},{status:500});
  const availabilityMap=new Map((availability||[]).map((r:any)=>[r.player_id,r]));

  // Historical confidence may make a player recommendation-eligible before five current-season
  // games. actual_games_scored remains the observed fact; games_scored is only radar eligibility.
  // Value v1 is derived here from the same availability-adjusted xFP used by the rankings so the
  // recommendation API cannot drift from the authoritative xFP value-per-million definition.
  const rows=(data||[]).map((row:any)=>{
    const a:any=availabilityMap.get(row.player_id)||null;
    const status=normalizeFantasyAvailabilityStatus(a?.status);
    const factor=availabilityXfpFactor(status);
    const price=Number(row.price||0);
    const baseNext=Number(row.xfp_next_game||0);
    const baseNext3=Number(row.xfp_next3||0);
    const adjustedNext=round2(baseNext*factor);
    const adjustedNext3=round2(baseNext3*factor);
    const actualGames=Number(row.games_scored||0);
    const baselineEligible=row.data_confidence!=="low"?Math.max(5,actualGames):actualGames;
    return {
      ...row,
      price,
      actual_games_scored:actualGames,
      games_scored:factor===0?0:baselineEligible,
      base_xfp_next_game:baseNext,
      base_xfp_next3:baseNext3,
      base_value_next_game:valuePerMillion(baseNext,price),
      base_value_next3:valuePerMillion(baseNext3,price),
      xfp_next_game:adjustedNext,
      xfp_next3:adjustedNext3,
      value_next_game:valuePerMillion(adjustedNext,price),
      value_next3:valuePerMillion(adjustedNext3,price),
      value_metric_version:VALUE_DEFINITION.version,
      value_unit:VALUE_DEFINITION.unit,
      availability_status:status,
      availability_factor:factor,
      availability_note:a?.note||null,
      availability_expected_return:a?.expected_return||null,
      availability_adjustment:availabilityAdjustmentLabel(status),
    };
  });

  return NextResponse.json({ok:true,valueDefinition:VALUE_DEFINITION,rows});
}
