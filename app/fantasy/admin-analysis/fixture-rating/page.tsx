"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../lib/supabase";
import "../../fantasy.css";
import "../xfp-admin.css";

type Row={team:string;position_group:string;preseason_factor:number;live_factor:number;opponent_factor:number;fixture_rating:number;fixture_label:string;completed_games:number;live_weight:number;rating_source:string};
type Definition={version:string;scale:string;direction:string;transition:string;liveCurve:string;xfpImpact:string;source:string};

const sourceLabel=(s:string)=>s==="live"?"Live EHL":s==="blended"?"Preseason + live":"Preseason";
const pct=(v:number)=>`${Math.round(Number(v||0)*100)} %`;

export default function FixtureRatingPage(){
 const[rows,setRows]=useState<Row[]>([]),[definition,setDefinition]=useState<Definition|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("");
 async function load(){
  setBusy(true);setError("");
  try{
   const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");
   const{data}=await s.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Du må være logget inn");
   const res=await fetch("/api/admin/fantasy/fixture-rating",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
   const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke hente motstanderrating");
   setRows(body.rows||[]);setDefinition(body.definition||null);
  }catch(e:any){setError(e?.message||"Kunne ikke hente data")}finally{setBusy(false)}
 }
 useEffect(()=>{load()},[]);
 const grouped=useMemo(()=>{
  const m=new Map<string,Row[]>();for(const r of rows){const a=m.get(r.team)||[];a.push(r);m.set(r.team,a)}return [...m.entries()].sort((a,b)=>a[0].localeCompare(b[0],"nb"));
 },[rows]);
 return <main className="fantasy-shell xfp-command-center">
  <section className="xfp-command-hero"><p className="fantasy-kicker">MP-08.5 · FIXTURE-RATING</p><h1>Dynamisk motstanderrating</h1><p>Samme opponent factor som brukes i xFP, gjort lesbar på en 1–5-skala. Ratingen går kontrollert fra preseason-anker til faktiske EHL-resultater.</p></section>
  <section className="xfp-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">FORKLARBAR MODELL</p><h2>Motstander per posisjon</h2><p>1 = svært vanskelig · 2 = vanskelig · 3 = nøytral · 4 = lett · 5 = svært lett. Høyere factor betyr gunstigere matchup for fantasyspilleren.</p></div><button className="xfp-primary" onClick={load} disabled={busy}>{busy?"Oppdaterer …":"↻ Oppdater"}</button></div>
   {definition&&<div className="xfp-actions"><span><strong>Overgang:</strong> {definition.transition}</span><span><strong>Live-kurve:</strong> {definition.liveCurve}</span><span><strong>xFP-effekt:</strong> {definition.xfpImpact}</span></div>}
   {error&&<p className="xfp-error">{error}</p>}
   <div className="xfp-table-wrap"><table className="xfp-table"><thead><tr><th>Lag</th><th>Posisjon</th><th>Rating</th><th>Preseason</th><th>Live</th><th>Blended factor</th><th>Datagrunnlag</th><th>Live-vekt</th><th>Seriekamper</th></tr></thead><tbody>
    {grouped.flatMap(([team,list])=>list.sort((a,b)=>a.position_group.localeCompare(b.position_group)).map((r,i)=><tr key={`${team}-${r.position_group}`}><td>{i===0?<strong>{team}</strong>:""}</td><td>{r.position_group}</td><td><strong>{r.fixture_rating}/5 · {r.fixture_label}</strong></td><td>{Number(r.preseason_factor).toFixed(3)}</td><td>{r.completed_games>0?Number(r.live_factor).toFixed(3):"—"}</td><td><strong>{Number(r.opponent_factor).toFixed(3)}</strong></td><td>{sourceLabel(r.rating_source)}</td><td>{pct(r.live_weight)}</td><td>{r.completed_games}</td></tr>))}
    {!rows.length&&!busy&&!error&&<tr><td colSpan={9} className="xfp-empty">Ingen ratingdata tilgjengelig.</td></tr>}
   </tbody></table></div>
   <p className="xfp-price-note"><strong>Slik leses modellen:</strong> Preseason er startankeret. Live viser hva EHL-resultatene alene tilsier når seriekamper finnes. Blended factor er den autoritative faktoren xFP faktisk bruker. Før kamp 12 blandes preseason og live lineært; fra kamp 12 brukes live alene.</p>
   <p className="xfp-price-note">I preseason vil F/D/G normalt være like fordi ankeret er lagbasert. Når seriespillet starter kan keeper-rating og skater-rating utvikle seg forskjellig: skaters vurderes mot hvor mye motstanderen slipper inn, mens keepere vurderes mot hvor mye motstanderen scorer.</p>
  </section>
 </main>;
}
