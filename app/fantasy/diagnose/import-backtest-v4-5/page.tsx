"use client";

import {useState} from "react";
import {getSupabaseBrowserClient} from "../../../../lib/supabase";
import {HISTORICAL_PRICES_2025} from "../../../../lib/fantasy/historical-prices-2025";
import "../../fantasy.css";

const S24="2024/25",S25="2025/26";
const norm=(v:any)=>String(v??"").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ø/g,"o").replace(/æ/g,"ae").replace(/[^a-z0-9]+/g," ").trim();
const natural=(s:string)=>{const[last,...r]=String(s||"").split(",");return r.length?`${r.join(",").trim()} ${last.trim()}`:String(s||"")};
const arr=(s:string)=>norm(s).split(" ").filter(Boolean).filter(x=>x!=="jr"&&x!=="junior"),tok=(s:string)=>new Set(arr(s));
function siblingGuard(a:string,b:string){const A=arr(a),B=arr(natural(b));return A.length>=3&&B.length>=3&&A[A.length-1]===B[B.length-1]&&A[A.length-2]===B[B.length-2]&&A[0]!==B[0]}
function score(a:string,b:string){if(norm(a)===norm(natural(b)))return 1000;if(siblingGuard(a,b))return 0;const A=tok(a),B=tok(natural(b));let c=0;for(const x of A)if(B.has(x))c++;const mn=Math.min(A.size,B.size),mx=Math.max(A.size,B.size);if(c===mn&&mn>=2)return 800+c*10-mn*Math.abs(mx-mn);return c>=2?c*100-Math.abs(A.size-B.size)*10:0}
function best(name:string,src:any[]){let row:any=null,bs=0;for(const x of src){const s=score(name,x.name??x[0]);if(s>bs){bs=s;row=x}}return bs>=800?row:null}
async function auth(){const s=getSupabaseBrowserClient(),{data}=await s!.auth.getSession();if(!data.session?.access_token)throw new Error("Logg inn som admin");return data.session.access_token}

type Row={name:string;team:string;pos:string;games:number;fpPerGame:number;startPrice:number|null;value:number|null;status:string};

export default function Page(){
 const[busy,setBusy]=useState(false),[msg,setMsg]=useState("Klar for historisk backtest"),[rows,setRows]=useState<Row[]>([]);
 async function run(){setBusy(true);try{
  const t=await auth();
  const[a,b]=await Promise.all([
   fetch(`/api/fantasy-player-form?season=${encodeURIComponent(S24)}`,{headers:{Authorization:`Bearer ${t}`}}),
   fetch(`/api/fantasy-player-form?season=${encodeURIComponent(S25)}`,{headers:{Authorization:`Bearer ${t}`}})
  ]);
  const p24=await a.json(),p25=await b.json();if(!a.ok||!p24.ok||!b.ok||!p25.ok)throw new Error("Kunne ikke hente historiske spillerdata");
  const old=p24.result?.rows||[],cur=p25.result?.rows||[];
  const out:Row[]=[];
  for(const p of cur){
   const games=Number(p.games||0);if(games<10)continue;
   const prev=best(String(p.name),old);if(prev&&Number(prev.games||0)>=3)continue;
   const pr=best(String(p.name),HISTORICAL_PRICES_2025 as any[]);
   const startPrice=pr?Number(pr[2])/1e6:null;
   const fpPerGame=Number(p.ppg||0);
   out.push({name:String(p.name),team:String(p.team||pr?.[1]||""),pos:String(p.position||""),games,fpPerGame,startPrice,value:startPrice&&startPrice>0?fpPerGame/startPrice:null,status:startPrice?"Klar for ligaberikelse":"Mangler 19F-startpris"});
  }
  out.sort((x,y)=>(y.value??-1)-(x.value??-1)||y.fpPerGame-x.fpPerGame);
  setRows(out);setMsg(`Ferdig · ${out.length} sannsynlige nye/returnerende 2025/26-spillere identifisert`);
 }catch(e:any){setMsg(`Feil: ${e.message||e}`)}finally{setBusy(false)}}
 return <main className="fantasy-page">
  <section className="fantasy-card"><h1>V4.5 · Historisk import-backtest</h1><p>Første steg: identifiserer spillere som hadde minst 10 kamper i EHL 2025/26, men manglet et reelt EHL-utvalg i 2024/25. Disse kobles mot 19F-startprisen fra 2025/26 og faktisk fantasyproduksjon i EHL. Neste steg er å berike denne eksakte spillerlisten med liga og produksjon fra 2024/25.</p><button onClick={run} disabled={busy}>{busy?"Analyserer…":"Kjør V4.5 kandidat-backtest"}</button><p><strong>{msg}</strong></p></section>
  {rows.length>0&&<><section className="fantasy-card"><h2>Hva testen viser</h2><p><strong>FP/K</strong> er faktisk fantasyproduksjon i EHL 2025/26. <strong>FP/K per million</strong> viser hvor mye produksjon spilleren ga mot 19F-startprisen. Når vi har beriket forrige liga og P/GP, kan vi beregne empiriske ligatranslasjoner.</p></section><section className="fantasy-card"><h2>Kandidater for historisk ligaberikelse</h2><table><thead><tr><th>Spiller</th><th>Lag 25/26</th><th>Pos</th><th>K</th><th>FP/K</th><th>19F start</th><th>FP/K per m</th><th>Status</th></tr></thead><tbody>{rows.map(r=><tr key={`${r.team}-${r.name}`}><td>{r.name}</td><td>{r.team}</td><td>{r.pos}</td><td>{r.games}</td><td>{r.fpPerGame.toFixed(2)}</td><td>{r.startPrice==null?"—":`${r.startPrice.toFixed(1)}m`}</td><td>{r.value==null?"—":r.value.toFixed(3)}</td><td>{r.status}</td></tr>)}</tbody></table></section></>}
 </main>;
}
