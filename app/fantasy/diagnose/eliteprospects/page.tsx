"use client";
import {useState} from "react";
import "../../fantasy.css";

export default function Page(){
  const[busy,setBusy]=useState(false),[data,setData]=useState<any>(null),[err,setErr]=useState("");
  async function run(){
    setBusy(true);setErr("");
    try{
      const r=await fetch('/api/fantasy-roster-enriched-2026',{cache:'no-store'});
      const j=await r.json();
      if(!r.ok||!j.ok) throw new Error(j.error||`HTTP ${r.status}`);
      setData(j);
    }catch(e:any){setErr(e?.message||String(e))}finally{setBusy(false)}
  }
  const d=data?.positionEnrichment;
  const missing=(data?.rows||[]).filter((x:any)=>!x.position).map((x:any)=>({name:x.name,team:x.team,positionSource:x.positionSource||null}));
  return <main className="fantasy-shell">
    <section className="fantasy-hero"><div><p className="fantasy-kicker">STANG INN · DIAGNOSE</p><h1>EliteProspects-posisjonsberikelse</h1><p className="fantasy-lead">Tester serverkall, HTML-parsing og matching lag for lag. HockeyLive-rosteren endres ikke.</p></div><a className="pill" href="/fantasy/diagnose/price-model-v4-1">← Prismodell v4.1</a></section>
    <section className="fantasy-card">
      <button disabled={busy} onClick={run}>{busy?'Tester …':'Kjør EP-diagnose'}</button> {err&&<span style={{color:'#b42318',fontWeight:700}}>{err}</span>}
      {d&&<>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,margin:'18px 0'}}>
          {[["Mangler før",d.beforeMissing],["Beriket",d.enriched],["Mangler etter",d.remaining],["Lag testet",d.diagnostics?.length||0]].map(([a,b]:any)=><div key={a} style={{padding:14,borderRadius:12,background:'#f5f7fa'}}><b>{a}</b><div style={{fontSize:24,fontWeight:900}}>{b}</div></div>)}
        </div>
        <h2>Lagdiagnose</h2>
        <div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:950,borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Lag','HTTP','HTML bytes','Spillerlenker','Parserte spillere','Beriket','Feil','URL'].map(h=><th key={h} style={{padding:8,textAlign:'left',background:'#eef3f8'}}>{h}</th>)}</tr></thead><tbody>{(d.diagnostics||[]).map((x:any)=><tr key={x.team}><td style={{padding:8,fontWeight:700}}>{x.team}</td><td>{x.status??'—'}</td><td>{x.htmlLength??'—'}</td><td>{x.playerAnchorCount??'—'}</td><td>{x.rosterParsed??'—'}</td><td>{x.enriched??0}</td><td>{x.error??'—'}</td><td style={{maxWidth:360,wordBreak:'break-all'}}>{x.url}</td></tr>)}</tbody></table></div>
        <h2 style={{marginTop:24}}>Fortsatt uten posisjon ({missing.length})</h2>
        <pre style={{whiteSpace:'pre-wrap',background:'#0b1220',color:'#e5e7eb',padding:14,borderRadius:12,overflowX:'auto'}}>{JSON.stringify(missing,null,2)}</pre>
        <h2 style={{marginTop:24}}>Rå positionEnrichment</h2>
        <pre style={{whiteSpace:'pre-wrap',background:'#0b1220',color:'#e5e7eb',padding:14,borderRadius:12,overflowX:'auto'}}>{JSON.stringify(d,null,2)}</pre>
      </>}
    </section>
  </main>
}
