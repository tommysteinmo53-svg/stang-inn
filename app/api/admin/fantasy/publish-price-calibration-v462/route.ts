import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const SEASON="2026/27";
const MODEL="V4.6.2";
const CONFIRM="PUBLISER V4.6.2";
const EXPECTED_ROSTER=239;

type Change={old:number|null;price:number;routing:string;confidence:"Høy"|"Middels"|"Lav";source:string;makeAvailable?:boolean};

const CHANGES:Record<string,Change>={
  "Filip Bratt":{old:null,price:7.5,routing:"MP-03.6 importkalibrering",confidence:"Lav",source:"Ligue Magnus 2025/26 · konservativ seniorimport-back",makeAvailable:true},
  "Matteo Mitrovic":{old:null,price:6.5,routing:"MP-03.6 importkalibrering",confidence:"Lav",source:"AlpsHL 2025/26 · konservativ seniorimport-back",makeAvailable:true},
  "Alexander Bjurström":{old:null,price:8.0,routing:"V4.6.2 · HockeyEttan import",confidence:"Middels",source:"HockeyEttan 2025/26",makeAvailable:true},
  "Christian Daniel Blomqvist":{old:null,price:11.0,routing:"V4.6.2 · EHL historikk",confidence:"Høy",source:"2025/26 historisk pris 11.0m + 45 EHL-kamper",makeAvailable:true},
  "Ludwig Blomstrand":{old:null,price:12.5,routing:"V4.6.2 · HockeyAllsvenskan import",confidence:"Middels",source:"HockeyAllsvenskan 2025/26 + forventet Stavanger-rolle",makeAvailable:true},
  "Noah Jacobsen":{old:1.0,price:2.0,routing:"MP-03.6 value-kalibrering",confidence:"Høy",source:"34 historiske kamper · ekstrem D-verdi/million"},
  "Anders Jonassen":{old:1.5,price:2.5,routing:"MP-03.6 value-kalibrering",confidence:"Høy",source:"41 historiske kamper · topp D-verdi/million"},
  "Nils Didrik Eide Utter":{old:2.5,price:3.5,routing:"MP-03.6 value-kalibrering",confidence:"Høy",source:"30 historiske kamper · topp W-verdi/million"},
  "Herman Teslo Skjefstad":{old:2.5,price:3.5,routing:"MP-03.6 value-kalibrering",confidence:"Høy",source:"40 historiske kamper · topp W-verdi/million"},
  "Nils Sunde":{old:1.0,price:2.0,routing:"MP-03.6 value-kalibrering",confidence:"Høy",source:"28 historiske kamper · ekstrem D-verdi/million"},
  "Nicolay Eiken Andresen":{old:2.0,price:3.0,routing:"MP-03.6 value-kalibrering",confidence:"Høy",source:"40 historiske kamper · høy D-verdi/million"},
  "Jens Jøsok Holstad":{old:2.5,price:3.5,routing:"MP-03.6 value-kalibrering",confidence:"Høy",source:"44 historiske kamper · høy D-verdi/million"},
  "Danil Kovalenko":{old:2.5,price:3.5,routing:"MP-03.6 value-kalibrering",confidence:"Høy",source:"39 historiske kamper · høy D-verdi/million"},
  "Johan Dehli Gjøs":{old:3.0,price:3.5,routing:"MP-03.6 value-kalibrering",confidence:"Høy",source:"38 historiske kamper · høy D-verdi/million"},
};

function serverClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error("Supabase server-konfigurasjon mangler");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

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

async function buildPayload(){
  const supabase=serverClient();
  const[{data:players,error:pe},{data:seasonPrices,error:se}]=await Promise.all([
    supabase.from("fantasy_players").select("id,name,team,position,price,available_for_purchase").eq("active",true).eq("on_current_roster",true).order("name"),
    supabase.from("fantasy_player_season_prices").select("player_id,price").eq("season",SEASON),
  ]);
  if(pe)throw pe;if(se)throw se;
  if((players||[]).length!==EXPECTED_ROSTER)throw new Error(`Roster har endret seg siden kalibreringen: forventet ${EXPECTED_ROSTER}, fikk ${(players||[]).length}. Kjør ny MP-03.6-kontroll.`);
  const priceMap=new Map((seasonPrices||[]).map((x:any)=>[x.player_id,Number(x.price)]));
  const found=new Set<string>(),drift:string[]=[];
  const rows=(players||[]).map((p:any)=>{
    const current=priceMap.has(p.id)?priceMap.get(p.id)!:(p.price==null?null:Number(p.price));
    const change=CHANGES[p.name];
    if(change){
      found.add(p.name);
      const matches=change.old===null?current===null:current!==null&&Math.abs(current-change.old)<1e-9;
      if(!matches)drift.push(`${p.name}: forventet ${change.old??"ingen pris"}, fant ${current??"ingen pris"}`);
      return{player_id:p.id,name:p.name,team:p.team,position:p.position,price:change.price,routing:change.routing,confidence:change.confidence,source:change.source,make_available:Boolean(change.makeAvailable),old_price:current,changed:true};
    }
    if(current===null)drift.push(`${p.name}: mangler pris, men er ikke i godkjent kalibreringssett`);
    return{player_id:p.id,name:p.name,team:p.team,position:p.position,price:current,routing:"V4.6.1 uendret",confidence:"",source:"MP-03.6 full-pool republisering",make_available:false,old_price:current,changed:false};
  });
  const missingTargets=Object.keys(CHANGES).filter(n=>!found.has(n));
  if(missingTargets.length)drift.push(`Godkjente spillere mangler fra roster: ${missingTargets.join(", ")}`);
  return{rows,drift,changes:rows.filter((x:any)=>x.changed)};
}

export async function GET(request:NextRequest){
  const admin=await requireAdmin(request);if(!admin.ok)return admin.response;
  try{const p=await buildPayload();return NextResponse.json({ok:true,season:SEASON,modelVersion:MODEL,confirmation:CONFIRM,rosterCount:p.rows.length,changeCount:p.changes.length,drift:p.drift,changes:p.changes});}
  catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Kunne ikke bygge V4.6.2-preview"},{status:500})}
}

export async function POST(request:NextRequest){
  const admin=await requireAdmin(request);if(!admin.ok)return admin.response;
  try{
    const body=await request.json();
    if(body?.confirmation!==CONFIRM)return NextResponse.json({ok:false,error:`Skriv nøyaktig «${CONFIRM}».`},{status:400});
    const p=await buildPayload();
    if(p.drift.length)return NextResponse.json({ok:false,error:"Publisering blokkert av pris-/rosterdrift.",drift:p.drift},{status:409});
    if(p.changes.length!==14)return NextResponse.json({ok:false,error:`Forventet 14 godkjente endringer, fikk ${p.changes.length}.`},{status:409});
    const supabase=serverClient();
    const payload=p.rows.map((r:any)=>({player_id:r.player_id,price:r.price,position:r.position,routing:r.routing,confidence:r.confidence,source:r.source,make_available:r.make_available}));
    const{data,error}=await supabase.rpc("publish_fantasy_prices_v462",{p_rows:payload,p_admin:admin.userId,p_season:SEASON,p_model_version:MODEL});
    if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
    return NextResponse.json({ok:true,publicationId:data,season:SEASON,modelVersion:MODEL,playerCount:p.rows.length,changed:p.changes.length,publishedAt:new Date().toISOString()});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Ukjent V4.6.2-publiseringsfeil"},{status:500})}
}
