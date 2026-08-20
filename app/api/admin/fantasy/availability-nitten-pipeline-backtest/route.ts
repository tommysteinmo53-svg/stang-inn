import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {readOnlyNittenPipelineCheck} from "../../../../../lib/fantasy/availability-source-scan";
import {NITTEN_GOLDEN_2026_03_08} from "../../../../../lib/fantasy/availability-nitten-backtest";
import {NITTEN_GOLDEN_2026_01_03} from "../../../../../lib/fantasy/availability-nitten-golden-2026-01-03";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const TESTS=[
 {id:"2026-03-08",label:"Golden #1 · 8. mars 2026",articleUrl:"https://www.nitten.no/blogg/for-dropp-halmrast-tilbake-kaijser-ma-sone-ingen-gloppen-straff",expected:NITTEN_GOLDEN_2026_03_08},
 {id:"2026-01-03",label:"Golden #2 · 3. januar 2026",articleUrl:"https://www.nitten.no/blogg/for-dropp-mister-toppkampen-med-skade-lik-sykdom-lorenskog-karantener",expected:NITTEN_GOLDEN_2026_01_03}
];
function sb(){const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.SUPABASE_SECRET_KEY;if(!u||!k)throw new Error("Supabase server-variabler mangler");return createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}})}

export async function POST(request:NextRequest){
 const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
 try{
  const c=sb();const{data:players,error}=await c.from("fantasy_players").select("id,name,team").eq("active",true).eq("on_current_roster",true);if(error)throw error;
  const roster=(players||[]) as {id:string;name:string;team:string}[];
  const tests=[];
  for(const test of TESTS){
   const pipeline=await readOnlyNittenPipelineCheck(test.articleUrl,roster,Object.keys(test.expected));
   const byName=new Map(pipeline.findings.map(f=>[f.playerName,f]));
   const rows=Object.entries(test.expected).map(([playerName,expectedStatus])=>{const found=byName.get(playerName);const result=!found?"missing":found.status===expectedStatus?"correct":"misclassified";return{playerName,expectedStatus,foundStatus:found?.status||null,evidence:found?.evidence||null,result,rosterMatch:!!found?.proposedPlayerId,matchMethod:found?.matchMethod||null,matchConfidence:found?.matchConfidence||null,reviewStatus:found?.reviewStatus||null,matchReason:found?.matchReason||null}});
   tests.push({id:test.id,label:test.label,articleUrl:test.articleUrl,publishedAt:pipeline.publishedAt,expected:rows.length,found:pipeline.findings.length,correct:rows.filter(r=>r.result==="correct").length,missing:rows.filter(r=>r.result==="missing").length,misclassified:rows.filter(r=>r.result==="misclassified").length,rosterMatched:rows.filter(r=>r.rosterMatch).length,rows});
  }
  return NextResponse.json({ok:true,readOnly:true,writes:0,expected:tests.reduce((n,t)=>n+t.expected,0),found:tests.reduce((n,t)=>n+t.found,0),correct:tests.reduce((n,t)=>n+t.correct,0),missing:tests.reduce((n,t)=>n+t.missing,0),misclassified:tests.reduce((n,t)=>n+t.misclassified,0),rosterMatched:tests.reduce((n,t)=>n+t.rosterMatched,0),tests});
 }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Kunne ikke kjøre produksjonspipeline-backtest"},{status:500})}
}
