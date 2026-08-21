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

  const{data,error}=await sb.rpc("get_fantasy_fixture_rating_admin_v2",{p_season:"2026/27"});
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500});

  return NextResponse.json({
    ok:true,
    rows:data||[],
    definition:{
      version:"v2",
      scale:"1–5",
      direction:"1 = svært vanskelig, 5 = svært lett",
      thresholds:{very_hard:"≤ 0.85",hard:"0.851–0.95",neutral:"0.951–1.049",easy:"1.05–1.149",very_easy:"≥ 1.15"},
      transition:"Preseason brukes før seriestart. Live EHL-data fases inn lineært over lagets første 12 ferdigspilte seriekamper og er 100 % vektet fra kamp 12.",
      liveCurve:"Live-faktor bruker GF/GA relativt til ligasnitt med eksponent 0,80 og sikkerhetsgrenser 0,70–1,35.",
      xfpImpact:"Motstanderkomponenten har 10 % modellvekt; factor påvirker derfor bare denne delen av base-xFP.",
      source:"fantasy_xfp_opponent_factor",
    },
  });
}
