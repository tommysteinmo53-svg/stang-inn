import {NextRequest,NextResponse} from "next/server";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {backtestNittenArticle,NITTEN_GOLDEN_2026_03_08} from "../../../../../lib/fantasy/availability-nitten-backtest";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const ARTICLE_URL="https://www.nitten.no/blogg/for-dropp-halmrast-tilbake-kaijser-ma-sone-ingen-gloppen-straff";
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
  const response=await fetch(ARTICLE_URL,{headers:{"User-Agent":"StangInnAvailabilityBacktest/1.0",Accept:"text/html"},cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error(`nitten.no svarte ${response.status}`);
  const text=cleanHtml(await response.text());
  const expected=NITTEN_GOLDEN_2026_03_08;
  const findings=backtestNittenArticle(text,Object.keys(expected));
  const foundByName=new Map(findings.map(f=>[f.playerName,f]));
  const rows=Object.entries(expected).map(([playerName,expectedStatus])=>{
   const found=foundByName.get(playerName);
   const result=!found?"missing":found.status===expectedStatus?"correct":"misclassified";
   return {playerName,expectedStatus,foundStatus:found?.status||null,evidence:found?.evidence||null,result};
  });
  return NextResponse.json({ok:true,articleUrl:ARTICLE_URL,expected:rows.length,found:findings.length,correct:rows.filter(r=>r.result==="correct").length,missing:rows.filter(r=>r.result==="missing").length,misclassified:rows.filter(r=>r.result==="misclassified").length,rows});
 }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Kunne ikke kjøre nitten.no-backtest"},{status:500})}
}
