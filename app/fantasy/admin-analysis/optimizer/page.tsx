"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../lib/supabase";
import "../../fantasy.css";
import "../xfp-admin.css";
import "./optimizer.css";

type Row={player_id:string;player_name:string;team:string;player_position:string;price:number;base_projected_points:number;projected_points:number;line_no:number;line_multiplier:number;is_captain:boolean;is_vice_captain:boolean;role_multiplier:number;total_cost:number;total_projected_points:number};
type Economy={season:string;budget:number;economy_lock_at:string|null;first_game_at:string|null;economy_locked:boolean};
type TransferPlayer={id:string;name:string;team:string;pos:string;price:number;raw_base_score:number;base_score:number;score:number;line_no:number|null;is_captain:boolean;is_vice_captain:boolean;availability_status:string;data_confidence:"high"|"medium"|"low";risk_score:number;risk_label:"Lav"|"Middels"|"Høy"};
type TransferChange={out:TransferPlayer;in:TransferPlayer;line_no:number|null;price_change:number;xfp_gain:number;risk_score:number;risk_label:"Lav"|"Middels"|"Høy"};
type TransferResult={team:{id:string;name:string}|null;status:any;economy:Economy|null;current:TransferPlayer[];optimized:TransferPlayer[];changes:TransferChange[];current_cost:number;optimized_cost:number;current_score:number;optimized_score:number;xfp_gain:number;transfers_available:number;proposal_risk_score:number;proposal_risk_label:"Lav"|"Middels"|"Høy";message?:string};

