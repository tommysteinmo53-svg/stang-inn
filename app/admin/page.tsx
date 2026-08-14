"use client";

import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../lib/supabase";

export default function AdminHubPage(){
  const[allowed,setAllowed]=useState<boolean|null>(null);
  const[message,setMessage]=useState("Sjekker admin-tilgang …");

  useEffect(()=>{(async()=>{
    try{
      const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");
      const{data}=await s.auth.getSession();const user=data.session?.user;if(!user){setAllowed(false);setMessage("Du må være logget inn");return}
      const{data:player,error}=await s.from("players").select("admin").eq("id",user.id).maybeSingle();
      if(error||!player?.admin){setAllowed(false);setMessage("Denne siden er bare for administrator");return}
      setAllowed(true);setMessage("Admin-tilgang bekreftet");
    }catch(e:any){setAllowed(false);setMessage(e?.message||"Kunne ikke kontrollere admin-tilgang")}
  })()},[]);

  if(allowed===null)return <main className="appShell"><p className="muted">{message}</p></main>;
  if(!allowed)return <main className="appShell"><article className="panel"><h2>Ingen tilgang</h2><p className="muted">{message}</p><a href="/" className="textButton">← Tilbake til Stang Inn</a></article></main>;

  return <main className="appShell">
    <header className="topbar"><div className="brand"><div className="brandMark">🛠️</div><div><p className="eyebrow">ADMIN ONLY</p><h1>Stang Inn · Admin</h1></div></div><a href="/" className="textButton">Til appen →</a></header>
    <section className="pageStack" style={{marginTop:24}}>
      <article className="heroCard"><div><p className="eyebrow">Kommandosenter</p><h2>Alt adminarbeid samlet på ett sted</h2><p className="muted">Fantasyhockey og Hockeytipset er skilt i hver sin del, mens felles innlogging og administratorrolle beholdes.</p></div><span className="statusPill">✓ {message}</span></article>

      <div className="statsGrid" style={{alignItems:"stretch"}}>
        <a href="/admin/fantasy" className="panel" style={{display:"block",textDecoration:"none",color:"inherit",minHeight:220}}>
          <p className="eyebrow">🏒 FANTASYHOCKEY</p><h2>Fantasy-admin</h2>
          <p className="muted">Nye EHL-spillere, prisgodkjenning, roster/synk, runder, diagnose og private analyseverktøy.</p>
          <div style={{marginTop:18,fontWeight:900}}>Åpne Fantasy-admin →</div>
        </a>
        <a href="/admin/hockeytips" className="panel" style={{display:"block",textDecoration:"none",color:"inherit",minHeight:220}}>
          <p className="eyebrow">🎯 HOCKEYTIPSET</p><h2>Hockeytips-admin</h2>
          <p className="muted">Terminliste/resultater, HockeyLive-synk, manuell kampkorrigering, brukere og synkhistorikk.</p>
          <div style={{marginTop:18,fontWeight:900}}>Åpne Hockeytips-admin →</div>
        </a>
      </div>

      <article className="panel"><div className="panelHeading"><div><p className="eyebrow">Felles prinsipp</p><h3>Én adminrolle · to spill</h3></div><span className="statusPill">Admin only</span></div><p className="muted">Begge delene bruker den samme Supabase-innloggingen og eksisterende <code>players.admin</code>-rolle. Dette endrer ikke vanlig Hockeytips ↔ Fantasy-bryter for spillerne.</p></article>
    </section>
  </main>;
}
