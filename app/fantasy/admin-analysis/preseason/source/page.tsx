"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../../lib/supabase";
import "../../../fantasy.css";
import "../../xfp-admin.css";
import "../preseason.css";
import "./source.css";

type Game={
  id:number;
  game_date:string;
  starts_at:string|null;
  home_team:string;
  away_team:string;
  status:string;
  hockeylive_match_id:number|null;
  source_type:string;
  source_url:string|null;
};

function gameLabel(g:Game){
  const date=new Date(`${g.game_date}T12:00:00`).toLocaleDateString("nb-NO",{day:"2-digit",month:"2-digit"});
  return `${date} · ${g.home_team} – ${g.away_team}`;
}

export default function ExternalPreseasonSourcePage(){
  const[token,setToken]=useState<string|null>(null);
  const[games,setGames]=useState<Game[]>([]);
  const[gameId,setGameId]=useState("");
  const[sourceUrl,setSourceUrl]=useState("");
  const[sourceLabel,setSourceLabel]=useState("");
  const[rawData,setRawData]=useState("");
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("Laster treningskamper …");

  useEffect(()=>{(async()=>{
    try{
      const sb=getSupabaseBrowserClient();
      if(!sb)throw new Error("Supabase er ikke tilgjengelig");
      const{data}=await sb.auth.getSession();
      const access=data.session?.access_token;
      if(!access)throw new Error("Du må være logget inn");
      setToken(access);
      const{data:rows,error}=await sb.from("fantasy_preseason_games")
        .select("id,game_date,starts_at,home_team,away_team,status,hockeylive_match_id,source_type,source_url")
        .eq("season","2026/27")
        .order("game_date")
        .order("starts_at");
      if(error)throw error;
      setGames((rows||[]) as Game[]);
      setMessage(`${(rows||[]).length} treningskamper tilgjengelig`);
    }catch(e:any){setMessage(e?.message||"Kunne ikke laste treningskamper")}
  })()},[]);

  const selected=useMemo(()=>games.find(g=>String(g.id)===gameId)||null,[games,gameId]);

  async function save(){
    if(!token)return;
    if(!gameId){setMessage("Velg en treningskamp først.");return}
    if(!sourceUrl.trim()){setMessage("Legg inn kilde-URL.");return}
    setBusy(true);setMessage("Lagrer ekstern kilde …");
    try{
      const res=await fetch("/api/admin/fantasy/preseason-external-source",{
        method:"POST",
        headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
        body:JSON.stringify({gameId:Number(gameId),sourceUrl:sourceUrl.trim(),sourceLabel:sourceLabel.trim(),rawData:rawData.trim()}),
        cache:"no-store"
      });
      const body=await res.json();
      if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke lagre ekstern kilde");
      setMessage(`✓ Lagret ${body.label} på ${body.game}${body.hasRawData?" · rå kampdata er med":""}`);
      setSourceUrl("");setSourceLabel("");setRawData("");
    }catch(e:any){setMessage(e?.message||"Kunne ikke lagre ekstern kilde")}
    finally{setBusy(false)}
  }

  return <main className="fantasy-shell xfp-command-center preseason-admin external-source-admin">
    <section className="xfp-command-hero">
      <p className="fantasy-kicker">STANG INN · ADMIN ANALYSE</p>
      <h1>Ekstern preseason-kilde</h1>
      <p>Knytt SweHockey, klubbsider eller andre dokumenterte kilder til riktig treningskamp.</p>
    </section>

    <section className="xfp-panel">
      <div className="xfp-panel-head">
        <div><p className="eyebrow">PRESEASON 2026/27</p><h2>Legg til kampkilde</h2><p>Velg kampen, lim inn kilden og legg gjerne inn kampreferat/statistikk i rådatafeltet.</p></div>
        <a className="xfp-secondary" href="/fantasy/admin-analysis/preseason" style={{textDecoration:"none"}}>← Preseason-form</a>
      </div>

      <div className="external-source-grid">
        <label className="external-field external-field-wide">
          <span>Treningskamp</span>
          <select value={gameId} onChange={e=>setGameId(e.target.value)}>
            <option value="">Velg kamp …</option>
            {games.map(g=><option key={g.id} value={g.id}>{gameLabel(g)}</option>)}
          </select>
        </label>

        <label className="external-field">
          <span>Kilde-URL</span>
          <input type="url" placeholder="https://…" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)}/>
        </label>

        <label className="external-field">
          <span>Kildenavn</span>
          <input placeholder="f.eks. SweHockey" value={sourceLabel} onChange={e=>setSourceLabel(e.target.value)}/>
        </label>

        <label className="external-field external-field-wide">
          <span>Rå kampdata / referat</span>
          <textarea rows={14} placeholder="Lim inn lineup, mål, assists, keeperstatistikk, skudd eller annet dokumentert kampinnhold …" value={rawData} onChange={e=>setRawData(e.target.value)}/>
        </label>
      </div>

      {selected&&<div className="external-selected"><strong>{selected.home_team} – {selected.away_team}</strong><span>{selected.hockeylive_match_id?`HockeyLive ${selected.hockeylive_match_id}`:"Ingen HockeyLive-ID"} · status {selected.status}</span></div>}

      <div className="preseason-actions">
        <button className="xfp-primary" disabled={busy||!gameId||!sourceUrl.trim()} onClick={save}>{busy?"Lagrer …":"💾 Lagre ekstern kilde"}</button>
        <a className="xfp-secondary" href="/fantasy/admin-analysis/preseason" style={{textDecoration:"none"}}>Avbryt</a>
      </div>
      <p className="preseason-message">{message}</p>
    </section>

    <section className="xfp-panel external-help">
      <p className="eyebrow">ARBEIDSFLYT</p>
      <h2>Hva skjer etter lagring?</h2>
      <p>Kilden knyttes til den valgte kampen og beholdes som dokumentasjon. Rådata lagres sammen med kilden slik at vi kan bygge parser/matching uten å gjette. Dette gjør ikke automatisk råtekst om til spillerstatistikk ennå.</p>
    </section>
  </main>;
}
