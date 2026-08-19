import {matchAvailabilityFinding} from "./availability-match";
import {parseNittenAvailabilityArticle} from "./availability-nitten-parser";

export type AvailabilitySource={kind:"club"|"nitten"|"local_media";label:string;url:string;teamHint?:string;articlePath?:RegExp};
export type RosterPlayer={id:string;name:string;team:string};
export type ScannedFinding={sourceKind:"club"|"nitten"|"local_media";sourceLabel:string;sourceUrl:string;sourcePublishedAt:string;rawPlayerName:string;rawTeam:string|null;rawStatus:"questionable"|"out"|"long_term"|"returning"|"not_in_lineup";rawNote:string;proposedPlayerId:string|null;matchMethod:string|null;matchConfidence:number|null;matchReason:string;reviewStatus:"pending"|"needs_review"};

export const AVAILABILITY_SOURCES:AvailabilitySource[]=[
 {kind:"nitten",label:"nitten.no",url:"https://www.nitten.no/",articlePath:/^\/blogg\//},
 {kind:"club",label:"Frisk Asker",url:"https://www.friskaskerhockey.no/",teamHint:"Frisk Asker"},
 {kind:"club",label:"Lillehammer IK",url:"https://www.lillehammerhockey.no/",teamHint:"Lillehammer IK"},
 {kind:"club",label:"Narvik Hockey",url:"https://www.narvikhockey.no/",teamHint:"Narvik"},
 {kind:"club",label:"Nidaros Hockey",url:"https://www.nidaroshockey.no/",teamHint:"Nidaros"},
 {kind:"club",label:"Ringerike Panthers",url:"https://elite.ringerikepanthers.no/",teamHint:"Ringerike Panthers"},
 {kind:"club",label:"Sparta Sarpsborg",url:"https://www.sparta.no/",teamHint:"Sparta Sarpsborg"},
 {kind:"club",label:"Stavanger Oilers",url:"https://www.oilers.no/",teamHint:"Stavanger Oilers"},
 {kind:"club",label:"Stjernen Hockey",url:"https://www.stjernen.no/",teamHint:"Stjernen Hockey"},
 {kind:"club",label:"Storhamar Hockey",url:"https://www.sil.no/",teamHint:"Storhamar Ishockey"},
 {kind:"club",label:"Vålerenga Ishockey",url:"https://www.vif-hockey.no/",teamHint:"Vålerenga Ishockey"},
 {kind:"local_media",label:"Budstikka · Frisk Asker",url:"https://www.budstikka.no/",teamHint:"Frisk Asker"},
 {kind:"local_media",label:"Gudbrandsdølen Dagningen · Lillehammer",url:"https://www.gd.no/",teamHint:"Lillehammer IK"},
 {kind:"local_media",label:"Fremover · Narvik",url:"https://www.fremover.no/",teamHint:"Narvik"},
 {kind:"local_media",label:"Adresseavisen · Nidaros",url:"https://www.adressa.no/",teamHint:"Nidaros"},
 {kind:"local_media",label:"Ringerikes Blad · Panthers",url:"https://www.ringblad.no/",teamHint:"Ringerike Panthers"},
 {kind:"local_media",label:"Sarpsborg Arbeiderblad · Sparta",url:"https://www.sa.no/",teamHint:"Sparta Sarpsborg"},
 {kind:"local_media",label:"Stavanger Aftenblad · Oilers",url:"https://www.aftenbladet.no/tag/stavanger-oilers",teamHint:"Stavanger Oilers"},
 {kind:"local_media",label:"Fredriksstad Blad · Stjernen",url:"https://www.f-b.no/",teamHint:"Stjernen Hockey"},
 {kind:"local_media",label:"Hamar Arbeiderblad · Storhamar",url:"https://www.h-a.no/hockey/",teamHint:"Storhamar Ishockey"},
 {kind:"local_media",label:"Dagsavisen · Vålerenga",url:"https://www.dagsavisen.no/sport/ishockey/",teamHint:"Vålerenga Ishockey"},
];

const MAX_SOURCE_AGE_DAYS=45;
const MAX_FUTURE_SKEW_DAYS=2;
const decode=(s:string)=>s.replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&aring;/gi,"å").replace(/&oslash;/gi,"ø").replace(/&aelig;/gi,"æ").replace(/&Aring;/g,"Å").replace(/&Oslash;/g,"Ø").replace(/&AElig;/g,"Æ");
const textFromHtml=(html:string)=>decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim());
const norm=(s:string)=>s.toLocaleLowerCase("nb-NO").replace(/[‐‑–—]/g,"-").replace(/\s+/g," ").trim();
const escapeRe=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const MONTHS:Record<string,number>={januar:0,februar:1,mars:2,april:3,mai:4,juni:5,juli:6,august:7,september:8,oktober:9,november:10,desember:11};

