import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://sf34-terminlister-prod-app.azurewebsites.net/";

async function requireAdmin(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { ok:false as const, response:NextResponse.json({ok:false,error:"Supabase public-konfigurasjon mangler."},{status:503}) };
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { ok:false as const, response:NextResponse.json({ok:false,error:"Mangler innlogging."},{status:401}) };
  const auth = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:userData,error:userError}=await auth.auth.getUser(token);
  if (userError || !userData.user) return {ok:false as const,response:NextResponse.json({ok:false,error:"Ugyldig innlogging."},{status:401})};
  const {data:player}=await auth.from("players").select("admin").eq("id",userData.user.id).maybeSingle();
  if (!player?.admin) return {ok:false as const,response:NextResponse.json({ok:false,error:"Kun admin."},{status:403})};
  return {ok:true as const};
}

function rows(payload:any){
  if(Array.isArray(payload)) return payload;
  if(Array.isArray(payload?.data)) return payload.data;
  if(Array.isArray(payload?.goals)) return payload.goals;
  if(Array.isArray(payload?.data?.goals)) return payload.data.goals;
  return [];
}

export async function GET(request:NextRequest){
  const admin=await requireAdmin(request); if(!admin.ok) return admin.response;
  const ids=(new URL(request.url).searchParams.get("ids")||"").split(",").map(v=>v.replace(/\D/g,"")).filter(Boolean).slice(0,60);
  if(!ids.length) return NextResponse.json({ok:true,matches:{}});
  const out:Record<string,any[]>={};
  for(let i=0;i<ids.length;i+=8){
    const batch=ids.slice(i,i+8);
    await Promise.all(batch.map(async id=>{
      try{
        const res=await fetch(`${BASE}icehockey/Match/Goals/${id}`,{headers:{Accept:"application/json","User-Agent":"StangInn/1.0 fantasy-diagnose"},cache:"no-store"});
        if(!res.ok){out[id]=[];return;}
        const payload=await res.json();
        out[id]=rows(payload).map((g:any)=>({teamName:g.teamName??g.TeamName??g.teamShortName??"",homeOrAwayTeam:g.homeOrAwayTeam??g.HomeOrAwayTeam??"",emptyNet:Boolean(g.emptyNet??g.EmptyNet),goalType:g.goalType??g.GoalType??""}));
      }catch{out[id]=[];}
    }));
  }
  return NextResponse.json({ok:true,matches:out});
}
