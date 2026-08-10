import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureAndMaterializeFantasySnapshot, captureFantasySnapshot, materializeLatestSnapshotDelta } from "../../../lib/fantasy/snapshot-service";
import { probeHockeyLiveMatch } from "../../../lib/fantasy/match-probe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return { ok:false as const, response:NextResponse.json({ok:false,error:"Supabase public-konfigurasjon mangler."},{status:503}) };
  const authHeader=request.headers.get("authorization");
  const token=authHeader?.startsWith("Bearer ")?authHeader.slice(7):null;
  if(!token)return{ok:false as const,response:NextResponse.json({ok:false,error:"Mangler innlogging."},{status:401})};
  const authClient=createClient(supabaseUrl,publishableKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:userData,error:userError}=await authClient.auth.getUser(token);
  if(userError||!userData.user)return{ok:false as const,response:NextResponse.json({ok:false,error:"Ugyldig innlogging."},{status:401})};
  const {data:player}=await authClient.from("players").select("admin").eq("id",userData.user.id).maybeSingle();
  if(!player?.admin)return{ok:false as const,response:NextResponse.json({ok:false,error:"Kun admin kan kjøre Fantasy-snapshot."},{status:403})};
  return{ok:true as const};
}

export async function POST(request:NextRequest){
  const admin=await requireAdmin(request); if(!admin.ok)return admin.response;
  const url=new URL(request.url);
  const action=url.searchParams.get("action")||"capture-and-materialize";
  const season=url.searchParams.get("season")||undefined;
  try{
    if(action==="probe-match"){
      const matchId=url.searchParams.get("matchId")||"8183135";
      return NextResponse.json({ok:true,result:await probeHockeyLiveMatch(matchId)});
    }
    if(action==="capture")return NextResponse.json({ok:true,result:await captureFantasySnapshot(season)});
    if(action==="materialize")return NextResponse.json({ok:true,result:await materializeLatestSnapshotDelta(season)});
    return NextResponse.json({ok:true,result:await captureAndMaterializeFantasySnapshot(season)});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Ukjent snapshot-feil"},{status:500});}
}
