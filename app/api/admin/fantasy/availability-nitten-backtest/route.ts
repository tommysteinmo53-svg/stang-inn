import {NextRequest,NextResponse} from "next/server";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {backtestNittenArticle,NITTEN_GOLDEN_2026_03_08} from "../../../../../lib/fantasy/availability-nitten-backtest";
import {NITTEN_GOLDEN_2026_01_03} from "../../../../../lib/fantasy/availability-nitten-golden-2026-01-03";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const TESTS=[
 {id:"2026-03-08",label:"Golden #1 · 8. mars 2026",articleUrl:"https://www.nitten.no/blogg/for-dropp-halmrast-tilbake-kaijser-ma-sone-ingen-gloppen-straff",expected:NITTEN_GOLDEN_2026_03_08},
 {id:"2026-01-03",label:"Golden #2 · 3. januar 2026",articleUrl:"https://www.nitten.no/blogg/for-dropp-mister-toppkampen-med-skade-lik-sykdom-lorenskog-karantener",expected:NITTEN_GOLDEN_2026_01_03}
];
const cleanHtml=(html:string)=>html
 .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
 .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
 .replace(/<br\s*\/?>/gi,". ")
 .replace(/<\/p>|<\/h[1-6]>|<\/li>|<\/div>/gi,". ")
 .replace(/<[^>]+>/g," ")
 .replace(/&nbsp;|&#160;/gi," ")
 .replace(/&amp;/gi,"&")
 .replace(/&quot;/gi,'"')
 .replace(/&#39;|&apos;/gi,"'")
 .replace(/&aring;/gi,"å").replace(/&oslash;/gi,"ø").replace(/&aelig;/gi,"æ")
 .replace(/&Aring;/g,"Å").replace(/&Oslash;/g,"Ø").replace(/&AElig;/g,"Æ")
 .replace(/\s+/g," ").trim();

export async function POST(request:NextRequest){
 const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
 try{
  const tests=[];
  for(const test of TESTS){
   const response=await fetch(test.articleUrl,{headers:{"User-Agent":"StangInnAvailabilityBacktest/1.1",Accept:"text/html"},cache:"no-store",signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error(`nitten.no svarte ${response.status} for ${test.id}`);
   const text=cleanHtml(await response.text());
   const findings=backtestNittenArticle(text,Object.keys(test.expected));
   const foundByName=new Map(findings.map(f=>[f.playerName,f]));
   const rows=Object.entries(test.expected).map(([playerName,expectedStatus])=>{
    const found=foundByName.get(playerName);
    const result=!found?"missing":found.status===expectedStatus?"correct":"misclassified";
    return {playerName,expectedStatus,foundStatus:found?.status||null,evidence:found?.evidence||null,result};
   });
   tests.push({id:test.id,label:test.label,articleUrl:test.articleUrl,expected:rows.length,found:findings.length,correct:rows.filter(r=>r.result==="correct").length,missing:rows.filter(r=>r.result==="missing").length,misclassified:rows.filter(r=>r.result==="misclassified").length,rows});
  }
  return NextResponse.json({ok:true,expected:tests.reduce((n,t)=>n+t.expected,0),found:tests.reduce((n,t)=>n+t.found,0),correct:tests.reduce((n,t)=>n+t.correct,0),missing:tests.reduce((n,t)=>n+t.missing,0),misclassified:tests.reduce((n,t)=>n+t.misclassified,0),tests});
 }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Kunne ikke kjøre nitten.no-backtest"},{status:500})}
}
