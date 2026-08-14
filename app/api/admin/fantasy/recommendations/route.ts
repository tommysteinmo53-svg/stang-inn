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
  const{data,error}=await sb.rpc("get_fantasy_recommendation_data_admin_v1",{p_season:"2026/27"});
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500});

  // The command-center UI originally required >=5 current-season games before a player
  // could enter Spillerradar. xFP v2 now has a validated 2025/26 baseline, so medium/high
  // historical confidence is sufficient during preseason and games 1-4. Keep the actual
  // current-season game count separately for diagnostics while exposing an eligibility count
  // compatible with the existing UI. Low-confidence priors remain excluded.
  const rows=(data||[]).map((row:any)=>({
    ...row,
    actual_games_scored:Number(row.games_scored||0),
    games_scored:row.data_confidence!=="low"
      ?Math.max(5,Number(row.games_scored||0))
      :Number(row.games_scored||0),
  }));

  return NextResponse.json({ok:true,rows});
}
