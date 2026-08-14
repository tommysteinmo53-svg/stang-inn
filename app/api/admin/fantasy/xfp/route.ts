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

  const playerId=request.nextUrl.searchParams.get("playerId");
  if(playerId){
    const{data,error}=await sb.rpc("get_fantasy_xfp_player_fixtures_admin_v1",{p_player_id:playerId,p_season:"2026/27"});
    if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
    return NextResponse.json({ok:true,fixtures:data||[]});
  }

  const[{data:settings,error:settingsError},{data:rows,error:rowsError}]=await Promise.all([
    sb.rpc("get_fantasy_xfp_settings_admin_v1",{p_season:"2026/27"}),
    sb.rpc("get_fantasy_xfp_admin_v1",{p_season:"2026/27"}),
  ]);
  if(settingsError)return NextResponse.json({ok:false,error:settingsError.message},{status:500});
  if(rowsError)return NextResponse.json({ok:false,error:rowsError.message},{status:500});
  return NextResponse.json({ok:true,settings:settings?.[0]||null,rows:rows||[]});
}

export async function POST(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  const sb=clientFor(request);
  if(!sb)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});

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

  const[{data:settings,error:settingsError},{data:rows,error:rowsError}]=await Promise.all([
    sb.rpc("get_fantasy_xfp_settings_admin_v1",{p_season:"2026/27"}),
    sb.rpc("get_fantasy_xfp_admin_v1",{p_season:"2026/27"}),
  ]);
  if(settingsError)return NextResponse.json({ok:false,error:settingsError.message},{status:500});
  if(rowsError)return NextResponse.json({ok:false,error:rowsError.message},{status:500});
  return NextResponse.json({ok:true,settings:settings?.[0]||null,rows:rows||[]});
}
