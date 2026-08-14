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

  const horizon=request.nextUrl.searchParams.get("horizon")||"next3";
  if(!["next_game","next3"].includes(horizon))return NextResponse.json({ok:false,error:"Ugyldig horisont."},{status:400});

  const budgetRaw=request.nextUrl.searchParams.get("budget");
  const budget=budgetRaw===null||budgetRaw===""?null:Number(budgetRaw);
  if(budget!==null&&(!Number.isFinite(budget)||budget<=0||budget>500))return NextResponse.json({ok:false,error:"Ugyldig budsjett."},{status:400});

  const[{data:economy,error:economyError},{data:rows,error:optimizerError}]=await Promise.all([
    sb.rpc("get_fantasy_economy_admin_v1",{p_season:"2026/27"}),
    sb.rpc("get_fantasy_optimizer_admin_v1",{p_season:"2026/27",p_horizon:horizon,p_budget:budget}),
  ]);

  if(economyError)return NextResponse.json({ok:false,error:economyError.message},{status:500});
  if(optimizerError)return NextResponse.json({ok:false,error:optimizerError.message},{status:500});

  return NextResponse.json({ok:true,economy:economy?.[0]||null,rows:rows||[]});
}
