import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const BASE="https://sf34-terminlister-prod-app.azurewebsites.net/";

async function requireAdmin(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return{ok:false as const,response:NextResponse.json({ok:false,error:"Supabase public-konfigurasjon mangler."},{status:503})};
  const header=request.headers.get("authorization"),token=header?.startsWith("Bearer ")?header.slice(7):null;
  if(!token)return{ok:false as const,response:NextResponse.json({ok:false,error:"Mangler innlogging."},{status:401})};
  const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const{data:userData,error:userError}=await auth.auth.getUser(token);
  if(userError||!userData.user)return{ok:false as const,response:NextResponse.json({ok:false,error:"Ugyldig innlogging."},{status:401})};
  const{data:player}=await auth.from("players").select("admin").eq("id",userData.user.id).maybeSingle();
  if(!player?.admin)return{ok:false as const,response:NextResponse.json({ok:false,error:"Kun admin."},{status:403})};
  return{ok:true as const};
}
function rows(payload:any){if(Array.isArray(payload))return payload;if(Array.isArray(payload?.data))return payload.data;if(Array.isArray(payload?.goalies))return payload.goalies;if(Array.isArray(payload?.data?.goalies))return payload.data.goalies;return[]}
function nk(v:any){return String(v??"").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function tokens(v:any){return nk(v).split(/\s+/).filter(Boolean)}
function sameName(a:any,b:any){const ak=nk(a),bk=nk(b);if(ak===bk)return true;const at=tokens(a),bt=tokens(b);return at.length>=2&&bt.length>=2&&at[0]===bt[0]&&at[at.length-1]===bt[bt.length-1]}

export async function GET(request:NextRequest){
  const admin=await requireAdmin(request);if(!admin.ok)return admin.response;
  const url=new URL(request.url),name=url.searchParams.get("name")||"",tournamentId=(url.searchParams.get("tournamentId")||"435587").replace(/\D/g,"");
  if(!name)return NextResponse.json({ok:false,error:"Mangler keepernavn."},{status:400});
  try{
    const res=await fetch(`${BASE}icehockey/TournamentGoalieLeaders/${tournamentId}`,{headers:{Accept:"application/json","User-Agent":"StangInn/1.0 fantasy-diagnose"},cache:"no-store"});
    if(!res.ok)throw new Error(`HockeyLive svarte ${res.status}`);
    const payload=await res.json(),all=rows(payload);
    const row=all.find((r:any)=>sameName(`${r.firstName??""} ${r.lastName??""}`,name));
    if(!row)return NextResponse.json({ok:true,found:false,count:all.length});
    return NextResponse.json({ok:true,found:true,row:{name:`${row.firstName??""} ${row.lastName??""}`.trim(),teamName:row.teamName??"",gamesPlayed:Number(row.gamesPlayed??0),minutesPlayed:Number(row.minutesPlayed??0),wins:Number(row.wins??0),losses:Number(row.losses??0),shutouts:Number(row.so??0),goalsAgainst:Number(row.ga??0),saves:Number(row.sv??0),savePct:Number(row.svPct??0)}});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Sesongkontroll feilet"},{status:500})}
}
