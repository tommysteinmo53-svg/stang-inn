"use client";

import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";

export default function FantasyAdminPage(){
  const[allowed,setAllowed]=useState<boolean|null>(null),[message,setMessage]=useState("Sjekker admin-tilgang …"),[pending,setPending]=useState<number|null>(null);

  useEffect(()=>{(async()=>{
    try{
      const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");
      const{data}=await s.auth.getSession();const user=data.session?.user,token=data.session?.access_token;
      if(!user||!token){setAllowed(false);setMessage("Du må være logget inn");return}
      const{data:player,error}=await s.from("players").select("admin").eq("id",user.id).maybeSingle();
      if(error||!player?.admin){setAllowed(false);setMessage("Denne siden er bare for administrator");return}
      setAllowed(true);setMessage("Fantasy-admin aktiv");
      const res=await fetch("/api/admin/fantasy/player-queue",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      const body=await res.json();if(res.ok&&body.ok)setPending((body.rows||[]).filter((r:any)=>r.status==="pending").length);
    }catch(e:any){setAllowed(false);setMessage(e?.message||"Kunne ikke kontrollere admin-tilgang")}
  })()},[]);

  if(allowed===null)return <main className="appShell"><p className="muted">{message}</p></main>;
  if(!allowed)return <main className="appShell"><article className="panel"><h2>Ingen tilgang</h2><p className="muted">{message}</p><a href="/admin" className="textButton">← Adminoversikt</a></article></main>;

  const cards=[
    {href:"/admin/fantasy/player-queue",icon:"🆕",title:"Nye EHL-spillere",text:"Prisforslag V4.6, manuell kontroll og godkjenning av fast 2026/27-pris.",badge:pending==null?"Kø":`${pending} venter`},
    {href:"/admin/fantasy/tools",icon:"🔧",title:"Fantasy driftsverktøy",text:"Eksisterende adminverktøy for Fantasy/HockeyLive, roster og teknisk drift.",badge:"Admin"},
    {href:"/admin/fantasy/rounds",icon:"📅",title:"Fantasy-runder",text:"Administrasjon og kontroll av de kalenderbaserte fantasy-rundene.",badge:"45 runder"},
    {href:"/admin/fantasy/analysis",icon:"📊",title:"Analyseverktøy",text:"xFP, anbefalinger, optimal lag-generator og bytteassistent bygges og samles her.",badge:"Admin only"},
  ];

  return <main className="appShell">
    <header className="topbar"><div className="brand"><div className="brandMark">🏒</div><div><p className="eyebrow">ADMIN · FANTASYHOCKEY</p><h1>Fantasy-admin</h1></div></div><a href="/admin" className="textButton">← Adminoversikt</a></header>
    <section className="pageStack" style={{marginTop:24}}>
      <article className="heroCard"><div><p className="eyebrow">EHL Fantasy 2026/27</p><h2>Drift, spillere og analyse</h2><p className="muted">Alt som kun gjelder administrator for Fantasyhockey samles her. Vanlige spillersider og den globale Hockeytips ↔ Fantasy-bryteren er urørt.</p></div><span className="statusPill">✓ {message}</span></article>
      <div className="statsGrid" style={{alignItems:"stretch"}}>{cards.map(c=><a key={c.href} href={c.href} className="panel" style={{display:"block",textDecoration:"none",color:"inherit",minHeight:190}}><div className="panelHeading"><div><p className="eyebrow">{c.icon} FANTASY ADMIN</p><h3>{c.title}</h3></div><span className="statusPill">{c.badge}</span></div><p className="muted">{c.text}</p><div style={{marginTop:16,fontWeight:900}}>Åpne →</div></a>)}</div>
      <article className="panel"><div className="panelHeading"><div><p className="eyebrow">Ny-spiller-pipeline</p><h3>HockeyLive → admin → kjøpbar</h3></div><span className="statusPill">2026/27</span></div><p className="muted">Ny spiller importeres uten pris og er ikke kjøpbar. V4.6 forsøker prisforslag automatisk. Svakt datagrunnlag krever manuell kontroll. Først når admin godkjenner, låses sesongprisen og spilleren åpnes for nye kjøp.</p></article>
    </section>
  </main>;
}