const posOrder:Record<string,number>={G:1,D:2,F:3};
const fmt=(v:unknown,d=1)=>Number(v||0).toFixed(d);
const dt=(v:string|null)=>v?new Date(v).toLocaleString("nb-NO",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
const playerRole=(p:TransferPlayer)=>p.is_captain?" · C":p.is_vice_captain?" · VC":"";
const rowRole=(p:Row)=>p.is_captain?" · C":p.is_vice_captain?" · VC":"";
const transferSlot=(p:TransferPlayer)=>p.pos==="G"?"Keeper":p.line_no?`Rekke ${p.line_no}`:"Uplassert";
const transferRole=(p:TransferPlayer)=>p.is_captain?"Kaptein":p.is_vice_captain?"Visekaptein":null;
const confidenceLabel=(v:TransferPlayer["data_confidence"])=>v==="high"?"Høy":v==="low"?"Lav":"Middels";
const availabilityLabel=(v:string)=>v==="questionable"?"Usikker 60 %":v==="returning"?"Retur 85 %":v==="out"?"Ute":v==="long_term"?"Langtid":v==="not_in_lineup"?"Ikke i tropp":"Tilgjengelig 100 %";

function lineupSections(players:TransferPlayer[]){
 const sort=(rows:TransferPlayer[])=>[...rows].sort((a,b)=>posOrder[a.pos]-posOrder[b.pos]||b.score-a.score||a.name.localeCompare(b.name,"nb"));
 const lineNos=Array.from(new Set(players.filter(p=>p.pos!=="G"&&p.line_no!=null).map(p=>Number(p.line_no)))).sort((a,b)=>a-b);
 const sections=[{key:"goalies",title:"Keepere",rows:sort(players.filter(p=>p.pos==="G"))}];
 for(const line of lineNos)sections.push({key:`line-${line}`,title:`Rekke ${line}`,rows:sort(players.filter(p=>p.pos!=="G"&&Number(p.line_no)===line))});
 const unplaced=sort(players.filter(p=>p.pos!=="G"&&p.line_no==null));if(unplaced.length)sections.push({key:"unplaced",title:"Uplassert",rows:unplaced});return sections;
}
function Lineup({players}:{players:TransferPlayer[]}){
 return <div className="optimizer-groups compact lineup-groups">{lineupSections(players).map(section=><section key={section.key} className="optimizer-group"><h3>{section.title} <span>{section.rows.length}</span></h3>{section.rows.map(p=><article key={p.id} className="optimizer-player"><b>{p.pos}</b><div><strong>{p.name}{playerRole(p)}</strong><small>{p.team}</small></div><div><strong>{fmt(p.price)}m</strong><small>pris</small></div><div className="xfp-highlight"><strong>{fmt(p.score,2)}</strong><small>xFP</small></div></article>)}</section>)}</div>;
}
function FullLineup({players}:{players:Row[]}){
 const sort=(r:Row[])=>[...r].sort((a,b)=>posOrder[a.player_position]-posOrder[b.player_position]||b.projected_points-a.projected_points||a.player_name.localeCompare(b.player_name,"nb"));
 const sections=[
  {key:"goalies",title:"Keepere",rows:sort(players.filter(p=>p.player_position==="G"))},
  {key:"line1",title:"Rekke 1 · 100 %",rows:sort(players.filter(p=>p.player_position!=="G"&&p.line_no===1))},
  {key:"line2",title:"Rekke 2 · 50 %",rows:sort(players.filter(p=>p.player_position!=="G"&&p.line_no===2))},
 ];
 return <div className="optimizer-groups">{sections.map(section=><section key={section.key} className="optimizer-group"><h3>{section.title} <span>{section.rows.length}</span></h3>{section.rows.map(p=><article key={p.player_id} className="optimizer-player"><b>{p.player_position}</b><div><strong>{p.player_name}{rowRole(p)}</strong><small>{p.team}{p.player_position==="G"?` · Rekke ${p.line_no}`:""}</small></div><div><strong>{fmt(p.price)}m</strong><small>pris</small></div><div className="xfp-highlight"><strong>{fmt(p.projected_points,2)}</strong><small>{fmt(p.base_projected_points,2)} base</small></div></article>)}</section>)}</div>;
}

export default function OptimizerPage(){
 const[token,setToken]=useState<string|null>(null),[rows,setRows]=useState<Row[]>([]),[economy,setEconomy]=useState<Economy|null>(null),[busy,setBusy]=useState(true),[message,setMessage]=useState("");
 const[horizon,setHorizon]=useState<"next_game"|"next3">("next3"),[budget,setBudget]=useState("100");
 const[transferBusy,setTransferBusy]=useState(false),[transferMessage,setTransferMessage]=useState(""),[transferResult,setTransferResult]=useState<TransferResult|null>(null);
 useEffect(()=>{(async()=>{try{const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");const{data}=await sb.auth.getSession();const access=data.session?.access_token;if(!access)throw new Error("Du må være logget inn");setToken(access)}catch(e:any){setMessage(e?.message||"Kunne ikke kontrollere innlogging");setBusy(false)}})()},[]);
 async function run(access=token,nextHorizon=horizon,nextBudget=budget){if(!access)return;setBusy(true);setMessage("");try{const qs=new URLSearchParams({horizon:nextHorizon});if(nextBudget.trim())qs.set("budget",nextBudget.trim());const res=await fetch(`/api/admin/fantasy/optimizer?${qs.toString()}`,{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke kjøre optimalisering");const result=(body.rows||[]) as Row[];setRows(result);setEconomy(body.economy||null);if(body.economy&&budget==="100")setBudget(String(Number(body.economy.budget||100)));if(result.length!==12)setMessage(result.length?`Optimizer returnerte ${result.length}/12 spillere.`:"Ingen gyldig tropp funnet med valgt budsjett.")}catch(e:any){setRows([]);setMessage(e?.message||"Kunne ikke kjøre optimalisering")}finally{setBusy(false)}}
 async function runTransfers(access=token,nextHorizon=horizon){if(!access)return;setTransferBusy(true);setTransferMessage("");try{const qs=new URLSearchParams({horizon:nextHorizon});const res=await fetch(`/api/admin/fantasy/transfer-optimizer?${qs.toString()}`,{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke optimalisere bytter");setTransferResult(body);if(body.message)setTransferMessage(body.message);else if(!body.changes?.length)setTransferMessage("Ingen tilgjengelige bytter gir høyere forventet poengsum akkurat nå.")}catch(e:any){setTransferResult(null);setTransferMessage(e?.message||"Kunne ikke optimalisere bytter")}finally{setTransferBusy(false)}}
 useEffect(()=>{if(token){run(token);runTransfers(token)}},[token]);
 const total=rows[0]?.total_cost||0,projected=rows[0]?.total_projected_points||0;
 const clubCounts=useMemo(()=>{const m=new Map<string,number>();for(const r of rows)m.set(r.team,(m.get(r.team)||0)+1);return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"nb"))},[rows]);
 return <main className="fantasy-shell xfp-command-center">
  <section className="xfp-command-hero"><p className="fantasy-kicker">STANG INN · ADMIN ANALYSE</p><h1>Optimal lag-generator</h1><p>Finner høyest forventede Fantasy-poeng innen valgt budsjett med 2 keepere, 4 backer, 6 forwards og maks 3 spillere per klubb. Rekker og C/VC inngår i optimaliseringen.</p></section>
  <section className="xfp-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">ADMIN ONLY · OPTIMIZER V1</p><h2>Innstillinger</h2><p>Velg horisont og test budsjettet før sesongens økonomi låses.</p></div><a className="xfp-secondary" href="/fantasy/admin-analysis" style={{textDecoration:"none"}}>← Kommandosenter</a></div>
   <div className="optimizer-controls"><label><span>Optimaliser for</span><select value={horizon} onChange={e=>setHorizon(e.target.value as any)}><option value="next_game">Neste kamp</option><option value="next3">Neste 3 kamper</option></select></label><label><span>Budsjett (mill.)</span><input type="number" min="1" max="500" step="0.5" value={budget} onChange={e=>setBudget(e.target.value)}/></label><button className="xfp-primary" disabled={busy} onClick={()=>run()}>{busy?"Optimaliserer …":"⚙️ Finn beste lag"}</button></div>
   {economy&&<div className="optimizer-economy"><div><span>Sesongbudsjett</span><strong>{fmt(economy.budget)}m</strong></div><div><span>Økonomilås</span><strong>{dt(economy.economy_lock_at)}</strong></div><div><span>Status</span><strong>{economy.economy_locked?"🔒 Låst":"🟢 Åpen"}</strong></div></div>}{message&&<p className="xfp-error">{message}</p>}
  </section>
  <section className="xfp-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">HELT NYTT LAG</p><h2>Beste komplette oppstilling</h2><p>Finner beste 12-mannslag fra bunnen av og optimaliserer samtidig Rekke 1 (100 %), Rekke 2 (50 %), kaptein ×2 og visekaptein ×1,5.</p></div></div>
   <div className="optimizer-summary"><div><span>Totalpris</span><strong>{fmt(total)}m</strong><small>{Math.max(0,Number(budget||0)-Number(total)).toFixed(1)}m igjen</small></div><div><span>Forventede Fantasy-poeng</span><strong>{fmt(projected,2)}</strong><small>{horizon==="next_game"?"neste kamp":"neste 3 kamper"} · inkl. rekker/C/VC</small></div><div><span>Tropp</span><strong>{rows.length}/12</strong><small>2G · 4D · 6F</small></div><div><span>Maks fra klubb</span><strong>{clubCounts[0]?.[1]||0}/3</strong><small>{clubCounts[0]?.[0]||"—"}</small></div></div>
   <FullLineup players={rows}/>
  </section>
  <section className="xfp-panel transfer-optimizer-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">DITT LAG · BYTTEOPTIMALISERING</p><h2>Optimaliser med ledige bytter</h2><p>Speiler ditt faktiske Fantasy-lag og bruker availability-justert xFP. Rekke 1/2 og C/VC inngår i forventet poenggevinst. Forslaget lagres ikke automatisk.</p></div><button className="xfp-primary" disabled={transferBusy} onClick={()=>runTransfers()}>{transferBusy?"Analyserer …":"🔄 Finn beste bytter"}</button></div>
   {transferResult&&<div className="optimizer-summary transfer-summary"><div><span>Ledige bytter</span><strong>{transferResult.transfers_available}</strong><small>{Number(transferResult.status?.transfers_used||0)} brukt i runden</small></div><div><span>Nåværende xFP</span><strong>{fmt(transferResult.current_score,2)}</strong><small>{horizon==="next_game"?"neste kamp":"neste 3 kamper"} · availability-justert</small></div><div><span>Forventet gevinst</span><strong className="positive">+{fmt(transferResult.xfp_gain,2)}</strong><small>{fmt(transferResult.optimized_score,2)} xFP etter bytter</small></div><div><span>Risiko</span><strong>{transferResult.proposal_risk_label}</strong><small>{transferResult.proposal_risk_score}/100 · availability + datatillit</small></div></div>}{transferMessage&&<p className="team-message">{transferMessage}</p>}
   {transferResult&&<><div className="transfer-roster-title"><h3>Ditt faktiske lag nå</h3><span>{transferResult.current.length}/12 spillere</span></div><Lineup players={transferResult.current}/></>}
   {!!transferResult?.changes?.length&&<><div className="transfer-roster-title"><h3>Optimale bytter</h3><span>{transferResult.changes.length}/{transferResult.transfers_available} bytter</span></div><div className="transfer-change-grid">{transferResult.changes.map((c,i)=>{const outSlot=transferSlot(c.out),inSlot=transferSlot(c.in),role=transferRole(c.in);return <article className="transfer-change-card" key={`${c.out.id}-${c.in.id}`}><div className="transfer-change-no">Bytte {i+1} · {c.out.pos==="G"?"Keeper":outSlot===inSlot?inSlot:`${outSlot} → ${inSlot}`}</div><div className="transfer-side out"><span>UT</span><strong>{c.out.name}{playerRole(c.out)}</strong><small>{c.out.team} · {c.out.pos} · {fmt(c.out.price)}m · {fmt(c.out.score,2)} xFP</small></div><div className="transfer-arrow">→</div><div className="transfer-side in"><span>INN</span><strong>{c.in.name}{playerRole(c.in)}</strong><small>{c.in.team} · {c.in.pos} · {fmt(c.in.price)}m · {fmt(c.in.score,2)} xFP</small><small>Risiko {c.risk_label} ({c.risk_score}/100) · datatillit {confidenceLabel(c.in.data_confidence)} · {availabilityLabel(c.in.availability_status)}</small>{role&&<small>{role}rollen følger plassen i dette forslaget.</small>}</div><footer><b className={c.xfp_gain>=0?"positive":"negative"}>{c.xfp_gain>=0?"+":""}{fmt(c.xfp_gain,2)} direkte xFP</b><span>{c.price_change>=0?"+":""}{fmt(c.price_change)}m</span></footer></article>})}</div><p className="team-message">Forventet totalgevinst er availability-justert og er fasiten for hele forslaget. Spillerens base-xFP justeres med 100 % (available), 85 % (returning), 60 % (questionable) eller 0 % ved blokkert status. Deretter inngår Rekke 1 = 100 %, Rekke 2 = 50 %, C ×2 og VC ×1,5. Risikoscoren beskriver usikkerhet fra availability og datatillit – den er ikke et alternativt poengestimat.</p></>}
   {transferResult&&<><div className="transfer-roster-title"><h3>Lag etter foreslåtte bytter</h3><span>{transferResult.optimized.length}/12 spillere</span></div><Lineup players={transferResult.optimized}/></>}
  </section>
 </main>;
}
