import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const CONFIRM="PUBLISER V4.6.1";
const MODEL="V4.6.1";
const SEASON="2026/27";
const EXPECTED=242;

async function requireAdmin(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return{ok:false as const,response:NextResponse.json({ok:false,error:"Supabase public-konfigurasjon mangler."},{status:503})};
  const header=request.headers.get("authorization"),token=header?.startsWith("Bearer ")?header.slice(7):null;
  if(!token)return{ok:false as const,response:NextResponse.json({ok:false,error:"Mangler innlogging."},{status:401})};
  const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const{data:userData,error:userError}=await auth.auth.getUser(token);
  if(userError||!userData.user)return{ok:false as const,response:NextResponse.json({ok:false,error:"Ugyldig innlogging."},{status:401})};
  const{data:player}=await auth.from("players").select("admin").eq("id",userData.user.id).maybeSingle();
  if(!player?.admin)return{ok:false as const,response:NextResponse.json({ok:false,error:"Kun admin kan publisere Fantasy-priser."},{status:403})};
  return{ok:true as const,userId:userData.user.id};
}

function serverClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error("Supabase server-variabler mangler");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

function validHalf(v:number){return Number.isFinite(v)&&v>=1&&v<=20&&Math.abs(v*2-Math.round(v*2))<1e-9}

export async function POST(request:NextRequest){
  const admin=await requireAdmin(request);if(!admin.ok)return admin.response;
  try{
    const body=await request.json();
    if(body?.confirmation!==CONFIRM)return NextResponse.json({ok:false,error:`Skriv nøyaktig «${CONFIRM}» for å publisere.`},{status:400});
    if(body?.modelVersion!==MODEL||body?.season!==SEASON)return NextResponse.json({ok:false,error:"Feil modellversjon eller sesong."},{status:400});
    if(Number(body?.blockingCount)!==0||Number(body?.missingPositionCount)!==0)return NextResponse.json({ok:false,error:"Publisering blokkert: preview har reelle kontrollsaker eller manglende posisjoner."},{status:409});
    const rows=Array.isArray(body?.rows)?body.rows:[];
    if(rows.length!==EXPECTED)return NextResponse.json({ok:false,error:`Forventet ${EXPECTED} spillere, fikk ${rows.length}.`},{status:400});
    const seen=new Set<string>();
    for(const r of rows){
      const name=String(r?.name||"").trim(),price=Number(r?.price),position=String(r?.position||"").toUpperCase();
      if(!name||seen.has(name.toLocaleLowerCase("nb-NO")))return NextResponse.json({ok:false,error:`Tomt eller duplisert spillernavn: ${name||"(tomt)"}`},{status:400});
      seen.add(name.toLocaleLowerCase("nb-NO"));
      if(!validHalf(price))return NextResponse.json({ok:false,error:`Ugyldig pris for ${name}: ${r?.price}`},{status:400});
      if(!["C","W","D","G"].includes(position))return NextResponse.json({ok:false,error:`Ugyldig posisjon for ${name}: ${position}`},{status:400});
    }
    const supabase=serverClient();
    const payload=rows.map((r:any)=>({name:String(r.name),price:Number(r.price),position:String(r.position),routing:String(r.routing||""),confidence:String(r.confidence||""),source:String(r.source||"")}));
    const{data,error}=await supabase.rpc("publish_fantasy_prices_v461",{p_rows:payload,p_admin:admin.userId,p_season:SEASON,p_model_version:MODEL});
    if(error){
      const missing=String(error.message||"").includes("publish_fantasy_prices_v461");
      return NextResponse.json({ok:false,error:missing?"Supabase v0.8-migrasjonen må kjøres før prisene kan publiseres.":error.message},{status:missing?503:500});
    }
    return NextResponse.json({ok:true,publicationId:data,season:SEASON,modelVersion:MODEL,playerCount:rows.length,publishedAt:new Date().toISOString()});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Ukjent publiseringsfeil"},{status:500})}
}
