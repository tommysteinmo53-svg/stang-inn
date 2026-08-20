"use client";

import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../../lib/supabase";
import "../../../fantasy.css";
import "../../xfp-admin.css";

type Row={
  player_id:string;player_name:string;team:string;player_position:string;
  status:string;status_label:string;note:string|null;expected_return:string|null;
  affected_teams:number;affected_users:number;affected_team_names:string[];
  notification_preview:{type:string;title:string;message:string;link:string};
};
type Summary={affected_players:number;recipient_links:number;mode:string;writes:number;authoritative_source:string};

export default function AvailabilityAlertsPreviewPage(){
 const[rows,setRows]=useState<Row[]>([]),[summary,setSummary]=useState<Summary|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("");
 async function load(){
  setBusy(true);setError("");
  try{
   const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");
   const{data}=await s.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Du må være logget inn");
   const res=await fetch("/api/admin/fantasy/availability-alerts-preview",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
   const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke hente varselforhåndsvisning");
   setRows(body.rows||[]);setSummary(body.summary||null);
  }catch(e:any){setError(e?.message||"Kunne ikke hente data")}finally{setBusy(false)}
 }
 useEffect(()=>{load()},[]);
 return <main className="fantasy-shell xfp-command-center">
  <section className="xfp-command-hero"><p className="fantasy-kicker">MP-09.7 · AVAILABILITY-VARSLER</p><h1>Varselforhåndsvisning</h1><p>Viser hvilke fantasy-lag som ville fått varsel basert kun på admin-godkjent spillerstatus. Denne siden sender ingenting.</p></section>
  <section className="xfp-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">ADMIN ONLY · READ-ONLY</p><h2>Berørte fantasy-lag</h2><p>{summary?.affected_players??0} relevante spillere · {summary?.recipient_links??0} mottakerkoblinger · database-writes {summary?.writes??0}.</p></div><button className="xfp-primary" onClick={load} disabled={busy}>{busy?"Oppdaterer …":"↻ Oppdater"}</button></div>
   <div className="xfp-actions"><span><strong>Kilde:</strong> kun <code>fantasy_player_availability</code>. Review-kø og ikke-godkjente funn leses ikke.</span></div>
   {error&&<p className="xfp-error">{error}</p>}
   <div className="xfp-table-wrap"><table className="xfp-table"><thead><tr><th>Spiller</th><th>Status</th><th>Berørte lag</th><th>Mottakere</th><th>Varsel som ville blitt sendt</th></tr></thead><tbody>
    {rows.map(r=><tr key={r.player_id}><td><strong>{r.player_name}</strong><small>{r.team} · {r.player_position}</small></td><td><strong>{r.status_label}</strong>{r.note&&<small>{r.note}</small>}{r.expected_return&&<small>Forventet retur: {r.expected_return}</small>}</td><td><strong>{r.affected_teams}</strong>{r.affected_team_names.length>0&&<small>{r.affected_team_names.join(" · ")}</small>}</td><td>{r.affected_users}</td><td><strong>{r.notification_preview.title}</strong><small>{r.notification_preview.message}</small><small>Lenke: {r.notification_preview.link}</small></td></tr>)}
    {!rows.length&&!busy&&!error&&<tr><td colSpan={5} className="xfp-empty">Ingen nåværende fantasy-lag har en spiller med godkjent availability som utløser varsel.</td></tr>}
   </tbody></table></div>
  </section>
 </main>;
}
