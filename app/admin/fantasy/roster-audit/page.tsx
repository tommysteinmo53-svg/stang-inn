"use client";

import {useState} from "react";
import {getSupabaseBrowserClient} from "../../../../lib/supabase";

export default function RosterAuditPage(){
  const[busy,setBusy]=useState(false),[message,setMessage]=useState("Klar til full EP-kontroll"),[data,setData]=useState<any>(null);

  async function run(){
    setBusy(true);setData(null);setMessage("Sammenligner produksjonsroster mot EliteProspects 2026/27 …");
    try{
      const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");
      const{data:sessionData}=await s.auth.getSession();const token=sessionData.session?.access_token;
      if(!token)throw new Error("Du må være logget inn som admin");
      const r=await fetch("/api/admin/fantasy/eliteprospects-roster-audit",{cache:"no-store",headers:{Authorization:`Bearer ${token}`}});
      const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"Roster-audit feilet");
      setData(j);
      const x=j.summary||{},q=j.reconciliation?.summary||{};
      setMessage(`Ferdig · EP ${x.expected??"?"} · aktiv/current ${x.current??"?"} · match ${x.matched??"?"} (${x.exactMatched??"?"} eksakt + ${x.variantMatched??"?"} sikker navnevariant) · mangler ${x.missing??"?"} · lagavvik ${x.teamMismatch??"?"} · ekstra ${x.extras??"?"} · reconciliation uløst ${q.unresolved??"?"}`);
    }catch(e:any){setMessage(e?.message||"Roster-audit feilet")}finally{setBusy(false)}
  }

  const summary=data?.summary,rec=data?.reconciliation?.summary;
  return <main className="appShell">
    <header className="topbar"><div className="brand"><div className="brandMark">🏒</div><div><p className="eyebrow">MP-02 · EHL 2026/27</p><h1>EliteProspects roster-audit</h1></div></div><a href="/admin/fantasy" className="textButton">← Fantasy-admin</a></header>
    <section className="pageStack" style={{marginTop:24}}>
      <article className="heroCard"><div><p className="eyebrow">Preseason source of truth</p><h2>Produksjonsroster ↔ EliteProspects</h2><p className="muted">Read-only kontroll. Ingen spillerdata endres. Eksakt navn matches først. Deretter tillates bare deterministiske navnevarianter: hele navnetokens må stemme, EP-fornavn og etternavn må finnes i riktig rekkefølge i NIF-navnet, kandidaten må være unik i hele ligaen og posisjonen kompatibel. Ingen fuzzy matching eller automatisk gjetting. Reconciliation-preview søker også i inactive/non-current historiske rader før en ny spiller kan foreslås opprettet.</p></div><button onClick={run} disabled={busy}>{busy?"Kontrollerer …":"Kjør full roster-audit"}</button></article>
      <article className="panel"><p style={{fontWeight:800}}>{message}</p></article>
      {summary&&<div className="statsGrid">{[["EP-fasit",summary.expected],["Aktiv/current",summary.current],["Match totalt",summary.matched],["Eksakt",summary.exactMatched],["Sikker navnevariant",summary.variantMatched],["Mangler",summary.missing],["Lagavvik",summary.teamMismatch],["Tvetydige",summary.ambiguous],["Ekstra",summary.extras],["Posisjonsavvik",summary.positionMismatch]].map(([label,value])=><div className="panel" key={String(label)}><p className="eyebrow">{label}</p><div style={{fontSize:28,fontWeight:900}}>{value}</div></div>)}</div>}
      {rec&&<article className="panel"><div className="panelHeading"><div><p className="eyebrow">Read-only reconciliation</p><h3>Foreslåtte produksjonshandlinger</h3></div></div><p className="muted">Dette er kun preview. Ingen databaseendringer utføres.</p><div className="statsGrid" style={{marginTop:12}}>{[["Sikre assignments",rec.assignments],["Reaktiver",rec.reactivate],["Flytt lag",rec.teamUpdates],["Normaliser lagtekst",rec.canonicalTeamUpdates],["Posisjon til kontroll",rec.positionMismatch],["Uløst",rec.unresolved],["Tvetydige",rec.ambiguous],["ID-kollisjoner",rec.identityCollisions],["Hold manuell kontroll",rec.holdForManualReview],["Ut av current",rec.removeFromCurrent]].map(([label,value])=><div className="panel" key={String(label)}><p className="eyebrow">{label}</p><div style={{fontSize:24,fontWeight:900}}>{value}</div></div>)}</div></article>}
      {data?.perTeam&&<article className="panel"><div className="panelHeading"><div><p className="eyebrow">Alle EHL-lag</p><h3>Lagkontroll</h3></div></div><div style={{overflowX:"auto"}}><table style={{width:"100%",minWidth:900,borderCollapse:"collapse"}}><thead><tr>{["Lag","EP","DB current","Match","Eksakt","Navnevariant","Mangler","Lagavvik","Ekstra"].map(h=><th key={h} style={{textAlign:"left",padding:8}}>{h}</th>)}</tr></thead><tbody>{data.perTeam.map((r:any)=><tr key={r.team}><td style={{padding:8,fontWeight:800}}>{r.team}</td><td>{r.expected}</td><td>{r.current}</td><td>{r.matched}</td><td>{r.exactMatched}</td><td>{r.variantMatched}</td><td>{r.missing}</td><td>{r.teamMismatch}</td><td>{r.extras}</td></tr>)}</tbody></table></div></article>}
      {data?.targets&&<article className="panel"><div className="panelHeading"><div><p className="eyebrow">Narvik-kontroll</p><h3>Mitrovic · Selnes · Dehli</h3></div></div><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12}}>{JSON.stringify(data.targets,null,2)}</pre></article>}
      {data?.reconciliation&&<article className="panel"><details open><summary style={{cursor:"pointer",fontWeight:900}}>Komplett reconciliation-preview</summary><pre style={{marginTop:12,whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:11}}>{JSON.stringify(data.reconciliation,null,2)}</pre></details></article>}
      {data&&<article className="panel"><details><summary style={{cursor:"pointer",fontWeight:900}}>Komplett audit-resultat</summary><pre style={{marginTop:12,whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:11}}>{JSON.stringify(data,null,2)}</pre></details></article>}
    </section>
  </main>;
}
