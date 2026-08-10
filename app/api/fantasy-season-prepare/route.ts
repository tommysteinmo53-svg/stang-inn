import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prepareFantasySeason } from "../../../lib/fantasy/season-import";

export const runtime="nodejs";
export const dynamic="force-dynamic";

async function requireAdmin(request:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return{ok:false as const,response:NextResponse.json({ok:false,error:"Supabase public-konfigurasjon mangler."},{status:503})};
 const authHeader=request.headers.get("authorization");const token=authHeader?.startsWith("Bearer ")?authHeader.slice(7):null;
 if(!token)return{ok:false as const,response:NextResponse.json({ok:false,error:"Mangler innlogging."},{status:401})};
 const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 const{data:userData,error:userError}=await auth.auth.getUser(token);
 if(userError||!userData.user)return{ok:false as const,response:NextResponse.json({ok:false,error:"Ugyldig innlogging."},{status:401})};
 const{data:player}=await auth.from("players").select("admin").eq("id",userData.user.id).maybeSingle();
 if(!player?.admin)return{ok:false as const,response:NextResponse.json({ok:false,error:"Kun admin kan importere Fantasy-sesonger."},{status:403})};
 return{ok:true as const};
}

export async function POST(request:NextRequest){
 const admin=await requireAdmin(request);if(!admin.ok)return admin.response;
 const url=new URL(request.url);const tournamentId=url.searchParams.get("tournamentId")||"435587";const season=url.searchParams.get("season")||"2025/26";
 try{return NextResponse.json({ok:true,result:await prepareFantasySeason(tournamentId,season)});}catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Ukjent sesongforberedelsesfeil"},{status:500});}
}
