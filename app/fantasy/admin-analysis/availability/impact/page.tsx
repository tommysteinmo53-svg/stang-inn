"use client";

import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../../lib/supabase";
import "../../../fantasy.css";
import "../../xfp-admin.css";

type Row={
  player_id:string;player_name:string;team:string;player_position:string;
  availability_status:string;availability_factor:number;availability_adjustment:string;
  availability_note:string|null;availability_expected_return:string|null;availability_updated_at:string|null;
  active:boolean|null;on_current_roster:boolean|null;blocked:boolean;
};

const statusLabel=(s:string)=>({available:"Tilgjengelig",returning:"Tilbake",questionable:"Usikker",out:"Ute",long_term:"Langtid ute",not_in_lineup:"Ikke i tropp"}[s]||s);
const dateLabel=(v:string|null)=>v?new Date(v).toLocaleString("nb-NO",{dateStyle:"short",timeStyle:"short"}):"—";

export default function AvailabilityImpactPage(){
 const[rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState("");
 async function load(){
  setBusy(true);setError("");
  try{
   const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");
   const{data}=await s.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Du må være logget inn");
   const res=await fetch("/api/admin/fantasy/availability-impact",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
   const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke hente availability");
   setRows(body.rows||[]);
  }catch(e:any){setError(e?.message||"Kunne ikke hente data")}finally{setBusy(false)}
 }
 useEffect(()=>{load()},[]);
 return <main className="fantasy-shell xfp-command-center">
  <section className="xfp-command-hero"><p className="fantasy-kicker">MP-09 · AVAILABILITY × xFP</p><h1>Availability-effekt</h1><p>Viser kun godkjent, autoritativ availability som faktisk påvirker analysemodellen. Denne kontrollsiden bruker en lett datavei og er ikke avhengig av den tunge full-xFP-rangeringen.</p></section>
  <section className="xfp-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">ADMIN ONLY · FORKLARBAR MODELL</p><h2>Påvirkede spillere</h2><p>{rows.length} spillere har en annen status enn tilgjengelig. Uverifiserte funn fra review-køen vises ikke her og påvirker ikke modellen.</p></div><button className="xfp-primary" onClick={load} disabled={busy}>{busy?"Oppdaterer …":"↻ Oppdater"}</button></div>
   <div className="xfp-actions"><span><strong>Policy:</strong> tilgjengelig 100 % · tilbake 85 % · usikker 60 % · ute/langtid/ikke i tropp 0 %</span></div>
   <p className="xfp-price-note">Selve xFP-faktorene er produksjonsverifisert separat. Base- og justerte xFP-tall vises ikke på denne kontrollsiden før full-xFP-spørringen er optimalisert; dette hindrer at en database-timeout presenteres som et availability-resultat.</p>
   {error&&<p className="xfp-error">{error}</p>}
   <div className="xfp-table-wrap"><table className="xfp-table"><thead><tr><th>Spiller</th><th>Status</th><th>Faktor</th><th>Modell</th><th>Roster</th><th>Sist oppdatert</th></tr></thead><tbody>{rows.map(r=><tr key={r.player_id}><td><strong>{r.player_name}</strong><small>{r.team} · {r.player_position}</small></td><td><strong>{statusLabel(r.availability_status)}</strong>{r.availability_note&&<small>{r.availability_note}</small>}{r.availability_expected_return&&<small>Forventet retur: {r.availability_expected_return}</small>}</td><td>{Math.round(Number(r.availability_factor||0)*100)} %</td><td>{r.blocked?<strong>Blokkert</strong>:<span>{r.availability_adjustment||"Justeres"}</span>}</td><td>{r.on_current_roster===false?<strong>Ikke i nåværende roster</strong>:r.active===false?<span>Inaktiv</span>:<span>Aktiv</span>}</td><td>{dateLabel(r.availability_updated_at)}</td></tr>)}{!rows.length&&!busy&&!error&&<tr><td colSpan={6} className="xfp-empty">Ingen spillere har availability som justerer xFP akkurat nå.</td></tr>}</tbody></table></div>
  </section>
 </main>;
}
