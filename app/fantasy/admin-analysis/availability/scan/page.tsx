"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../../lib/supabase";
import "../../../fantasy.css";
import "../../xfp-admin.css";

type Diagnostic={source:string;articles:number;matches:number;error?:string};
type Result={scannedSources:number;candidates:number;inserted:number;duplicates:number;diagnostics:Diagnostic[]};

export default function AvailabilityScanPage(){
 const[token,setToken]=useState<string|null>(null),[msg,setMsg]=useState("Kontrollerer admin-tilgang …"),[busy,setBusy]=useState(false),[result,setResult]=useState<Result|null>(null);
 useEffect(()=>{(async()=>{try{const s=getSupabaseBrowserClient();const{data}=await s!.auth.getSession();const t=data.session?.access_token;if(!t)throw new Error("Du må være logget inn");setToken(t);setMsg("Klar til å skanne nitten.no og klubbkilder") }catch(e:any){setMsg(e?.message||"Ingen tilgang")}})()},[]);
 async function scan(){if(!token)return;setBusy(true);setMsg("Skanner kilder …");try{const r=await fetch("/api/admin/fantasy/availability-source-scan",{method:"POST",headers:{Authorization:`Bearer ${token}`}});const b=await r.json();if(!r.ok||!b.ok)throw new Error(b.error||"Skann feilet");setResult(b);setMsg(`✓ ${b.inserted} nye funn lagt i review-kø · ${b.duplicates} duplikater hoppet over`)}catch(e:any){setMsg(e?.message||"Skann feilet")}finally{setBusy(false)}}
 return <main className="fantasy-shell xfp-command-center">
  <section className="xfp-command-hero"><p className="fantasy-kicker">STANG INN · MP-09</p><h1>Automatisk kildeskann</h1><p>Scanner nitten.no og EHL-klubbenes nettsider etter aktive roster-spillere omtalt sammen med tydelige skade-, sykdom-, karantene-, comeback- eller troppssignaler. Treffer legges kun i review-kø.</p></section>
  <section className="xfp-panel"><div className="xfp-panel-head"><div><p className="eyebrow">IKKE-AUTORITATIV INNHENTING</p><h2>Kjør kildekontroll</h2><p>Ingen funn publiseres automatisk. Faktisk availability endres fortsatt bare etter eksplisitt admin-godkjenning.</p></div><a className="xfp-secondary" href="/fantasy/admin-analysis/availability/findings">← Review-kø</a></div><div className="xfp-actions"><button className="xfp-primary" disabled={busy||!token} onClick={scan}>{busy?"Skanner …":"Skann kilder nå"}</button><span>{msg}</span></div>{result&&<div className="preseason-table-wrap" style={{marginTop:16}}><table className="preseason-table"><thead><tr><th>Kilde</th><th>Artikler</th><th>Funn</th><th>Status</th></tr></thead><tbody>{result.diagnostics.map(d=><tr key={d.source}><td><strong>{d.source}</strong></td><td>{d.articles}</td><td>{d.matches}</td><td>{d.error?<span>⚠️ {d.error}</span>:<span>✓ lest</span>}</td></tr>)}</tbody></table><p className="preseason-message">Kilder: {result.scannedSources} · kandidater: {result.candidates} · nye: {result.inserted} · duplikater: {result.duplicates}</p></div>}</section>
 </main>;
}
