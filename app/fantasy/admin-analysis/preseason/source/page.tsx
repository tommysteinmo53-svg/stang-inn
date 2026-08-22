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
type ManualPlayer={playerId:string;playerName:string;team:string;position:string|null;didPlay:boolean;goals:string;assists:string;shots:string;plusMinus:string;pim:string;saves:string;goalsAgainst:string;minutesPlayed:string;hasSavedData:boolean};
type ManualGame={homeTeam:string;awayTeam:string;homeScore:string|number;awayScore:string|number;homeShots:string|number;awayShots:string|number;sourceUrl:string};

function gameLabel(g:Game){const date=new Date(`${g.game_date}T12:00:00`).toLocaleDateString("nb-NO",{day:"2-digit",month:"2-digit"});return `${date} · ${g.home_team} – ${g.away_team}`}
const emptyGame:ManualGame={homeTeam:"",awayTeam:"",homeScore:"",awayScore:"",homeShots:"",awayShots:"",sourceUrl:""};

export default function ExternalPreseasonSourcePage(){
 const[token,setToken]=useState<string|null>(null),[games,setGames]=useState<Game[]>([]),[gameId,setGameId]=useState(""),[sourceUrl,setSourceUrl]=useState(""),[sourceLabel,setSourceLabel]=useState(""),[rawData,setRawData]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("Laster treningskamper …"),[parsed,setParsed]=useState<Parsed|null>(null);
 const[manualPlayers,setManualPlayers]=useState<ManualPlayer[]>([]),[manualGame,setManualGame]=useState<ManualGame>(emptyGame),[loadingRoster,setLoadingRoster]=useState(false);

 useEffect(()=>{(async()=>{try{const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");const{data}=await sb.auth.getSession();const access=data.session?.access_token;if(!access)throw new Error("Du må være logget inn");setToken(access);const{data:rows,error}=await sb.from("fantasy_preseason_games").select("id,game_date,starts_at,home_team,away_team,status,hockeylive_match_id,source_type,source_url").eq("season","2026/27").order("game_date").order("starts_at");if(error)throw error;setGames((rows||[]) as Game[]);setMessage(`${(rows||[]).length} treningskamper tilgjengelig`)}catch(e:any){setMessage(e?.message||"Kunne ikke laste treningskamper")}})()},[]);
 const selected=useMemo(()=>games.find(g=>String(g.id)===gameId)||null,[games,gameId]);

 useEffect(()=>{if(!token||!gameId){setManualPlayers([]);setManualGame(emptyGame);return}let cancelled=false;(async()=>{setLoadingRoster(true);try{const res=await fetch(`/api/admin/fantasy/preseason-external-source?gameId=${encodeURIComponent(gameId)}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke laste spillerliste");if(cancelled)return;setManualPlayers(body.players||[]);setManualGame(body.game||emptyGame);if(!sourceUrl.trim()&&body.game?.sourceUrl)setSourceUrl(body.game.sourceUrl);setMessage(`${(body.players||[]).length} registrerte spillere klare for manuell føring`)}catch(e:any){if(!cancelled)setMessage(e?.message||"Kunne ikke laste spillerliste")}finally{if(!cancelled)setLoadingRoster(false)}})();return()=>{cancelled=true}},[token,gameId]);

 function updatePlayer(playerId:string,key:keyof ManualPlayer,value:string|boolean){setManualPlayers(rows=>rows.map(row=>row.playerId===playerId?{...row,[key]:value}:row))}
 function updateGame(key:keyof ManualGame,value:string){setManualGame(current=>({...current,[key]:value}))}

 async function request(action:"preview"|"apply"|"save"){
  if(!token)return;if(!gameId){setMessage("Velg en treningskamp først.");return}if(!sourceUrl.trim()){setMessage("Legg inn kilde-URL.");return}if(action==="preview"&&!rawData.trim()){setMessage("Lim inn rå kampdata før analyse.");return}
  setBusy(true);setMessage(action==="preview"?"Analyserer rådata …":action==="apply"?"Importerer godkjente data …":"Lagrer ekstern kilde …");
  try{const res=await fetch("/api/admin/fantasy/preseason-external-source",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({action,gameId:Number(gameId),sourceUrl:sourceUrl.trim(),sourceLabel:sourceLabel.trim(),rawData:rawData.trim()}),cache:"no-store"});const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke behandle ekstern kilde");
   if(action==="preview"){setParsed(body.parsed||null);setMessage(body.parsed?`Analyse klar: ${body.parsed.matchedPlayers} EHL-spillere · ${body.parsed.goalEvents} målhendelseslinjer${body.parsed.score?` · resultat ${body.parsed.score.home}–${body.parsed.score.away}`:""}`:"Ingen data kunne parses.");return}
   if(action==="apply"){setParsed(body.parsed||parsed);setMessage(`✓ Importert ${Number(body.imported||0)} spillerlinjer til ${body.game}${body.parsed?.score?` · resultat ${body.parsed.score.home}–${body.parsed.score.away}`:""}`);return}
   setMessage(`✓ Lagret ${body.label} på ${body.game}`);
  }catch(e:any){setMessage(e?.message||"Kunne ikke behandle ekstern kilde")}finally{setBusy(false)}
 }

 async function saveManual(){
  if(!token||!gameId)return;if(!sourceUrl.trim()){setMessage("Legg inn kilde-URL før manuell lagring.");return}
  setBusy(true);setMessage("Lagrer manuell kampstatistikk …");
  try{
   const res=await fetch("/api/admin/fantasy/preseason-external-source",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({action:"manual",gameId:Number(gameId),sourceUrl:sourceUrl.trim(),sourceLabel:sourceLabel.trim(),homeScore:manualGame.homeScore,awayScore:manualGame.awayScore,homeShots:manualGame.homeShots,awayShots:manualGame.awayShots,players:manualPlayers}),cache:"no-store"});
   const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke lagre manuell kampstatistikk");
   setMessage(`✓ Lagret ${body.imported} spillerlinjer på ${body.game}. Tomme spillerrader ble ignorert.`);
  }catch(e:any){setMessage(e?.message||"Kunne ikke lagre manuell kampstatistikk")}finally{setBusy(false)}
 }

 return <main className="fantasy-shell xfp-command-center preseason-admin external-source-admin">
  <section className="xfp-command-hero"><p className="fantasy-kicker">STANG INN · ADMIN ANALYSE</p><h1>Ekstern preseason-kilde</h1><p>Knytt kilde og kampdata til riktig treningskamp. Du kan enten lime inn rådata eller registrere tilgjengelig statistikk manuelt.</p></section>

  <section className="xfp-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">PRESEASON 2026/27</p><h2>Velg kamp og kilde</h2><p>Spillerlisten lastes automatisk når du velger kamp. Manglende statistikk kan stå tom.</p></div><a className="xfp-secondary" href="/fantasy/admin-analysis/preseason" style={{textDecoration:"none"}}>← Preseason-form</a></div>
   <div className="external-source-grid">
    <label className="external-field external-field-wide"><span>Treningskamp</span><select value={gameId} onChange={e=>{setGameId(e.target.value);setParsed(null)}}><option value="">Velg kamp …</option>{games.map(g=><option key={g.id} value={g.id}>{gameLabel(g)}</option>)}</select></label>
    <label className="external-field"><span>Kilde-URL</span><input type="url" placeholder="https://…" value={sourceUrl} onChange={e=>{setSourceUrl(e.target.value);setParsed(null)}}/></label>
    <label className="external-field"><span>Kildenavn</span><input placeholder="f.eks. SweHockey, klubben eller Facebook" value={sourceLabel} onChange={e=>setSourceLabel(e.target.value)}/></label>
   </div>
   {selected&&<div className="external-selected"><strong>{selected.home_team} – {selected.away_team}</strong><span>{selected.hockeylive_match_id?`HockeyLive ${selected.hockeylive_match_id}`:"Ingen HockeyLive-ID"} · status {selected.status}</span></div>}
   <p className="preseason-message">{message}</p>
  </section>

  {selected&&<section className="xfp-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">MANUELL REGISTRERING</p><h2>Registrer det du faktisk har</h2><p>Alle registrerte EHL-spillere for valgt kamp vises. Huk av «Spilte» eller fyll inn minst ett felt for spillere du har data på. Helt tomme rader lagres ikke.</p></div></div>
   <div className="manual-game-grid">
    <label className="external-field"><span>{manualGame.homeTeam||selected.home_team} mål</span><input type="number" min="0" inputMode="numeric" value={manualGame.homeScore} onChange={e=>updateGame("homeScore",e.target.value)} placeholder="Ukjent"/></label>
    <label className="external-field"><span>{manualGame.awayTeam||selected.away_team} mål</span><input type="number" min="0" inputMode="numeric" value={manualGame.awayScore} onChange={e=>updateGame("awayScore",e.target.value)} placeholder="Ukjent"/></label>
    <label className="external-field"><span>{manualGame.homeTeam||selected.home_team} skudd</span><input type="number" min="0" inputMode="numeric" value={manualGame.homeShots} onChange={e=>updateGame("homeShots",e.target.value)} placeholder="Ukjent"/></label>
    <label className="external-field"><span>{manualGame.awayTeam||selected.away_team} skudd</span><input type="number" min="0" inputMode="numeric" value={manualGame.awayShots} onChange={e=>updateGame("awayShots",e.target.value)} placeholder="Ukjent"/></label>
   </div>
   {loadingRoster?<p className="preseason-message">Laster spillere …</p>:manualPlayers.length===0?<p className="preseason-message">Ingen registrerte EHL-spillere ble funnet for lagene i denne kampen.</p>:<div className="manual-player-wrap"><table className="manual-player-table"><thead><tr><th>Spilte</th><th>Spiller</th><th>Pos</th><th>M</th><th>A</th><th>Skudd</th><th>+/-</th><th>PIM</th><th>Redn.</th><th>Bakl.</th><th>Min.</th></tr></thead><tbody>{manualPlayers.map(p=><tr key={p.playerId} className={p.didPlay||p.hasSavedData?"manual-row-active":""}><td><input aria-label={`${p.playerName} spilte`} type="checkbox" checked={p.didPlay} onChange={e=>updatePlayer(p.playerId,"didPlay",e.target.checked)}/></td><td><strong>{p.playerName}</strong><small>{p.team}</small></td><td>{p.position||"—"}</td>{(["goals","assists","shots","plusMinus","pim","saves","goalsAgainst","minutesPlayed"] as const).map(key=><td key={key}><input aria-label={`${p.playerName} ${key}`} type="number" inputMode="decimal" value={p[key]} onChange={e=>updatePlayer(p.playerId,key,e.target.value)} placeholder=""/></td>)}</tr>)}</tbody></table></div>}
   <div className="preseason-actions"><button className="xfp-primary" disabled={busy||loadingRoster||!sourceUrl.trim()} onClick={saveManual}>{busy?"Lagrer …":"💾 Lagre manuell statistikk"}</button></div>
  </section>}

  <section className="xfp-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">VALGFRITT · RÅDATA</p><h2>Automatisk analyse av referat</h2><p>Har du et komplett referat kan du fortsatt lime det inn og bruke parseren. Manuell tabell over er best når kilden bare inneholder deler av statistikken.</p></div></div>
   <label className="external-field external-field-wide"><span>Rå kampdata / referat</span><textarea rows={12} placeholder="Lim inn lineup, Actions/Events, mål, assists, keeper summary eller annet dokumentert kampinnhold …" value={rawData} onChange={e=>{setRawData(e.target.value);setParsed(null)}}/></label>
   <div className="preseason-actions"><button className="xfp-primary" disabled={busy||!gameId||!sourceUrl.trim()||!rawData.trim()} onClick={()=>request("preview")}>{busy?"Arbeider …":"🔎 Analyser rådata"}</button><button className="xfp-secondary" disabled={busy||!gameId||!sourceUrl.trim()} onClick={()=>request("save")}>💾 Kun lagre kilde</button><a className="xfp-secondary" href="/fantasy/admin-analysis/preseason" style={{textDecoration:"none"}}>Avbryt</a></div>
  </section>

  {parsed&&<section className="xfp-panel">
   <div className="xfp-panel-head"><div><p className="eyebrow">PARSER v1 · FORHÅNDSVISNING</p><h2>Kontroller før import</h2><p>Kun sikre roster-treff skrives til preseason-data. Ukjente motstanderspillere ignoreres.</p></div></div>
   <div className="preseason-summary"><div><span>EHL-spillere funnet</span><strong>{parsed.matchedPlayers}</strong></div><div><span>Målhendelser</span><strong>{parsed.goalEvents}</strong></div><div><span>Resultat</span><strong>{parsed.score?`${parsed.score.home}–${parsed.score.away}`:"—"}</strong></div></div>
   {parsed.warnings?.map((w,i)=><p className="preseason-message" key={i}>⚠ {w}</p>)}
   {parsed.rows.length>0&&<div className="preseason-table-wrap"><table className="preseason-table"><thead><tr><th>Spiller</th><th>Lag</th><th>Pos</th><th>M</th><th>A</th><th>Redn.</th><th>Baklengs</th><th>Funnet data</th></tr></thead><tbody>{parsed.rows.map(r=><tr key={r.playerId}><td><strong>{r.playerName}</strong></td><td>{r.team}</td><td>{r.position||"—"}</td><td>{r.goals}</td><td>{r.assists}</td><td>{r.saves||"—"}</td><td>{r.goalsAgainst||"—"}</td><td>{r.knownFields.join(", ")}</td></tr>)}</tbody></table></div>}
   <div className="preseason-actions"><button className="xfp-primary" disabled={busy||parsed.rows.length===0} onClick={()=>request("apply")}>✅ Godkjenn og importer</button><button className="xfp-secondary" disabled={busy} onClick={()=>setParsed(null)}>Forkast forhåndsvisning</button></div>
  </section>}

  <section className="xfp-panel external-help"><p className="eyebrow">DATAPRINSIPP</p><h2>Ufullstendig er bedre enn oppdiktet</h2><p>Et tomt felt betyr «ikke registrert», ikke null. Bare spillerrader du markerer eller fyller ut blir lagret. Felter du lar stå tomme overskriver heller ikke tidligere registrert statistikk.</p></section>
 </main>;
}
