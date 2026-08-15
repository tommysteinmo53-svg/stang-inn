"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../../lib/supabase";
import "../../../fantasy.css";
import "../../xfp-admin.css";
import "../preseason.css";
import "./source.css";

type Game={id:number;game_date:string;starts_at:string|null;home_team:string;away_team:string;status:string;hockeylive_match_id:number|null;source_type:string;source_url:string|null};
type ParsedRow={playerId:string;playerName:string;team:string;position:string|null;didPlay:boolean;goals:number;assists:number;saves:number;goalsAgainst:number;knownFields:string[];evidence:string[]};
type Parsed={score:{home:number;away:number}|null;rows:ParsedRow[];matchedPlayers:number;goalEvents:number;confidence:string;warnings:string[]};

function gameLabel(g:Game){const date=new Date(`${g.game_date}T12:00:00`).toLocaleDateString("nb-NO",{day:"2-digit",month:"2-digit"});return `${date} · ${g.home_team} – ${g.away_team}`}

export default function ExternalPreseasonSourcePage(){
 const[token,setToken]=useState<string|null>(null),[games,setGames]=useState<Game[]>([]),[gameId,setGameId]=useState(""),[sourceUrl,setSourceUrl]=useState(""),[sourceLabel,setSourceLabel]=useState(""),[rawData,setRawData]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("Laster treningskamper …"),[parsed,setParsed]=useState<Parsed|null>(null);

 useEffect(()=>{(async()=>{try{const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");const{data}=await sb.auth.getSession();const access=data.session?.access_token;if(!access)throw new Error("Du må være logget inn");setToken(access);const{data:rows,error}=await sb.from("fantasy_preseason_games").select("id,game_date,starts_at,home_team,away_team,status,hockeylive_match_id,source_type,source_url").eq("season","2026/27").order("game_date").order("starts_at");if(error)throw error;setGames((rows||[]) as Game[]);setMessage(`${(rows||[]).length} treningskamper tilgjengelig`)}catch(e:any){setMessage(e?.message||"Kunne ikke laste treningskamper")}})()},[]);
 const selected=useMemo(()=>games.find(g=>String(g.id)===gameId)||null,[games,gameId]);

 async function request(action:"preview"|"apply"|"save"){
  if(!token)return;if(!gameId){setMessage("Velg en treningskamp først.");return}if(!sourceUrl.trim()){setMessage("Legg inn kilde-URL.");return}if(action==="preview"&&!rawData.trim()){setMessage("Lim inn rå kampdata før analyse.");return}
  setBusy(true);setMessage(action==="preview"?"Analyserer rådata …":action==="apply"?"Importerer godkjente data …":"Lagrer ekstern kilde …");
  try{const res=await fetch("/api/admin/fantasy/preseason-external-source",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({action,gameId:Number(gameId),sourceUrl:sourceUrl.trim(),sourceLabel:sourceLabel.trim(),rawData:rawData.trim()}),cache:"no-store"});const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke behandle ekstern kilde");
   if(action==="preview"){setParsed(body.parsed||null);setMessage(body.parsed?`Analyse klar: ${body.parsed.matchedPlayers} EHL-spillere · ${body.parsed.goalEvents} målhendelseslinjer${body.parsed.score?` · resultat ${body.parsed.score.home}–${body.parsed.score.away}`:""}`:"Ingen data kunne parses.");return}
   if(action==="apply"){setParsed(body.parsed||parsed);setMessage(`✓ Importert ${Number(body.imported||0)} spillerlinjer til ${body.game}${body.parsed?.score?` · resultat ${body.parsed.score.home}–${body.parsed.score.away}`:""}`);return}
   setMessage(`✓ Lagret ${body.label} på ${body.game}`);
  }catch(e:any){setMessage(e?.message||"Kunne ikke behandle ekstern kilde")}finally{setBusy(false)}
 }

 return <main className="fantasy-shell xfp-command-center preseason-admin external-source-admin">
  <section className="xfp-command-hero"><p className="fantasy-kicker">STANG INN · ADMIN ANALYSE</p><h1>Ekstern preseason-kilde</h1><p>Knytt SweHockey, klubbsider eller andre dokumenterte kilder til riktig treningskamp.</p></section>

  <section className="xfp-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">PRESEASON 2026/27</p><h2>Legg til kampkilde</h2><p>Lim inn dokumentert kampdata. Analyser først, kontroller treffene og godkjenn deretter importen.</p></div><a className="xfp-secondary" href="/fantasy/admin-analysis/preseason" style={{textDecoration:"none"}}>← Preseason-form</a></div>
   <div className="external-source-grid">
    <label className="external-field external-field-wide"><span>Treningskamp</span><select value={gameId} onChange={e=>{setGameId(e.target.value);setParsed(null)}}><option value="">Velg kamp …</option>{games.map(g=><option key={g.id} value={g.id}>{gameLabel(g)}</option>)}</select></label>
    <label className="external-field"><span>Kilde-URL</span><input type="url" placeholder="https://…" value={sourceUrl} onChange={e=>{setSourceUrl(e.target.value);setParsed(null)}}/></label>
    <label className="external-field"><span>Kildenavn</span><input placeholder="f.eks. SweHockey" value={sourceLabel} onChange={e=>setSourceLabel(e.target.value)}/></label>
    <label className="external-field external-field-wide"><span>Rå kampdata / referat</span><textarea rows={16} placeholder="Lim inn lineup, Actions/Events, mål, assists, keeper summary eller annet dokumentert kampinnhold …" value={rawData} onChange={e=>{setRawData(e.target.value);setParsed(null)}}/></label>
   </div>
   {selected&&<div className="external-selected"><strong>{selected.home_team} – {selected.away_team}</strong><span>{selected.hockeylive_match_id?`HockeyLive ${selected.hockeylive_match_id}`:"Ingen HockeyLive-ID"} · status {selected.status}</span></div>}
   <div className="preseason-actions"><button className="xfp-primary" disabled={busy||!gameId||!sourceUrl.trim()||!rawData.trim()} onClick={()=>request("preview")}>{busy?"Arbeider …":"🔎 Analyser rådata"}</button><button className="xfp-secondary" disabled={busy||!gameId||!sourceUrl.trim()} onClick={()=>request("save")}>💾 Kun lagre kilde</button><a className="xfp-secondary" href="/fantasy/admin-analysis/preseason" style={{textDecoration:"none"}}>Avbryt</a></div>
   <p className="preseason-message">{message}</p>
  </section>

  {parsed&&<section className="xfp-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">PARSER v1 · FORHÅNDSVISNING</p><h2>Kontroller før import</h2><p>Kun sikre roster-treff skrives til preseason-data. Ukjente motstanderspillere ignoreres.</p></div></div>
   <div className="preseason-summary"><div><span>EHL-spillere funnet</span><strong>{parsed.matchedPlayers}</strong></div><div><span>Målhendelser</span><strong>{parsed.goalEvents}</strong></div><div><span>Resultat</span><strong>{parsed.score?`${parsed.score.home}–${parsed.score.away}`:"—"}</strong></div></div>
   {parsed.warnings?.map((w,i)=><p className="preseason-message" key={i}>⚠ {w}</p>)}
   {parsed.rows.length>0&&<div className="preseason-table-wrap"><table className="preseason-table"><thead><tr><th>Spiller</th><th>Lag</th><th>Pos</th><th>M</th><th>A</th><th>Redn.</th><th>Baklengs</th><th>Funnet data</th></tr></thead><tbody>{parsed.rows.map(r=><tr key={r.playerId}><td><strong>{r.playerName}</strong></td><td>{r.team}</td><td>{r.position||"—"}</td><td>{r.goals}</td><td>{r.assists}</td><td>{r.saves||"—"}</td><td>{r.goalsAgainst||"—"}</td><td>{r.knownFields.join(", ")}</td></tr>)}</tbody></table></div>}
   <div className="preseason-actions"><button className="xfp-primary" disabled={busy||parsed.rows.length===0} onClick={()=>request("apply")}>✅ Godkjenn og importer</button><button className="xfp-secondary" disabled={busy} onClick={()=>setParsed(null)}>Forkast forhåndsvisning</button></div>
  </section>}

  <section className="xfp-panel external-help"><p className="eyebrow">ARBEIDSFLYT</p><h2>Hvordan parseren brukes</h2><p>1) Velg kamp og legg inn kilde. 2) Lim inn så komplett kamptekst som mulig, helst lineup + hendelser + keeper summary. 3) Trykk Analyser rådata. 4) Kontroller navn og poeng. 5) Godkjenn importen. Original kilde og evidens lagres sammen med spillerlinjene.</p></section>
 </main>;
}
