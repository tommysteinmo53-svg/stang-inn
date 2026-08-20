"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../../lib/supabase";
import "../../../fantasy.css";
import "../../xfp-admin.css";

type Row={
  player_id:string;player_name:string;team:string;player_position:string;
  base_xfp_next_game:number;base_xfp_next3:number;base_value_next3:number;
  xfp_next_game:number;xfp_next3:number;value_next3:number;
  availability_status:string;availability_factor:number;availability_adjustment:string;
  availability_note:string|null;availability_expected_return:string|null;
};

const n=(v:unknown,d=2)=>Number(v||0).toFixed(d).replace(/\.00$/,".0");
const statusLabel=(s:string)=>({available:"Tilgjengelig",returning:"Tilbake",questionable:"Usikker",out:"Ute",long_term:"Langtid ute",not_in_lineup:"Ikke i tropp"}[s]||s);
const blocked=(s:string)=>["out","long_term","not_in_lineup"].includes(s);

export default function AvailabilityImpactPage(){
 const[rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState("");
 async function load(){setBusy(true);setError("");try{const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");const{data}=await s.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Du må være logget inn");const res=await fetch("/api/admin/fantasy/xfp",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke hente xFP");setRows(body.rows||[])}catch(e:any){setError(e?.message||"Kunne ikke hente data")}finally{setBusy(false)}}
 useEffect(()=>{load()},[]);
 const affected=useMemo(()=>rows.filter(r=>r.availability_status&&r.availability_status!=="available").sort((a,b)=>Number(a.availability_factor)-Number(b.availability_factor)||a.player_name.localeCompare(b.player_name,"nb")),[rows]);
 return <main className="fantasy-shell xfp-command-center">
  <section className="xfp-command-hero"><p className="fantasy-kicker">MP-09 · AVAILABILITY × xFP</p><h1>Availability-effekt</h1><p>Viser kun godkjent, autoritativ availability og hvordan den justerer xFP. Base-xFP beholdes urørt for sporbarhet.</p></section>
  <section className="xfp-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">ADMIN ONLY · FORKLARBAR MODELL</p><h2>Påvirkede spillere</h2><p>{affected.length} spillere har en annen status enn tilgjengelig. Uverifiserte funn fra review-køen vises ikke her og påvirker ikke modellen.</p></div><button className="xfp-primary" onClick={load} disabled={busy}>{busy?"Oppdaterer …":"↻ Oppdater"}</button></div>
   <div className="xfp-actions"><span><strong>Policy:</strong> tilgjengelig 100 % · tilbake 85 % · usikker 60 % · ute/langtid/ikke i tropp 0 %</span></div>
   {error&&<p className="xfp-error">{error}</p>}
   <div className="xfp-table-wrap"><table className="xfp-table"><thead><tr><th>Spiller</th><th>Status</th><th>Faktor</th><th>Base xFP kamp</th><th>Justert</th><th>Base xFP 3</th><th>Justert</th><th>Modell</th></tr></thead><tbody>{affected.map(r=><tr key={r.player_id}><td><strong>{r.player_name}</strong><small>{r.team} · {r.player_position}</small></td><td><strong>{statusLabel(r.availability_status)}</strong>{r.availability_note&&<small>{r.availability_note}</small>}{r.availability_expected_return&&<small>Forventet retur: {r.availability_expected_return}</small>}</td><td>{Math.round(Number(r.availability_factor||0)*100)} %</td><td>{n(r.base_xfp_next_game)}</td><td className="xfp-highlight">{n(r.xfp_next_game)}</td><td>{n(r.base_xfp_next3)}</td><td>{n(r.xfp_next3)}</td><td>{blocked(r.availability_status)?<strong>Blokkert</strong>:<span>{r.availability_adjustment||"Justeres"}</span>}</td></tr>)}{!affected.length&&!busy&&<tr><td colSpan={8} className="xfp-empty">Ingen spillere har availability som justerer xFP akkurat nå.</td></tr>}</tbody></table></div>
  </section>
 </main>;
}
