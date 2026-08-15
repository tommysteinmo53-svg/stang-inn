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
  if(!sb)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon eller Authorization-header mangler."},{status:503});

  const{data,error}=await (sb as any).rpc("get_fantasy_preseason_xfp_preview_admin_v2",{p_season:"2026/27"});
  if(error){
    return NextResponse.json({
      ok:false,
      error:error.message||"Preview-RPC feilet",
      code:error.code||null,
      details:error.details||null,
      hint:error.hint||null,
    },{status:500});
  }
  return NextResponse.json({ok:true,count:(data||[]).length,rows:(data||[]).slice(0,5)});
}
