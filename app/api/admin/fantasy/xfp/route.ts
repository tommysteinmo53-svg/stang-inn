import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {availabilityAdjustmentLabel,availabilityXfpFactor,normalizeFantasyAvailabilityStatus} from "../../../../../lib/fantasy/availability-policy";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const VALUE_DEFINITION={version:"v1",unit:"xFP per million",nextGame:"availability-adjusted xFP next game / price",next3:"availability-adjusted xFP next 3 fixtures / price"};

function clientFor(request:NextRequest){
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

function round2(value:number){return Math.round(value*100)/100}
function round3(value:number){return Math.round(value*1000)/1000}
function valuePerMillion(xfp:number,price:number){return price>0?round3(xfp/price):0}
function adjustRows(rows:any[],availability:any[]){
  const map=new Map((availability||[]).map((r:any)=>[r.player_id,r]));
  return (rows||[]).map((row:any)=>{
    const a:any=map.get(row.player_id)||null;
    const status=normalizeFantasyAvailabilityStatus(a?.status);
    const factor=availabilityXfpFactor(status);
    const price=Number(row.price||0);
    const baseNext=Number(row.xfp_next_game||0);
    const baseNext3=Number(row.xfp_next3||0);
    const adjustedNext=round2(baseNext*factor);
    const adjustedNext3=round2(baseNext3*factor);
    return {
      ...row,
      price,
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
}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  const sb=clientFor(request);
  const service=serviceClient();
  if(!sb)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});
  if(!service)return NextResponse.json({ok:false,error:"Supabase server-konfigurasjon mangler."},{status:503});

  const playerId=request.nextUrl.searchParams.get("playerId");
  if(playerId){
    const[{data,error},{data:availability,error:availabilityError}]=await Promise.all([
      sb.rpc("get_fantasy_xfp_player_fixtures_admin_v1",{p_player_id:playerId,p_season:"2026/27"}),
      service.from("fantasy_player_availability").select("player_id,status,note,expected_return").eq("player_id",playerId).maybeSingle(),
    ]);
    if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
    if(availabilityError)return NextResponse.json({ok:false,error:availabilityError.message},{status:500});
    const status=normalizeFantasyAvailabilityStatus((availability as any)?.status);
    const factor=availabilityXfpFactor(status);
    const fixtures=(data||[]).map((row:any)=>({
      ...row,
      base_fixture_xfp:Number(row.fixture_xfp||0),
      fixture_xfp:round2(Number(row.fixture_xfp||0)*factor),
      availability_status:status,
      availability_factor:factor,
      availability_adjustment:availabilityAdjustmentLabel(status),
    }));
    return NextResponse.json({ok:true,fixtures});
  }

  const[{data:settings,error:settingsError},{data:rows,error:rowsError},{data:availability,error:availabilityError}]=await Promise.all([
    sb.rpc("get_fantasy_xfp_settings_admin_v1",{p_season:"2026/27"}),
    sb.rpc("get_fantasy_xfp_admin_v1",{p_season:"2026/27"}),
    service.from("fantasy_player_availability").select("player_id,status,note,expected_return"),
  ]);
  if(settingsError)return NextResponse.json({ok:false,error:settingsError.message},{status:500});
  if(rowsError)return NextResponse.json({ok:false,error:rowsError.message},{status:500});
  if(availabilityError)return NextResponse.json({ok:false,error:availabilityError.message},{status:500});
  return NextResponse.json({ok:true,settings:settings?.[0]||null,valueDefinition:VALUE_DEFINITION,rows:adjustRows(rows||[],availability||[])});
}

export async function POST(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  const sb=clientFor(request);
  const service=serviceClient();
  if(!sb)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});
  if(!service)return NextResponse.json({ok:false,error:"Supabase server-konfigurasjon mangler."},{status:503});

  let body:any;
  try{body=await request.json()}catch{return NextResponse.json({ok:false,error:"Ugyldig request."},{status:400})}
  const weights=[body?.seasonWeight,body?.formWeight,body?.venueWeight,body?.opponentWeight].map(Number);
  if(weights.some(v=>!Number.isFinite(v)))return NextResponse.json({ok:false,error:"Alle vektene må være tall."},{status:400});
  if(Math.abs(weights.reduce((a,b)=>a+b,0)-100)>0.001)return NextResponse.json({ok:false,error:"Vektene må summere til 100 %."},{status:400});
  if(weights.some(v=>v<0||v>100))return NextResponse.json({ok:false,error:"Hver vekt må være mellom 0 og 100 %."},{status:400});

  const{error}=await sb.rpc("save_fantasy_xfp_settings_admin_v1",{
    p_season:"2026/27",
    p_season_weight:weights[0]/100,
    p_form_weight:weights[1]/100,
    p_venue_weight:weights[2]/100,
    p_opponent_weight:weights[3]/100,
  });
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500});

  const[{data:settings,error:settingsError},{data:rows,error:rowsError},{data:availability,error:availabilityError}]=await Promise.all([
    sb.rpc("get_fantasy_xfp_settings_admin_v1",{p_season:"2026/27"}),
    sb.rpc("get_fantasy_xfp_admin_v1",{p_season:"2026/27"}),
    service.from("fantasy_player_availability").select("player_id,status,note,expected_return"),
  ]);
  if(settingsError)return NextResponse.json({ok:false,error:settingsError.message},{status:500});
  if(rowsError)return NextResponse.json({ok:false,error:rowsError.message},{status:500});
  if(availabilityError)return NextResponse.json({ok:false,error:availabilityError.message},{status:500});
  return NextResponse.json({ok:true,settings:settings?.[0]||null,valueDefinition:VALUE_DEFINITION,rows:adjustRows(rows||[],availability||[])});
}
