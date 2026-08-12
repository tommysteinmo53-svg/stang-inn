"use client";
import {useState} from "react";
import {getSupabaseBrowserClient} from "../../../../lib/supabase";
import {HISTORICAL_PRICES_2024} from "../../../../lib/fantasy/historical-prices-2024";
import {HISTORICAL_GOALIE_PRICES_2024} from "../../../../lib/fantasy/historical-goalie-prices-2024";
import {HISTORICAL_PRICES_2025} from "../../../../lib/fantasy/historical-prices-2025";
import {importHistoryFor,leagueStrength} from "../../../../lib/fantasy/import-history-2026";
import {calibrateMarket,clamp,half,repricingScore,TEAM_BUDGET_M} from "../../../../lib/fantasy/market-calibration";
import "../../fantasy.css";

const S24="2024/25",S25="2025/26",POS=["C","W","D","G"];
const norm=(v:any)=>String(v??"").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ø/g,"o").replace(/æ/g,"ae").replace(/[^a-z0-9]+/g," ").trim();
const natural=(s:string)=>{const[last,...r]=String(s||"").split(",");return r.length?`${r.join(",").trim()} ${last.trim()}`:String(s||"")};
const arr=(s:string)=>norm(s).split(" ").filter(Boolean).filter(x=>x!=="jr"&&x!=="junior"),tok=(s:string)=>new Set(arr(s));
function siblingGuard(a:string,b:string){const A=arr(a),B=arr(natural(b));return A.length>=3&&B.length>=3&&A[A.length-1]===B[B.length-1]&&A[A.length-2]===B[B.length-2]&&A[0]!==B[0]}
function score(a:string,b:string){if(norm(a)===norm(natural(b)))return 1000;if(siblingGuard(a,b))return 0;const A=tok(a),B=tok(natural(b));let c=0;for(const x of A)if(B.has(x))c++;const mn=Math.min(A.size,B.size),mx=Math.max(A.size,B.size);if(c===mn&&mn>=2)return 800+c*10-mn*Math.abs(mx-mn);return c>=2?c*100-Math.abs(A.size-B.size)*10:0}
function match(name:string,src:any[],used?:Set<number>){let bi=-1,bs=0;for(let i=0;i<src.length;i++){if(used?.has(i))continue;const s=score(name,src[i][0]);if(s>bs){bs=s;bi=i}}return bi>=0&&bs>=200?{i:bi,row:src[bi],score:bs}:null}
function bestPlayerMatch(name:string,src:any[]){let best:any=null,bs=0;for(const x of src){const sc=score(name,x.name);if(sc>bs){bs=sc;best=x}}return bs>=800?best:null}
function solve(A:number[][],b:number[]){const n=b.length,m=A.map((r,i)=>[...r,b[i]]);for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[p][i]))p=j;[m[i],m[p]]=[m[p],m[i]];const d=m[i][i]||1e-9;for(let k=i;k<=n;k++)m[i][k]/=d;for(let j=0;j<n;j++)if(j!==i){const f=m[j][i];for(let k=i;k<=n;k++)m[j][k]-=f*m[i][k]}}return m.map(r=>r[n])}
const feat=(r:any)=>[1,r.oldPrice/1e6,Number(r.ppg||0),Math.min(1,Number(r.games||0)/45),(r.oldPrice/1e6)*Math.min(1,Number(r.games||0)/45)];
const featStats=(r:any)=>[1,Number(r.ppg||0),Math.min(1,Number(r.games||0)/45),Number(r.ppg||0)*Math.min(1,Number(r.games||0)/45)];
function fit(rs:any[]){const n=5,A=Array.from({length:n},()=>Array(n).fill(0)),b=Array(n).fill(0);for(const r of rs){const x=feat(r),y=r.newPrice/1e6;for(let j=0;j<n;j++){b[j]+=x[j]*y;for(let k=0;k<n;k++)A[j][k]+=x[j]*x[k]}}for(let i=0;i<n;i++)A[i][i]+=0.4;return solve(A,b)}
function fitStats(rs:any[]){const n=4,A=Array.from({length:n},()=>Array(n).fill(0)),b=Array(n).fill(0);for(const r of rs){const x=featStats(r),y=r.newPrice/1e6;for(let j=0;j<n;j++){b[j]+=x[j]*y;for(let k=0;k<n;k++)A[j][k]+=x[j]*x[k]}}for(let i=0;i<n;i++)A[i][i]+=0.7;return solve(A,b)}
const predict=(c:number[],r:any)=>clamp(feat(r).reduce((s,v,i)=>s+v*c[i],0),1,20);
const predictStats=(c:number[],r:any)=>clamp(featStats(r).reduce((s,v,i)=>s+v*c[i],0),1,20);
const statsWeight=(games:any)=>clamp(Number(games||0)/35,0.15,0.9);
const importBounds:any={D:[3,14],W:[4,18],C:[5,18],G:[5,17]};
function importEstimate(history:any,pos:string,anchor:number){
 const strength=leagueStrength(history.league);if(strength==null)return null;
 if(history.kind==="goalie"){
  if(pos!=="G"||history.games<10||!Number.isFinite(history.savePct)||!Number.isFinite(history.gaa))return null;
  const w=clamp(history.games/35,0.25,0.85),saveAdj=(history.savePct-0.905)*100*0.42,gaaAdj=-(history.gaa-2.6)*0.35;
  const raw=clamp(anchor+(saveAdj+gaaAdj)*strength*w,importBounds.G[0],importBounds.G[1]);
  const confidence=history.games>=30&&strength>=0.9?"Høy":history.games>=15?"Middels":"Lav";
  return{raw,weight:w,strength,confidence,metric:`${(history.savePct*100).toFixed(1)} SV% · ${history.gaa.toFixed(2)} GAA`};
 }
 if(pos==="G"||history.games<15)return null;
 const ppg=history.points/history.games,expected=pos==="D"?0.28:0.55,scale=pos==="D"?7:8,w=clamp(history.games/40,0.30,0.90),bounds=importBounds[pos]||[3,18];
 const raw=clamp(anchor+(ppg-expected)*scale*strength*w,bounds[0],bounds[1]);
 const confidence=history.games>=40&&strength>=0.9?"Høy":history.games>=25?"Middels":"Lav";
 return{raw,weight:w,strength,confidence,metric:`${ppg.toFixed(2)} P/GP`};
}
async function auth(){const s=getSupabaseBrowserClient(),{data}=await s!.auth.getSession();if(!data.session?.access_token)throw new Error("Logg inn som admin");return data.session.access_token}
function median(values:number[]){const a=[...values].filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 5;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function canonTeam(v:any){const s=norm(v);if(s.includes("storhamar"))return"Storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"Stavanger";if(s.includes("valerenga"))return"Vålerenga";if(s.includes("frisk"))return"Frisk Asker";if(s.includes("sparta"))return"Sparta";if(s.includes("narvik"))return"Narvik";if(s.includes("stjernen"))return"Stjernen";if(s.includes("lillehammer"))return"Lillehammer";if(s.includes("ringerike"))return"Ringerike";if(s.includes("nidaros"))return"Nidaros";return String(v||"").trim()}
function sourceLabel(v:any){const s=String(v||"").toLowerCase();if(s==="eliteprospects")return"EliteProspects";if(s==="manual")return"Manuell";return"HockeyLive"}

export default function Page(){
 const[busy,setBusy]=useState(false),[msg,setMsg]=useState("Klar"),[rows,setRows]=useState<any[]>([]),[stats,setStats]=useState<any>(null);
 async function run(){setBusy(true);try{
  const t=await auth();
  const [a,b,rr]=await Promise.all([
   fetch(`/api/fantasy-player-form?season=${encodeURIComponent(S24)}`,{headers:{Authorization:`Bearer ${t}`}}),
   fetch(`/api/fantasy-player-form?season=${encodeURIComponent(S25)}`,{headers:{Authorization:`Bearer ${t}`}}),
   fetch('/api/fantasy-roster-enriched-2026',{cache:'no-store'})
  ]),p24=await a.json(),p25=await b.json(),roster=await rr.json();
  if(!a.ok||!p24.ok)throw new Error(p24.error||"Kunne ikke hente 2024/25");
  if(!b.ok||!p25.ok)throw new Error(p25.error||"Kunne ikke hente 2025/26");
  if(!rr.ok||!roster.ok||!roster.rows?.length)throw new Error(roster.error||"Kunne ikke hente renset 2026/27-roster");

  const oldPlayers=p24.result?.rows||[],curPlayers=p25.result?.rows||[];
  const oldSk=HISTORICAL_PRICES_2024.filter(x=>x[1]!=null),oldG=HISTORICAL_GOALIE_PRICES_2024.filter(x=>x[1]!=null),p25src=HISTORICAL_PRICES_2025.filter(x=>x[2]>0);
  const uS=new Set<number>(),uG=new Set<number>(),uN=new Set<number>(),train:any[]=[];
  for(const pl of oldPlayers){const G=String(pl.position).toUpperCase()==="G",mo=match(pl.name,(G?oldG:oldSk) as any[],G?uG:uS),mn=match(pl.name,p25src as any[],uN);if(mo&&mn){(G?uG:uS).add(mo.i);uN.add(mn.i);train.push({...pl,oldPrice:mo.row[1],newPrice:mn.row[2]})}}
  const coef:any={},coefStats:any={};for(const z of POS){const sample=train.filter(x=>String(x.position).toUpperCase()===z&&x.games>=3);if(sample.length>=5){coef[z]=fit(sample);coefStats[z]=fitStats(sample)}}

  const statMap=new Map<string,any>();for(const x of curPlayers)statMap.set(norm(x.name),x);
  const oldStatMap=new Map<string,any>();for(const x of oldPlayers)oldStatMap.set(norm(x.name),x);
  const priceMap=new Map<string,any>();for(const x of p25src)priceMap.set(norm(natural(x[0])),x);
  const priceByPos:any={C:[],W:[],D:[],G:[]};
  for(const pl of curPlayers){const pos=String(pl.position||"").toUpperCase();if(!priceByPos[pos])continue;const pr=match(pl.name,p25src as any[]);if(pr)priceByPos[pos].push(Number(pr.row[2])/1e6)}
  const allMedian=median(p25src.map(x=>Number(x[2])/1e6));
  const posMedian:any={C:median(priceByPos.C),W:median(priceByPos.W),D:median(priceByPos.D),G:median(priceByPos.G)};

  const raw:any[]=[];
  for(const r of roster.rows){
   const name=String(r.name),team=canonTeam(r.team);let s=statMap.get(norm(name));
   if(!s)s=bestPlayerMatch(name,curPlayers);
   let historical:any=null;if(!s)historical=oldStatMap.get(norm(name))||bestPlayerMatch(name,oldPlayers);
   let pr=priceMap.get(norm(name));if(!pr){const m=match(name,p25src as any[]);if(m&&m.score>=800)pr=m.row}
   const pos=String(r.position||s?.position||historical?.position||"").toUpperCase(),validPos=POS.includes(pos)?pos:"";
   let old=pr?Number(pr[2])/1e6:null,statSeason:any=s?S25:(historical?S24:null),statRow:any=s||historical;
   let rawEst:number,pricingClass:string,confidence:string,reason:string,rs=0,previousTeam:string|null=null,previousLeague:string|null=null,leagueCoefficient:number|null=null,importWeight:number|null=null,importMetric:string|null=null;
   if(s&&old!=null&&validPos&&coef[validPos]){
    const base=predict(coef[validPos],{...s,oldPrice:old*1e6});rs=repricingScore({...s,old,position:validPos});const blend=0.35+0.65*(rs/100);rawEst=clamp(old+(base-old)*blend,1,20);pricingClass="Modell";confidence="Høy";reason="2025/26-statistikk + 2025/26-pris";
   }else if(s&&old==null&&validPos&&coefStats[validPos]&&Number(s.games||0)>=3){
    const anchor:number=Number(posMedian[validPos]);const modelOnly=predictStats(coefStats[validPos],s),w=statsWeight(s.games);old=anchor;rawEst=clamp(anchor+(modelOnly-anchor)*w,1,20);pricingClass="Statsmodell";confidence=Number(s.games||0)>=15?"Middels":"Lav";reason=`2025/26-statistikk uten historisk fantasypris · ${Math.round(w*100)}% modellvekt`;
   }else if(historical&&old==null&&validPos&&coefStats[validPos]&&Number(historical.games||0)>=3){
    const anchor:number=Number(posMedian[validPos]);const modelOnly=predictStats(coefStats[validPos],historical),w=statsWeight(historical.games)*0.75;old=anchor;rawEst=clamp(anchor+(modelOnly-anchor)*w,1,20);pricingClass="Historikkmodell";confidence=Number(historical.games||0)>=20?"Middels":"Lav";reason=`2024/25-statistikk · returspiller · ${Math.round(w*100)}% modellvekt`;
   }else if(old!=null){rawEst=old;pricingClass="Videreført";confidence=s?"Middels":"Lav";reason=s?"Historisk pris, men utilstrekkelig modellgrunnlag":"Historisk pris uten validert 2025/26-statistikk";
   }else{
    const anchor:number=Number(validPos?posMedian[validPos]:allMedian),ih=validPos?importHistoryFor(name):null,ie=ih?importEstimate(ih,validPos,anchor):null;
    old=anchor;
    if(ih&&ie){
      rawEst=ie.raw;pricingClass="Importmodell";confidence=ie.confidence;statSeason=ih.season;statRow=null;previousTeam=ih.previousTeam;previousLeague=ih.league;leagueCoefficient=ie.strength;importWeight=ie.weight;importMetric=ie.metric;
      reason=`${ih.season} ${ih.league} · ${ih.games} GP · ${ie.metric} · importmodell · ${Math.round(ie.weight*100)}% modellvekt`;
    }else{
      rawEst=anchor;pricingClass="Provisorisk";confidence="Lav";reason=validPos?(ih?"Importdata finnes, men utilstrekkelig/ugyldig grunnlag":"Ingen verifisert ekstern seniorstatistikk · posisjonsmedian"):"Ny spiller · mangler posisjon, markedsmedian";
    }
   }
   raw.push({id:r.personId||`${team}-${name}`,name,team,position:validPos||"—",positionSource:r.positionSource||"HockeyLive",games:statRow?.games??(pricingClass==="Importmodell"?importHistoryFor(name)?.games:null),ppg:statRow?.ppg??null,statSeason,old,rawEst,repricingScore:rs,pricingClass,confidence,reason,hasStats:Boolean(statRow),hasOldPrice:Boolean(pr),previousTeam,previousLeague,leagueCoefficient,importWeight,importMetric});
  }
  const cal=calibrateMarket(raw as any[]),out=cal.rows.map((x:any)=>({...x,delta:half(x.est-x.old)})).sort((x:any,y:any)=>x.team.localeCompare(y.team,'nb')||x.name.localeCompare(y.name,'nb'));
  const provisional=out.filter((x:any)=>x.pricingClass==="Provisorisk").length,missingPos=out.filter((x:any)=>x.position==="—").length,modelled=out.filter((x:any)=>x.pricingClass==="Modell").length,statsModelled=out.filter((x:any)=>x.pricingClass==="Statsmodell").length,historicalModelled=out.filter((x:any)=>x.pricingClass==="Historikkmodell").length,importModelled=out.filter((x:any)=>x.pricingClass==="Importmodell").length,carried=out.filter((x:any)=>x.pricingClass==="Videreført").length,epEnriched=out.filter((x:any)=>x.positionSource==="eliteprospects").length,manualEnriched=out.filter((x:any)=>x.positionSource==="manual").length;
  setRows(out);setStats({...cal.stats,n:out.length,modelled,statsModelled,historicalModelled,importModelled,carried,provisional,missingPos,epEnriched,manualEnriched});
  setMsg(`Ferdig · ${out.length} spillere · ${modelled} full modell · ${statsModelled} statsmodell · ${historicalModelled} historikkmodell · ${importModelled} importmodell · ${provisional} provisoriske`)
 }catch(e:any){setMsg(e.message||"Feil")}finally{setBusy(false)}}
 const imports=rows.filter((x:any)=>x.pricingClass==="Importmodell"),provisionalRows=rows.filter((x:any)=>x.pricingClass==="Provisorisk");
 return <main className="fantasy-shell"><section className="fantasy-hero"><div><p className="fantasy-kicker">STANG INN · PRISMODELL V4.2</p><h1>Importjustert 2026/27-pris</h1><p className="fantasy-lead">V4.1-baselinen beholdes. V4.2 oppgraderer bare provisoriske spillere med verifisert ekstern 2025/26-seniorstatistikk.</p></div><a className="pill" href="/fantasy/diagnose/price-model-v4-1">← V4.1 baseline</a></section><section className="fantasy-card"><button disabled={busy} onClick={run}>{busy?"Beregner …":"Generer v4.2-priser for 2026/27-roster"}</button> <span>{msg}</span>{stats&&<><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:10,margin:"18px 0"}}>{[["Spillere",stats.n],["Full modell",stats.modelled],["Statsmodell",stats.statsModelled],["Historikkmodell",stats.historicalModelled],["Importmodell",stats.importModelled],["Videreført",stats.carried],["Provisorisk",stats.provisional],["Mangler posisjon",stats.missingPos],["Rått snitt",`${stats.rawAvg.toFixed(2)}m`],["Kalibrert snitt",`${stats.calibratedAvg.toFixed(2)}m`],["Markedsskala",`${(stats.scale*100).toFixed(1)}%`],["Lagbudsjett",`${TEAM_BUDGET_M}m`]].map(([a,b]:any)=><div key={a} style={{padding:14,borderRadius:12,background:'#f5f7fa'}}><b>{a}</b><div style={{fontSize:24,fontWeight:900}}>{b}</div></div>)}</div><div style={{padding:12,borderRadius:12,background:'#fff4df',border:'1px solid #e6c989',marginBottom:18}}><b>Importmodell:</b> posisjonsmedian er prior. Ekstern produksjon flytter prisen konservativt etter ligastyrke og kampmengde. Goalies har egen SV%/GAA-modell. Ingen runtime-scraping og ingen pris på rykte alene.</div><div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:1700,borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Spiller','Pos','Pos-kilde','26/27 lag','Stat-sesong','K','FP/K','Prisanker','Råmodell','V4.2 pris','Endring','Klasse','Tillit','Grunnlag'].map(h=><th key={h} style={{padding:8,textAlign:'left',background:'#eef3f8'}}>{h}</th>)}</tr></thead><tbody>{rows.map((x:any)=><tr key={x.id}><td style={{padding:8,fontWeight:700}}>{x.name}</td><td>{x.position}</td><td>{sourceLabel(x.positionSource)}</td><td>{x.team}</td><td>{x.statSeason??'—'}</td><td>{x.games??'—'}</td><td>{x.ppg??'—'}</td><td>{x.old.toFixed(1)}m</td><td>{x.rawEst.toFixed(2)}m</td><td style={{fontWeight:900}}>{x.est.toFixed(1)}m</td><td>{x.delta>0?'+':''}{x.delta.toFixed(1)}m</td><td>{x.pricingClass}</td><td>{x.confidence}</td><td>{x.reason}</td></tr>)}</tbody></table></div><h2 style={{marginTop:28}}>Importmodell</h2><div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:1250,borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Spiller','Pos','26/27 lag','Tidligere lag','Liga','Sesong','GP','Metrikk','Ligakoeff.','Modellvekt','Råpris','Sluttpris','Tillit'].map(h=><th key={h} style={{padding:8,textAlign:'left',background:'#eef3f8'}}>{h}</th>)}</tr></thead><tbody>{imports.map((x:any)=><tr key={x.id}><td>{x.name}</td><td>{x.position}</td><td>{x.team}</td><td>{x.previousTeam}</td><td>{x.previousLeague}</td><td>{x.statSeason}</td><td>{x.games}</td><td>{x.importMetric}</td><td>{x.leagueCoefficient?.toFixed(2)}</td><td>{Math.round((x.importWeight||0)*100)}%</td><td>{x.rawEst.toFixed(2)}m</td><td><b>{x.est.toFixed(1)}m</b></td><td>{x.confidence}</td></tr>)}</tbody></table></div><h2 style={{marginTop:28}}>Fortsatt provisoriske</h2><div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:900,borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Spiller','Pos','26/27 lag','Pris','Årsak'].map(h=><th key={h} style={{padding:8,textAlign:'left',background:'#eef3f8'}}>{h}</th>)}</tr></thead><tbody>{provisionalRows.map((x:any)=><tr key={x.id}><td>{x.name}</td><td>{x.position}</td><td>{x.team}</td><td>{x.est.toFixed(1)}m</td><td>{x.reason}</td></tr>)}</tbody></table></div></>}</section></main>}
