"use client";

import {useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../lib/supabase";
import {HISTORICAL_PRICES_2024} from "../../../../lib/fantasy/historical-prices-2024";
import {HISTORICAL_GOALIE_PRICES_2024} from "../../../../lib/fantasy/historical-goalie-prices-2024";
import {HISTORICAL_PRICES_2025} from "../../../../lib/fantasy/historical-prices-2025";
import {importHistoryFor} from "../../../../lib/fantasy/import-history-2026";
import {returnHistoryFor} from "../../../../lib/fantasy/return-history-2026";
import {importEstimateV43,talentEstimateV43,TALENT_HISTORY_2026_V43,type TalentHistoryV43,type V43Position} from "../../../../lib/fantasy/import-pricing-v4-3";
import {calibrateMarket,clamp,repricingScore} from "../../../../lib/fantasy/market-calibration";
import "../../fantasy.css";

const S24="2024/25",S25="2025/26",POS=["C","W","D","G"] as const;
const EXTRA_TALENTS:TalentHistoryV43[]=[{name:"Markus Walberg",position:"G",league:"Norway U20",games:33,savePct:0.916,gaa:3.0,sourceNote:"Sparta U20 2025/26; promoted to A-team goalie duo."}];
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
const predict=(c:number[],r:any)=>clamp(feat(r).reduce((s,v,i)=>s+v*c[i],0),1,20),predictStats=(c:number[],r:any)=>clamp(featStats(r).reduce((s,v,i)=>s+v*c[i],0),1,20),statsWeight=(g:any)=>clamp(Number(g||0)/35,0.15,0.9);
function median(v:number[]){const a=[...v].filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 5;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function canonTeam(v:any){const s=norm(v);if(s.includes("storhamar"))return"Storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"Stavanger";if(s.includes("valerenga"))return"Vålerenga";if(s.includes("frisk"))return"Frisk Asker";if(s.includes("sparta"))return"Sparta";if(s.includes("narvik"))return"Narvik";if(s.includes("stjernen"))return"Stjernen";if(s.includes("lillehammer"))return"Lillehammer";if(s.includes("ringerike"))return"Ringerike";if(s.includes("nidaros"))return"Nidaros";return String(v||"").trim()}
async function auth(){const s=getSupabaseBrowserClient(),{data}=await s!.auth.getSession();if(!data.session?.access_token)throw new Error("Logg inn som admin");return data.session.access_token}

type P={name:string;team:string;pos:V43Position;price:number;raw:number;cls:string;ppg:number;games:number;value:number};
function projection(r:any){const ppg=Number(r.ppg||0);if(ppg>0)return ppg;const price=Number(r.est||r.price||0);return Math.max(0.25,price*0.72)}
type TeamState={score:number;cost:number;players:P[];c:number;w:number;d:number;g:number};
function buildTeam(rows:P[],budget:number,req:Record<V43Position,number>){
 const maxCost=Math.round(budget*2);
 let states=new Map<string,TeamState>();
 states.set("0-0-0-0-0",{score:0,cost:0,players:[],c:0,w:0,d:0,g:0});
 for(const p of rows){
  const current=[...states.values()];
  for(const st of current){
   const counts={C:st.c,W:st.w,D:st.d,G:st.g};
   if(counts[p.pos]>=req[p.pos])continue;
   const nc=st.cost+Math.round(p.price*2);if(nc>maxCost)continue;
   const nextCounts={...counts,[p.pos]:counts[p.pos]+1};
   const key=`${nextCounts.C}-${nextCounts.W}-${nextCounts.D}-${nextCounts.G}-${nc}`;
   const ns:TeamState={score:st.score+p.value,cost:nc,players:[...st.players,p],c:nextCounts.C,w:nextCounts.W,d:nextCounts.D,g:nextCounts.G};
   const old=states.get(key);if(!old||ns.score>old.score)states.set(key,ns);
  }
 }
 let best:TeamState|null=null;
 for(const st of states.values())if(st.c===req.C&&st.w===req.W&&st.d===req.D&&st.g===req.G&&(!best||st.score>best.score))best=st;
 if(!best)return null;
 const parts=best.players;
 return{players:parts,cost:best.cost/2,score:best.score,premium:parts.filter(p=>p.price>=12).length,cheap:parts.filter(p=>p.price<=5).length,stars:parts.filter(p=>p.price>=14.5).length};
}

export default function Page(){
 const[busy,setBusy]=useState(false),[msg,setMsg]=useState("Klar for V4.4 økonomistresstest"),[rows,setRows]=useState<P[]>([]),[req,setReq]=useState<Record<V43Position,number>>({C:2,W:4,D:4,G:2});
 async function run(){setBusy(true);try{const t=await auth();const[a,b,rr]=await Promise.all([fetch(`/api/fantasy-player-form?season=${encodeURIComponent(S24)}`,{headers:{Authorization:`Bearer ${t}`}}),fetch(`/api/fantasy-player-form?season=${encodeURIComponent(S25)}`,{headers:{Authorization:`Bearer ${t}`}}),fetch('/api/fantasy-roster-enriched-2026',{cache:'no-store'})]);const p24=await a.json(),p25=await b.json(),roster=await rr.json();if(!a.ok||!p24.ok||!b.ok||!p25.ok||!rr.ok||!roster.ok)throw new Error("Kunne ikke hente markedsdata");
 const oldPlayers=p24.result?.rows||[],curPlayers=p25.result?.rows||[],oldSk=HISTORICAL_PRICES_2024.filter(x=>x[1]!=null),oldG=HISTORICAL_GOALIE_PRICES_2024.filter(x=>x[1]!=null),p25src=HISTORICAL_PRICES_2025.filter(x=>x[2]>0),uS=new Set<number>(),uG=new Set<number>(),uN=new Set<number>(),train:any[]=[];for(const pl of oldPlayers){const G=String(pl.position).toUpperCase()==="G",mo=match(pl.name,(G?oldG:oldSk) as any[],G?uG:uS),mn=match(pl.name,p25src as any[],uN);if(mo&&mn){(G?uG:uS).add(mo.i);uN.add(mn.i);train.push({...pl,oldPrice:mo.row[1],newPrice:mn.row[2]})}}
 const coef:any={},coefStats:any={};for(const z of POS){const sm=train.filter(x=>String(x.position).toUpperCase()===z&&x.games>=3);if(sm.length>=5){coef[z]=fit(sm);coefStats[z]=fitStats(sm)}}const statMap=new Map<string,any>();for(const x of curPlayers)statMap.set(norm(x.name),x);const oldStatMap=new Map<string,any>();for(const x of oldPlayers)oldStatMap.set(norm(x.name),x);const priceMap=new Map<string,any>();for(const x of p25src)priceMap.set(norm(natural(x[0])),x);const priceByPos:any={C:[],W:[],D:[],G:[]};for(const pl of curPlayers){const pos=String(pl.position||"").toUpperCase();if(!priceByPos[pos])continue;const pr=match(pl.name,p25src as any[]);if(pr)priceByPos[pos].push(Number(pr.row[2])/1e6)}const allMedian=median(p25src.map(x=>Number(x[2])/1e6)),posMedian:any={C:median(priceByPos.C),W:median(priceByPos.W),D:median(priceByPos.D),G:median(priceByPos.G)},talents=new Map([...TALENT_HISTORY_2026_V43,...EXTRA_TALENTS].map(x=>[norm(x.name),x])),raw:any[]=[];
 for(const r of roster.rows){const name=String(r.name),team=canonTeam(r.team);let s=statMap.get(norm(name))||bestPlayerMatch(name,curPlayers),hist:any=null;if(!s)hist=oldStatMap.get(norm(name))||bestPlayerMatch(name,oldPlayers);let pr=priceMap.get(norm(name));if(!pr){const m=match(name,p25src as any[]);if(m&&m.score>=800)pr=m.row}const pos=String(r.position||s?.position||hist?.position||"").toUpperCase() as V43Position;if(!(POS as readonly string[]).includes(pos))continue;let old=pr?Number(pr[2])/1e6:null,rawEst=0,cls="Provisorisk",ppg=Number(s?.ppg||hist?.ppg||0),games=Number(s?.games||hist?.games||0);
 if(s&&old!=null&&coef[pos]){const base=predict(coef[pos],{...s,oldPrice:old*1e6}),rs=repricingScore({...s,old,position:pos}),blend=0.35+0.65*(rs/100);rawEst=clamp(old+(base-old)*blend,1,20);cls="Modell"}else if(s&&old==null&&coefStats[pos]&&games>=3){const anchor=Number(posMedian[pos]),model=predictStats(coefStats[pos],s),w=statsWeight(games);old=anchor;rawEst=clamp(anchor+(model-anchor)*w,1,20);cls="Statsmodell"}else if(hist&&old==null&&coefStats[pos]&&games>=3){const anchor=Number(posMedian[pos]),model=predictStats(coefStats[pos],hist),w=statsWeight(games)*0.75;old=anchor;rawEst=clamp(anchor+(model-anchor)*w,1,20);cls="Historikkmodell"}else{const anchor=Number(posMedian[pos]||allMedian),ih=importHistoryFor(name),tal=talents.get(norm(name));if(ih){const est=importEstimateV43(ih,pos,team,name);old=anchor;rawEst=est?.raw??anchor;cls=est?.note??"Provisorisk";ppg=ih.kind==="skater"?ih.points/ih.games:0;games=ih.games}else if(tal){const est=talentEstimateV43(tal);old=anchor;rawEst=est.raw;cls="Talentmodell V4.3.3";ppg=Number(tal.points||0)/Math.max(1,tal.games);games=tal.games}else if(old!=null){rawEst=old;cls="Videreført"}else{const rh=returnHistoryFor(name);old=anchor;if(rh&&Number.isFinite(rh.seniorPoints)&&rh.seniorGames>=15){ppg=Number(rh.seniorPoints)/rh.seniorGames;games=rh.seniorGames;const expected=pos==="D"?0.28:0.55,scale=pos==="D"?7:8,w=clamp(rh.seniorGames/70,0.35,0.65);rawEst=clamp(anchor+(ppg-expected)*scale*w,1,20);cls="Historikkmodell"}else rawEst=anchor}}
 raw.push({name,team,pos,old:Number(old??allMedian),rawEst,cls,ppg,games});}
 const cal=calibrateMarket(raw).rows.map((r:any)=>({...r,price:r.est,value:projection(r)}));setRows(cal);setMsg(`Ferdig · ${cal.length} spillere · ${Object.values(req).reduce((a,b)=>a+b,0)} plasser i laget`);}catch(e:any){setMsg(`Feil: ${e.message||e}`)}finally{setBusy(false)}}
 const budgets=[60,70,80,90,100],tests=useMemo(()=>budgets.map(b=>({budget:b,result:buildTeam(rows,b,req)})),[rows,req]);const totalSlots=Object.values(req).reduce((a,b)=>a+b,0);
 return <main className="fantasy-page"><section className="fantasy-card"><h1>V4.4 · Fantasy Economy Stress Test</h1><p>Stresstester V4.3.3-prisene ved å bygge høyest mulig forventet produksjon innen ulike budsjetter. Standardoppsett er 12 spillere: 2 C, 4 W, 4 D og 2 G. Du kan endre posisjonskravene før testen.</p><div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{POS.map(p=><label key={p}>{p}: <input type="number" min={0} max={10} value={req[p]} onChange={e=>setReq({...req,[p]:Number(e.target.value)})} style={{width:60}}/></label>)}</div><p>Lagstørrelse: <strong>{totalSlots}</strong></p><button onClick={run} disabled={busy}>{busy?"Tester…":"Kjør V4.4-stresstest"}</button><p><strong>{msg}</strong></p></section>{rows.length>0&&<><section className="fantasy-card"><h2>Budsjettstresstest</h2><table><thead><tr><th>Budsjett</th><th>Lagpris</th><th>Premium ≥12m</th><th>Stjerner ≥14.5m</th><th>Billige ≤5m</th><th>Resultat</th></tr></thead><tbody>{tests.map(t=><tr key={t.budget}><td>{t.budget}m</td><td>{t.result?`${t.result.cost.toFixed(1)}m`:"—"}</td><td>{t.result?.premium??"—"}</td><td>{t.result?.stars??"—"}</td><td>{t.result?.cheap??"—"}</td><td>{t.result?"Mulig":"Ingen gyldig kombinasjon"}</td></tr>)}</tbody></table></section>{tests.map(t=>t.result&&<section className="fantasy-card" key={`team-${t.budget}`}><h2>Beste lag · {t.budget}m</h2><p>Totalpris <strong>{t.result.cost.toFixed(1)}m</strong> · premium {t.result.premium} · stjerner {t.result.stars} · ≤5m {t.result.cheap} · produksjonssignal {t.result.score.toFixed(2)}</p><table><thead><tr><th>Spiller</th><th>Lag</th><th>Pos</th><th>Pris</th><th>Klasse</th><th>Produksjonssignal</th></tr></thead><tbody>{[...t.result.players].sort((a:P,b:P)=>a.pos.localeCompare(b.pos)||b.price-a.price).map((p:P)=><tr key={`${t.budget}-${p.name}`}><td>{p.name}</td><td>{p.team}</td><td>{p.pos}</td><td><strong>{p.price.toFixed(1)}m</strong></td><td>{p.cls}</td><td>{p.value.toFixed(2)}</td></tr>)}</tbody></table></section>)}</>}</main>;
}