function classify(snippet:string):ScannedFinding["rawStatus"]|null{const s=norm(snippet);if(/ikke i (kamp)?tropp|utenfor troppen|ikke med i troppen/.test(s))return"not_in_lineup";if(/langtidsskadd|langtidsskadet|mister resten av sesongen|ute resten av sesongen|ute i (flere )?(måneder|uker)/.test(s))return"long_term";if(/tilbake i trening|tilbake på is|tilbake på isen|gjør comeback|comeback|tilbake etter skade/.test(s))return"returning";if(/usikker|tvilsom|dag til dag|vurderes før kamp|uklart om .* klar/.test(s))return"questionable";if(/ute med skade|ute på grunn av skade|skadet|skadd|sykdom|syk|karantene|suspendert|soner|mangler(?: fortsatt)?|står over|ikke spilleklar/.test(s))return"out";return null}
function isoFromParts(year:number,month:number,day:number){const d=new Date(Date.UTC(year,month,day,12,0,0));if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month||d.getUTCDate()!==day)return null;return d.toISOString()}
function parsePublishedValue(value:string){const raw=decode(value).replace(/\\u002f/gi,"/").replace(/\\\//g,"/").replace(/\s+/g," ").trim();if(!raw)return null;const direct=new Date(raw);if(!Number.isNaN(direct.getTime()))return direct.toISOString();let m=raw.match(/(?:^|\D)(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:\D|$)/);if(m)return isoFromParts(Number(m[3]),Number(m[2])-1,Number(m[1]));m=norm(raw).match(/(?:^|\D)(\d{1,2})\.?\s+(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\s+(\d{4})(?:\D|$)/);if(m)return isoFromParts(Number(m[3]),MONTHS[m[2]],Number(m[1]));return null}
function visibleNittenPublishedAt(html:string){const text=textFromHtml(html);const m=text.match(/Skrevet av:\s*.*?\b(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})\b/i);if(!m)return null;return isoFromParts(Number(m[3]),Number(m[2])-1,Number(m[1]))}
function publishedAt(html:string,source?:AvailabilitySource){const candidates=[/<meta[^>]+(?:property|name|itemprop)=["'](?:article:published_time|og:published_time|datePublished|datepublished|date|publish-date|parsely-pub-date)["'][^>]+content=["']([^"']+)["']/i,/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["'](?:article:published_time|og:published_time|datePublished|datepublished|date|publish-date|parsely-pub-date)["']/i,/["']datePublished["']\s*:\s*["']([^"']+)["']/i,/<time[^>]+(?:datetime|content)=["']([^"']+)["']/i,/Publisert\s*:?[\s\u00a0]*(\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+\-Z]+)?)/i,/Publisert\s*:?[\s\u00a0]*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4})/i,/Publisert\s*:?[\s\u00a0]*(\d{1,2}\.?\s+(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\s+\d{4})/i];for(const re of candidates){const m=html.match(re);if(!m)continue;const iso=parsePublishedValue(m[1]);if(iso)return iso}if(source?.kind==="nitten")return visibleNittenPublishedAt(html);return null}
function isFresh(iso:string){const t=new Date(iso).getTime();if(Number.isNaN(t))return false;const age=Date.now()-t;return age>=-MAX_FUTURE_SKEW_DAYS*86400000&&age<=MAX_SOURCE_AGE_DAYS*86400000}
function linksFromHtml(html:string,base:string,articlePath?:RegExp){const origin=new URL(base).origin,out:string[]=[],seen=new Set<string>(),re=/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>/gi;let m:RegExpExecArray|null;while((m=re.exec(html))){try{const u=new URL(m[1],base);if(u.origin!==origin)continue;if(articlePath&&!articlePath.test(u.pathname))continue;if(!articlePath){if(u.pathname==="/"||u.pathname.length<8||/\.(jpg|jpeg|png|gif|svg|pdf|mp4)$/i.test(u.pathname))continue;if(/\/(kontakt|billetter|statistikk|kamper|lag|team|shop|webshop|personvern|cookie|sponsor|abonnement|kundeservice)/i.test(u.pathname))continue}u.hash="";const href=u.toString();if(!seen.has(href)){seen.add(href);out.push(href)}}catch{}}return out.slice(0,12)}
async function getHtml(url:string){const r=await fetch(url,{headers:{"User-Agent":"StangInnAvailabilityBot/1.4 (+admin-reviewed fantasy availability)",Accept:"text/html,application/xhtml+xml"},cache:"no-store",signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);if(!(r.headers.get("content-type")||"").includes("text/html"))throw new Error("ikke HTML");return await r.text()}

export async function scanAvailabilitySources(players:RosterPlayer[],sources=AVAILABILITY_SOURCES){const findings:ScannedFinding[]=[],diagnostics:{source:string;articles:number;matches:number;staleOrUndated:number;stale:number;undated:number;error?:string}[]=[];for(const source of sources){let articleCount=0,stale=0,undated=0;const start=findings.length;try{const home=await getHtml(source.url),links=linksFromHtml(home,source.url,source.articlePath),targets=links.length?links:[source.url];for(const url of targets){articleCount++;let html:string;try{html=url===source.url?home:await getHtml(url)}catch{continue}const published=publishedAt(html,source);if(!published){undated++;continue}if(!isFresh(published)){stale++;continue}const text=textFromHtml(html),lower=norm(text);if(!/(skad|syk|karantene|suspend|ute|mangler|tilbake|comeback|usikker|tropp)/.test(lower))continue;
   if(source.kind==="nitten"){
    const parsed=parseNittenAvailabilityArticle(text,players.map(p=>p.name));
    for(const f of parsed){const p=players.find(candidate=>norm(candidate.name)===norm(f.playerName));if(!p)continue;const rawTeam=p.team||null,match=matchAvailabilityFinding(p.name,rawTeam,players);findings.push({sourceKind:source.kind,sourceLabel:source.label,sourceUrl:url,sourcePublishedAt:published,rawPlayerName:p.name,rawTeam,rawStatus:f.status,rawNote:f.evidence.slice(0,700),proposedPlayerId:match.proposedPlayerId,matchMethod:match.matchMethod,matchConfidence:match.matchConfidence,matchReason:`Automatisk kildefunn fra golden-testet nitten.no-parser. ${match.matchReason}`,reviewStatus:match.reviewStatus})}
    continue;
   }
   for(const p of players){const name=norm(p.name),hit=lower.search(new RegExp(`(^|[^\\p{L}])${escapeRe(name)}([^\\p{L}]|$)`,"u"));if(hit<0)continue;const snippet=lower.slice(Math.max(0,hit-220),Math.min(lower.length,hit+name.length+260)).trim(),status=classify(snippet);if(!status)continue;const rawTeam=source.teamHint||p.team||null,match=matchAvailabilityFinding(p.name,rawTeam,players);findings.push({sourceKind:source.kind,sourceLabel:source.label,sourceUrl:url,sourcePublishedAt:published,rawPlayerName:p.name,rawTeam,rawStatus:status,rawNote:snippet.slice(0,700),proposedPlayerId:match.proposedPlayerId,matchMethod:match.matchMethod,matchConfidence:match.matchConfidence,matchReason:`Automatisk kildefunn fra fersk ${source.kind==="local_media"?"lokalavis":"kilde"}. ${match.matchReason}`,reviewStatus:match.reviewStatus})}}const staleOrUndated=stale+undated;diagnostics.push({source:source.label,articles:articleCount,matches:findings.length-start,staleOrUndated,stale,undated})}catch(e:any){const staleOrUndated=stale+undated;diagnostics.push({source:source.label,articles:articleCount,matches:findings.length-start,staleOrUndated,stale,undated,error:e?.message||"ukjent feil"})}}return{findings,diagnostics}}
