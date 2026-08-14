"use client";

import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import "../fantasy.css";

type Module={key:string;label:string;adminOnly:boolean};

const details:Record<string,string>={
  recommendations:"🔥 Kjøp · ⚠️ Selg · 👑 Kaptein · 💎 Differensial · 📈 Formspiller · 💰 Beste verdi",
  "expected-points":"Historikk · motstander · hjemme/borte · form · kampprogram · pris/verdi",
  optimizer:"Beste lag innen 100m · 2C/4W/4D/2G · senere 3–5 runders optimalisering",
  "transfer-assistant":"UT → INN-forslag · prisforskjell · forventet poenggevinst",
};

export default function AdminAnalysisPage(){
  const[status,setStatus]=useState("Kontrollerer admin-tilgang …");
  const[allowed,setAllowed]=useState<boolean|null>(null);
  const[modules,setModules]=useState<Module[]>([]);

  useEffect(()=>{(async()=>{
    try{
      const s=getSupabaseBrowserClient();
      if(!s)throw new Error("Supabase er ikke tilgjengelig");
      const{data}=await s.auth.getSession();
      const token=data.session?.access_token;
      if(!token)throw new Error("Du må være logget inn");
      const res=await fetch("/api/admin/fantasy/analysis-access",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      const body=await res.json();
      if(!res.ok||!body.ok){setAllowed(false);setStatus(body.error||"Ingen tilgang");return}
      setAllowed(true);setModules(body.modules||[]);setStatus("Admin-tilgang bekreftet på serveren");
    }catch(e:any){setAllowed(false);setStatus(e?.message||"Ingen tilgang")}
  })()},[]);

  if(allowed===null)return <main className="fantasy-shell"><section className="fantasy-card"><h1>Fantasy analyse</h1><p>{status}</p></section></main>;
  if(!allowed)return <main className="fantasy-shell"><section className="fantasy-card"><p className="eyebrow">ADMIN ONLY</p><h1>Ingen tilgang</h1><p>{status}</p><p>Denne siden og tilhørende API-er er beskyttet med server-side admin-kontroll.</p></section></main>;

  return <main className="fantasy-shell">
    <section className="fantasy-hero"><div><p className="fantasy-kicker">STANG INN · ADMIN ANALYSE</p><h1>Fantasy-kommandosenter</h1><p className="fantasy-lead">Private analyse- og beslutningsverktøy. Vanlige fantasyspillere får ikke tilgang til disse modellene eller API-ene.</p></div><div className="fantasy-status"><span className="status-dot"/>Admin verifisert</div></section>
    <section className="fantasy-grid">
      {modules.map(m=><article className="fantasy-card" key={m.key}><p className="eyebrow">ADMIN ONLY</p><h2>{m.label}</h2><p className="card-copy">{details[m.key]}</p><p><strong>Status:</strong> tilgangslaget er klart · modellen bygges i neste fase.</p></article>)}
    </section>
    <section className="fantasy-card"><h2>Tilgangsregel</h2><p>Alle fremtidige endepunkter for xFP, anbefalinger, optimalisering og bytteassistent skal bruke den felles server-guard-en <code>requireFantasyAdmin()</code>. Å skjule en knapp i nettleseren er ikke tilstrekkelig.</p><p><strong>{status}</strong></p></section>
  </main>;
}
