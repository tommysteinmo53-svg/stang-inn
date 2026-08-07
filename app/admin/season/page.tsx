"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase";

type Match = { id:number; home_team:string; away_team:string; match_time:string|null; round:number|null; home_score:number|null; away_score:number|null; finished:boolean; season:string|null };
type Form = { id?:number; home_team:string; away_team:string; match_time:string; round:string; home_score:string; away_score:string; finished:boolean; season:string };
const empty: Form = { home_team:"", away_team:"", match_time:"", round:"", home_score:"", away_score:"", finished:false, season:"2026/27" };

export default function SeasonAdminPage(){
  const [allowed,setAllowed]=useState<boolean|null>(null);
  const [matches,setMatches]=useState<Match[]>([]);
  const [form,setForm]=useState<Form>(empty);
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("");
  const [exact,setExact]=useState("5");
  const [outcome,setOutcome]=useState("3");
  const [announcement,setAnnouncement]=useState("");

  async function token(){ const s=getSupabaseBrowserClient(); if(!s)return null; const {data}=await s.auth.getSession(); return data.session?.access_token||null; }
  async function load(){
    const s=getSupabaseBrowserClient(); if(!s)return;
    const {data:session}=await s.auth.getSession(); const uid=session.session?.user.id; if(!uid){setAllowed(false);return;}
    const {data:p}=await s.from("players").select("admin").eq("id",uid).maybeSingle(); if(!p?.admin){setAllowed(false);return;} setAllowed(true);
    const [{data:m},{data:settings}] = await Promise.all([
      s.from("matches").select("id,home_team,away_team,match_time,round,home_score,away_score,finished,season").order("match_time",{ascending:true}),
      s.from("app_settings").select("value").eq("key","points").maybeSingle(),
    ]);
    setMatches((m||[]) as Match[]);
    if(settings?.value){ const v=settings.value as any; setExact(String(v.exact??5)); setOutcome(String(v.outcome??3)); }
  }
  useEffect(()=>{load();},[]);

  async function api(method:string, body:any){
    const t=await token(); if(!t)return {ok:false,error:"Ikke innlogget"};
    const r=await fetch("/api/admin/season",{method,headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
    return r.json();
  }

  async function saveMatch(){
    setStatus("Lagrer kamp …");
    const payload={...form, match_time: form.match_time ? new Date(form.match_time).toISOString() : null};
    const result=await api(form.id?"PATCH":"POST",payload);
    setStatus(result.ok?"✓ Kamp lagret.":`Feil: ${result.error}`);
    if(result.ok){setForm(empty);await load();}
  }
  function editMatch(m:Match){
    setForm({id:m.id,home_team:m.home_team,away_team:m.away_team,season:m.season||"2026/27",round:m.round==null?"":String(m.round),home_score:m.home_score==null?"":String(m.home_score),away_score:m.away_score==null?"":String(m.away_score),finished:m.finished,match_time:m.match_time?new Date(m.match_time).toISOString().slice(0,16):""});
    window.scrollTo({top:0,behavior:"smooth"});
  }
  async function removeMatch(m:Match){ if(!confirm(`Slette ${m.home_team} – ${m.away_team}?`))return; const r=await api("DELETE",{id:m.id}); setStatus(r.ok?"✓ Kamp slettet.":`Feil: ${r.error}`); if(r.ok)await load(); }
  async function recalc(){ const r=await api("POST",{action:"recalculate"}); setStatus(r.ok?`✓ Poeng beregnet. ${r.tipsChanged} tips oppdatert.`:`Feil: ${r.error}`); }
  async function savePoints(){ const r=await api("POST",{action:"save_points",exact:Number(exact),outcome:Number(outcome)}); setStatus(r.ok?"✓ Poengregler lagret og gamle tips beregnet på nytt.":`Feil: ${r.error}`); }
  async function sendAnnouncement(){ const r=await api("POST",{action:"announce",message:announcement}); setStatus(r.ok?"✓ Meldingen er sendt til appen.":`Feil: ${r.error}`); if(r.ok)setAnnouncement(""); }

  const visible=useMemo(()=>{const q=query.toLowerCase().trim();return matches.filter(m=>!q||`${m.home_team} ${m.away_team} ${m.round??""}`.toLowerCase().includes(q)).slice(0,80);},[matches,query]);
  if(allowed===null)return <main className="appShell"><p className="muted">Sjekker tilgang …</p></main>;
  if(!allowed)return <main className="appShell"><article className="panel"><h2>Ingen tilgang</h2></article></main>;

  return <main className="appShell">
    <header className="topbar"><a href="/admin" className="brand brandButton" style={{textDecoration:"none"}}><div className="brandMark">🏒</div><div><p className="eyebrow">Administrasjon</p><h1>Sesongdrift</h1></div></a><a href="/admin" className="textButton">← Admin</a></header>
    <section className="pageStack" style={{marginTop:24}}>
      {status&&<article className="quoteCard"><span>Status</span><p>{status}</p></article>}

      <article className="panel">
        <div className="panelHeading"><div><p className="eyebrow">Kamper</p><h3>{form.id?"Rediger kamp":"Opprett kamp manuelt"}</h3></div>{form.id&&<button className="textButton" onClick={()=>setForm(empty)}>Avbryt</button>}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
          <input className="matchSearch" placeholder="Hjemmelag" value={form.home_team} onChange={e=>setForm(v=>({...v,home_team:e.target.value}))}/>
          <input className="matchSearch" placeholder="Bortelag" value={form.away_team} onChange={e=>setForm(v=>({...v,away_team:e.target.value}))}/>
          <input className="matchSearch" type="datetime-local" value={form.match_time} onChange={e=>setForm(v=>({...v,match_time:e.target.value}))}/>
          <input className="matchSearch" type="number" placeholder="Runde" value={form.round} onChange={e=>setForm(v=>({...v,round:e.target.value}))}/>
          <input className="matchSearch" type="number" placeholder="Hjemmemål" value={form.home_score} onChange={e=>setForm(v=>({...v,home_score:e.target.value}))}/>
          <input className="matchSearch" type="number" placeholder="Bortemål" value={form.away_score} onChange={e=>setForm(v=>({...v,away_score:e.target.value}))}/>
        </div>
        <label style={{display:"flex",gap:8,alignItems:"center",marginTop:12}}><input type="checkbox" checked={form.finished} onChange={e=>setForm(v=>({...v,finished:e.target.checked}))}/> Ferdigspilt</label>
        <button className="compactButton" style={{marginTop:12}} onClick={saveMatch}>{form.id?"Lagre endringer":"Opprett kamp"}</button>
      </article>

      <section className="statsGrid">
        <article className="miniCard"><span>Kamper</span><strong>{matches.length}</strong><small>totalt</small></article>
        <article className="miniCard"><span>Ferdige</span><strong>{matches.filter(m=>m.finished).length}</strong><small>resultater</small></article>
        <article className="miniCard"><span>Runder</span><strong>{new Set(matches.map(m=>m.round).filter(Boolean)).size}</strong><small>registrert</small></article>
        <article className="miniCard"><span>Poeng</span><strong>{exact}/{outcome}</strong><small>eksakt / utfall</small></article>
      </section>

      <article className="panel">
        <div className="panelHeading"><div><p className="eyebrow">Poengmotor</p><h3>Poengregler</h3></div><button className="compactButton" onClick={recalc}>↻ Beregn alt på nytt</button></div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"end"}}>
          <label><small className="muted">Eksakt resultat</small><input className="matchSearch" type="number" min="0" value={exact} onChange={e=>setExact(e.target.value)} style={{display:"block",width:130}}/></label>
          <label><small className="muted">Riktig utfall</small><input className="matchSearch" type="number" min="0" value={outcome} onChange={e=>setOutcome(e.target.value)} style={{display:"block",width:130}}/></label>
          <button className="compactButton" onClick={savePoints}>Lagre regler</button>
        </div>
        <p className="muted" style={{marginTop:10}}>Krever at v0.7-admin-tools.sql er kjørt én gang i Supabase.</p>
      </article>

      <article className="panel">
        <div className="panelHeading"><div><p className="eyebrow">Beskjed</p><h3>Melding til alle brukere</h3></div></div>
        <textarea value={announcement} onChange={e=>setAnnouncement(e.target.value)} placeholder="F.eks. Husk å levere tips før kl. 18!" style={{width:"100%",minHeight:90,borderRadius:12,padding:12,background:"#0a1729",color:"white",border:"1px solid var(--line)"}}/>
        <button className="compactButton" style={{marginTop:10}} onClick={sendAnnouncement}>📢 Publiser melding</button>
      </article>

      <article className="panel">
        <div className="panelHeading"><div><p className="eyebrow">Terminliste</p><h3>Rediger kamper</h3></div><span className="statusPill">viser {visible.length}</span></div>
        <input className="matchSearch" style={{width:"100%",marginBottom:12}} placeholder="Søk lag eller runde …" value={query} onChange={e=>setQuery(e.target.value)}/>
        <div className="simpleList">{visible.map(m=><div key={m.id} style={{alignItems:"center"}}><span><b>{m.home_team} – {m.away_team}</b><small style={{display:"block"}}>{m.round?`Runde ${m.round} · `:""}{m.match_time?new Date(m.match_time).toLocaleString("no-NO"):"Tid ikke satt"}{m.finished?` · ${m.home_score}–${m.away_score}`:""}</small></span><span style={{display:"flex",gap:6}}><button className="compactButton" onClick={()=>editMatch(m)}>✏️</button><button className="textButton" onClick={()=>removeMatch(m)}>🗑️</button></span></div>)}</div>
      </article>
    </section>
  </main>;
}
