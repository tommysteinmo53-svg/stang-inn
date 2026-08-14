"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../lib/supabase";
import "../../fantasy.css";
import "../xfp-admin.css";
import "./optimizer.css";

type Row={player_id:string;player_name:string;team:string;player_position:string;price:number;projected_points:number;total_cost:number;total_projected_points:number};
type Economy={season:string;budget:number;economy_lock_at:string|null;first_game_at:string|null;economy_locked:boolean};
type TransferPlayer={id:string;name:string;team:string;pos:string;price:number;score:number};
type TransferChange={out:TransferPlayer;in:TransferPlayer;price_change:number;xfp_gain:number};
type TransferResult={team:{id:string;name:string}|null;status:any;economy:Economy|null;current:TransferPlayer[];optimized:TransferPlayer[];changes:TransferChange[];current_cost:number;optimized_cost:number;current_score:number;optimized_score:number;xfp_gain:number;transfers_available:number;message?:string};

const posOrder:Record<string,number>={G:1,D:2,F:3};
const fmt=(v:unknown,d=1)=>Number(v||0).toFixed(d);
const dt=(v:string|null)=>v?new Date(v).toLocaleString("nb-NO",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—";

export default function OptimizerPage(){
 const[token,setToken]=useState<string|null>(null),[rows,setRows]=useState<Row[]>([]),[economy,setEconomy]=useState<Economy|null>(null),[busy,setBusy]=useState(true),[message,setMessage]=useState("");
 const[horizon,setHorizon]=useState<"next_game"|"next3">("next3"),[budget,setBudget]=useState("100");
 const[transferBusy,setTransferBusy]=useState(false),[transferMessage,setTransferMessage]=useState(""),[transferResult,setTransferResult]=useState<TransferResult|null>(null);

 useEffect(()=>{(async()=>{try{const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");const{data}=await sb.auth.getSession();const access=data.session?.access_token;if(!access)throw new Error("Du må være logget inn");setToken(access)}catch(e:any){setMessage(e?.message||"Kunne ikke kontrollere innlogging");setBusy(false)}})()},[]);

 async function run(access=token,nextHorizon=horizon,nextBudget=budget){if(!access)return;setBusy(true);setMessage("");try{const qs=new URLSearchParams({horizon:nextHorizon});if(nextBudget.trim())qs.set("budget",nextBudget.trim());const res=await fetch(`/api/admin/fantasy/optimizer?${qs.toString()}`,{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke kjøre optimalisering");const result=(body.rows||[]) as Row[];setRows(result);setEconomy(body.economy||null);if(body.economy&&budget==="100")setBudget(String(Number(body.economy.budget||100)));if(result.length!==12)setMessage(result.length?`Optimizer returnerte ${result.length}/12 spillere.`:"Ingen gyldig tropp funnet med valgt budsjett.")}catch(e:any){setRows([]);setMessage(e?.message||"Kunne ikke kjøre optimalisering")}finally{setBusy(false)}}
 async function runTransfers(access=token,nextHorizon=horizon){if(!access)return;setTransferBusy(true);setTransferMessage("");try{const qs=new URLSearchParams({horizon:nextHorizon});const res=await fetch(`/api/admin/fantasy/transfer-optimizer?${qs.toString()}`,{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke optimalisere bytter");setTransferResult(body);if(body.message)setTransferMessage(body.message);else if(!body.changes?.length)setTransferMessage("Ingen tilgjengelige bytter gir høyere forventet poengsum akkurat nå.")}catch(e:any){setTransferResult(null);setTransferMessage(e?.message||"Kunne ikke optimalisere bytter")}finally{setTransferBusy(false)}}
 useEffect(()=>{if(token){run(token);runTransfers(token)}},[token]);

 const total=rows[0]?.total_cost||0,projected=rows[0]?.total_projected_points||0;
 const groups=useMemo(()=>["G","D","F"].map(p=>({p,rows:rows.filter(r=>r.player_position===p).sort((a,b)=>Number(b.projected_points)-Number(a.projected_points))})),[rows]);
 const clubCounts=useMemo(()=>{const m=new Map<string,number>();for(const r of rows)m.set(r.team,(m.get(r.team)||0)+1);return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"nb"))},[rows]);
 const transferGroups=useMemo(()=>["G","D","F"].map(p=>({p,rows:(transferResult?.optimized||[]).filter(r=>r.pos===p).sort((a,b)=>b.score-a.score)})),[transferResult]);

 return <main className="fantasy-shell xfp-command-center">
  <section className="xfp-command-hero"><p className="fantasy-kicker">STANG INN · ADMIN ANALYSE</p><h1>Optimal lag-generator</h1><p>Finner høyest forventede poeng innen valgt budsjett med 2 keepere, 4 backer, 6 forwards og maks 3 spillere per klubb. Dette verktøyet er read-only og endrer ingen ekte Fantasy-lag.</p></section>

  <section className="xfp-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">ADMIN ONLY · OPTIMIZER V1</p><h2>Innstillinger</h2><p>Velg horisont og test budsjettet før sesongens økonomi låses.</p></div><a className="xfp-secondary" href="/fantasy/admin-analysis" style={{textDecoration:"none"}}>← Kommandosenter</a></div>
   <div className="optimizer-controls">
    <label><span>Optimaliser for</span><select value={horizon} onChange={e=>setHorizon(e.target.value as any)}><option value="next_game">Neste kamp</option><option value="next3">Neste 3 kamper</option></select></label>
    <label><span>Budsjett (mill.)</span><input type="number" min="1" max="500" step="0.5" value={budget} onChange={e=>setBudget(e.target.value)}/></label>
    <button className="xfp-primary" disabled={busy} onClick={()=>run()}>{busy?"Optimaliserer …":"⚙️ Finn beste lag"}</button>
   </div>
   {economy&&<div className="optimizer-economy"><div><span>Sesongbudsjett</span><strong>{fmt(economy.budget)}m</strong></div><div><span>Økonomilås</span><strong>{dt(economy.economy_lock_at)}</strong></div><div><span>Status</span><strong>{economy.economy_locked?"🔒 Låst":"🟢 Åpen"}</strong></div></div>}
   {message&&<p className="xfp-error">{message}</p>}
  </section>

  <section className="xfp-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">HELT NYTT LAG</p><h2>Beste komplette tropp</h2><p>Ser bort fra ditt eksisterende lag og finner best mulig 12-mannstropp fra bunnen av.</p></div></div>
   <div className="optimizer-summary"><div><span>Totalpris</span><strong>{fmt(total)}m</strong><small>{Math.max(0,Number(budget||0)-Number(total)).toFixed(1)}m igjen</small></div><div><span>Forventede poeng</span><strong>{fmt(projected,2)}</strong><small>{horizon==="next_game"?"neste kamp":"neste 3 kamper"}</small></div><div><span>Tropp</span><strong>{rows.length}/12</strong><small>2G · 4D · 6F</small></div><div><span>Maks fra klubb</span><strong>{clubCounts[0]?.[1]||0}/3</strong><small>{clubCounts[0]?.[0]||"—"}</small></div></div>
   <div className="optimizer-groups">{groups.sort((a,b)=>posOrder[a.p]-posOrder[b.p]).map(g=><section key={g.p} className="optimizer-group"><h3>{g.p==="G"?"Keepere":g.p==="D"?"Backer":"Forwards"} <span>{g.rows.length}/{g.p==="G"?2:g.p==="D"?4:6}</span></h3>{g.rows.map((r,i)=><article key={r.player_id} className="optimizer-player"><b>{i+1}</b><div><strong>{r.player_name}</strong><small>{r.team}</small></div><div><strong>{fmt(r.price)}m</strong><small>pris</small></div><div className="xfp-highlight"><strong>{fmt(r.projected_points,2)}</strong><small>xFP</small></div></article>)}</section>)}</div>
  </section>

  <section className="xfp-panel transfer-optimizer-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">DITT LAG · BYTTEOPTIMALISERING</p><h2>Optimaliser med ledige bytter</h2><p>Henter ditt faktiske Fantasy-lag og bruker kun antall ordinære bytter du har igjen i aktuell runde. Forslaget lagres ikke automatisk.</p></div><button className="xfp-primary" disabled={transferBusy} onClick={()=>runTransfers()}>{transferBusy?"Analyserer …":"🔄 Finn beste bytter"}</button></div>
   {transferResult&&<div className="optimizer-summary transfer-summary"><div><span>Ledige bytter</span><strong>{transferResult.transfers_available}</strong><small>{Number(transferResult.status?.transfers_used||0)} brukt i runden</small></div><div><span>Nåværende xFP</span><strong>{fmt(transferResult.current_score,2)}</strong><small>{horizon==="next_game"?"neste kamp":"neste 3 kamper"}</small></div><div><span>Optimalisert xFP</span><strong>{fmt(transferResult.optimized_score,2)}</strong><small className="positive">+{fmt(transferResult.xfp_gain,2)} xFP</small></div><div><span>Lagkostnad</span><strong>{fmt(transferResult.optimized_cost)}m</strong><small>{fmt((transferResult.economy?.budget||100)-transferResult.optimized_cost)}m igjen</small></div></div>}
   {transferMessage&&<p className="team-message">{transferMessage}</p>}

   {!!transferResult?.changes?.length&&<div className="transfer-change-grid">{transferResult.changes.map((c,i)=><article className="transfer-change-card" key={`${c.out.id}-${c.in.id}`}><div className="transfer-change-no">Bytte {i+1}</div><div className="transfer-side out"><span>UT</span><strong>{c.out.name}</strong><small>{c.out.team} · {c.out.pos} · {fmt(c.out.price)}m · {fmt(c.out.score,2)} xFP</small></div><div className="transfer-arrow">→</div><div className="transfer-side in"><span>INN</span><strong>{c.in.name}</strong><small>{c.in.team} · {c.in.pos} · {fmt(c.in.price)}m · {fmt(c.in.score,2)} xFP</small></div><footer><b className={c.xfp_gain>=0?"positive":"negative"}>{c.xfp_gain>=0?"+":""}{fmt(c.xfp_gain,2)} xFP</b><span>{c.price_change>=0?"+":""}{fmt(c.price_change)}m</span></footer></article>)}</div>}

   {transferResult&&<><div className="transfer-roster-title"><h3>Lag etter foreslåtte bytter</h3><span>{transferResult.optimized.length}/12 spillere</span></div><div className="optimizer-groups compact">{transferGroups.sort((a,b)=>posOrder[a.p]-posOrder[b.p]).map(g=><section key={g.p} className="optimizer-group"><h3>{g.p==="G"?"Keepere":g.p==="D"?"Backer":"Forwards"}</h3>{g.rows.map((r,i)=><article key={r.id} className="optimizer-player"><b>{i+1}</b><div><strong>{r.name}</strong><small>{r.team}</small></div><div><strong>{fmt(r.price)}m</strong><small>pris</small></div><div className="xfp-highlight"><strong>{fmt(r.score,2)}</strong><small>xFP</small></div></article>)}</section>)}</div></>}
  </section>
 </main>;
}
