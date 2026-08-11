import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return{ok:false as const,response:NextResponse.json({ok:false,error:"Supabase public-konfigurasjon mangler."},{status:503})};
  const h=request.headers.get("authorization"),token=h?.startsWith("Bearer ")?h.slice(7):null;
  if(!token)return{ok:false as const,response:NextResponse.json({ok:false,error:"Mangler innlogging."},{status:401})};
  const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const{data:u,error:e}=await auth.auth.getUser(token);
  if(e||!u.user)return{ok:false as const,response:NextResponse.json({ok:false,error:"Ugyldig innlogging."},{status:401})};
  const{data:p}=await auth.from("players").select("admin").eq("id",u.user.id).maybeSingle();
  if(!p?.admin)return{ok:false as const,response:NextResponse.json({ok:false,error:"Kun admin."},{status:403})};
  return{ok:true as const};
}

function matchId(externalId:any){const m=String(externalId||"").match(/(\d+)/);return m?Number(m[1]):null}

export async function GET(request:NextRequest){
  const admin=await requireAdmin(request);if(!admin.ok)return admin.response;
  const season=new URL(request.url).searchParams.get("season")||"2025/26";
  try{
    const sbUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY;
    if(!sbUrl||!secret)throw new Error("Supabase server-konfigurasjon mangler");
    const db=createClient(sbUrl,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const{data:games,error:ge}=await db.from("fantasy_games").select("id,external_id,starts_at,status,home_team,away_team").eq("season",season).order("starts_at",{ascending:true});
    if(ge)throw ge;
    const gameRows=games||[],gameIds=new Set(gameRows.map((g:any)=>g.id));
    const importedIds=new Set<string>();
    for(let from=0;;from+=1000){
      const{data,error}=await db.from("fantasy_player_game_stats").select("game_id").range(from,from+999);
      if(error)throw error;
      const batch=data||[];
      for(const r of batch)if(gameIds.has(r.game_id))importedIds.add(r.game_id);
      if(batch.length<1000)break;
    }
    const imported=gameRows.filter((g:any)=>importedIds.has(g.id));
    const pending=gameRows.filter((g:any)=>!importedIds.has(g.id));
    return NextResponse.json({ok:true,result:{season,totalGames:gameRows.length,importedGames:imported.length,pendingGames:pending.length,percent:gameRows.length?Math.round(imported.length/gameRows.length*1000)/10:0,importedMatchIds:imported.map((g:any)=>matchId(g.external_id)).filter(Boolean),pendingMatchIds:pending.map((g:any)=>matchId(g.external_id)).filter(Boolean),lastImported:imported.at(-1)||null}});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Kunne ikke hente importstatus"},{status:500})}
}
