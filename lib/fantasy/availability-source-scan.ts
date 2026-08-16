import {matchAvailabilityFinding} from "./availability-match";

export type AvailabilitySource={
  kind:"club"|"nitten";
  label:string;
  url:string;
  teamHint?:string;
  articlePath?:RegExp;
};

export type RosterPlayer={id:string;name:string;team:string};
export type ScannedFinding={
  sourceKind:"club"|"nitten";
  sourceLabel:string;
  sourceUrl:string;
  rawPlayerName:string;
  rawTeam:string|null;
  rawStatus:"questionable"|"out"|"long_term"|"returning"|"not_in_lineup";
  rawNote:string;
  proposedPlayerId:string|null;
  matchMethod:string|null;
  matchConfidence:number|null;
  matchReason:string;
  reviewStatus:"pending"|"needs_review";
};

export const AVAILABILITY_SOURCES:AvailabilitySource[]=[
  {kind:"nitten",label:"nitten.no",url:"https://www.nitten.no/",articlePath:/^\/blogg\//},
  {kind:"club",label:"Frisk Asker",url:"https://www.friskaskerhockey.no/",teamHint:"Frisk Asker"},
  {kind:"club",label:"Lillehammer IK",url:"https://www.lillehammerhockey.no/",teamHint:"Lillehammer"},
  {kind:"club",label:"Narvik Hockey",url:"https://www.narvikhockey.no/",teamHint:"Narvik"},
  {kind:"club",label:"Nidaros Hockey",url:"https://www.nidaroshockey.no/",teamHint:"Nidaros"},
  {kind:"club",label:"Ringerike Panthers",url:"https://elite.ringerikepanthers.no/",teamHint:"Ringerike"},
  {kind:"club",label:"Sparta Sarpsborg",url:"https://www.sparta.no/",teamHint:"Sparta"},
  {kind:"club",label:"Stavanger Oilers",url:"https://www.oilers.no/",teamHint:"Stavanger Oilers"},
  {kind:"club",label:"Stjernen Hockey",url:"https://www.stjernen.no/",teamHint:"Stjernen"},
  {kind:"club",label:"Storhamar Hockey",url:"https://www.sil.no/",teamHint:"Storhamar"},
  {kind:"club",label:"Vålerenga Ishockey",url:"https://www.vif-hockey.no/",teamHint:"Vålerenga"},
];

const decode=(s:string)=>s.replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&aring;/gi,"å").replace(/&oslash;/gi,"ø").replace(/&aelig;/gi,"æ").replace(/&Aring;/g,"Å").replace(/&Oslash;/g,"Ø").replace(/&AElig;/g,"Æ");
const textFromHtml=(html:string)=>decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim());
const norm=(s:string)=>s.toLocaleLowerCase("nb-NO").replace(/[‐‑–—]/g,"-").replace(/\s+/g," ").trim();
const escapeRe=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

function classify(snippet:string):ScannedFinding["rawStatus"]|null{
  const s=norm(snippet);
  if(/ikke i (kamp)?tropp|utenfor troppen|ikke med i troppen/.test(s))return "not_in_lineup";
  if(/langtidsskadd|langtidsskadet|mister resten av sesongen|ute resten av sesongen|ute i (flere )?(måneder|uker)/.test(s))return "long_term";
  if(/tilbake i trening|tilbake på is|tilbake på isen|gjør comeback|comeback|tilbake etter skade/.test(s))return "returning";
  if(/usikker|tvilsom|dag til dag|vurderes før kamp|uklart om .* klar/.test(s))return "questionable";
  if(/ute med skade|ute på grunn av skade|skadet|skadd|sykdom|syk|karantene|suspendert|soner|mangler(?: fortsatt)?|står over|ikke spilleklar/.test(s))return "out";
  return null;
}

function linksFromHtml(html:string,base:string,articlePath?:RegExp){
  const origin=new URL(base).origin;const out:string[]=[];const seen=new Set<string>();
  const re=/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>/gi;let m:RegExpExecArray|null;
  while((m=re.exec(html))){try{const u=new URL(m[1],base);if(u.origin!==origin)continue;if(articlePath&&!articlePath.test(u.pathname))continue;if(!articlePath){if(u.pathname==="/"||u.pathname.length<8||/\.(jpg|jpeg|png|gif|svg|pdf|mp4)$/i.test(u.pathname))continue;if(/\/(kontakt|billetter|statistikk|kamper|lag|team|shop|webshop|personvern|cookie|sponsor)/i.test(u.pathname))continue}u.hash="";const href=u.toString();if(!seen.has(href)){seen.add(href);out.push(href)}}catch{}}
  }
  return out.slice(0,12);
}

async function getHtml(url:string){const r=await fetch(url,{headers:{"User-Agent":"StangInnAvailabilityBot/1.0 (+admin-reviewed fantasy availability)"},cache:"no-store",signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);const type=r.headers.get("content-type")||"";if(!type.includes("text/html"))throw new Error("ikke HTML");return await r.text()}

export async function scanAvailabilitySources(players:RosterPlayer[],sources=AVAILABILITY_SOURCES){
  const findings:ScannedFinding[]=[];const diagnostics:{source:string;articles:number;matches:number;error?:string}[]=[];
  for(const source of sources){let articleCount=0,start=findings.length;try{
    const home=await getHtml(source.url);const links=linksFromHtml(home,source.url,source.articlePath);const targets=links.length?links:[source.url];
    for(const url of targets){articleCount++;let html:string;try{html=url===source.url?home:await getHtml(url)}catch{continue}const text=textFromHtml(html);const lower=norm(text);
      if(!/(skad|syk|karantene|suspend|ute|mangler|tilbake|comeback|usikker|tropp)/.test(lower))continue;
      for(const p of players){const name=norm(p.name);const hit=lower.search(new RegExp(`(^|[^\\p{L}])${escapeRe(name)}([^\\p{L}]|$)`,"u"));if(hit<0)continue;const a=Math.max(0,hit-220),b=Math.min(lower.length,hit+name.length+260);const snippet=text.slice(a,b).replace(/\s+/g," ").trim();const status=classify(snippet);if(!status)continue;const rawTeam=source.teamHint||p.team||null;const match=matchAvailabilityFinding(p.name,rawTeam,players);findings.push({sourceKind:source.kind,sourceLabel:source.label,sourceUrl:url,rawPlayerName:p.name,rawTeam,rawStatus:status,rawNote:snippet.slice(0,700),proposedPlayerId:match.proposedPlayerId,matchMethod:match.matchMethod,matchConfidence:match.matchConfidence,matchReason:`Automatisk kildefunn. ${match.matchReason}`,reviewStatus:match.reviewStatus});}
    }
    diagnostics.push({source:source.label,articles:articleCount,matches:findings.length-start});
  }catch(e:any){diagnostics.push({source:source.label,articles:articleCount,matches:findings.length-start,error:e?.message||"ukjent feil"})}}
  return{findings,diagnostics};
}
