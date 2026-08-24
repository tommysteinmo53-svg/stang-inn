"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type Player = { id: string; display_name: string };
type TableTip = { player_id: string; team: string; position: number };
type EhlStanding = { team: string; position: number; played: number; points: number; synced_at: string };
type Deviation = { player_id: string; team: string; predicted_position: number; actual_position: number; deviation: number };
type TableScore = { player_id: string; display_name: string; compared_teams: number; total_deviation: number; worst_deviation: number; exact_positions: number };

const defaultOrder = ["Storhamar", "Oilers", "Vålerenga", "Frisk Asker", "Sparta", "Narvik", "Stjernen", "Lillehammer", "Nidaros", "Ringerike"];

function formatShortDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("no-NO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function TableTipsPage() {
  const [players, setPlayers] = useState<Player[]>([]), [meId, setMeId] = useState<string | null>(null), [rows, setRows] = useState<TableTip[]>([]), [order, setOrder] = useState<string[]>(defaultOrder), [deadline, setDeadline] = useState<string | null>(null), [locked, setLocked] = useState(false), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [status, setStatus] = useState(""), [standings, setStandings] = useState<EhlStanding[]>([]), [deviations, setDeviations] = useState<Deviation[]>([]), [scores, setScores] = useState<TableScore[]>([]);

  async function load() {
    const supabase = getSupabaseBrowserClient(); if (!supabase) { setLoading(false); return; }
    const { data: sessionData } = await supabase.auth.getSession(); const uid = sessionData.session?.user.id || null; setMeId(uid);
    const [p, t, settings, s, d, sc] = await Promise.all([
      supabase.from("players").select("id,display_name").order("display_name"), supabase.from("table_tips").select("player_id,team,position").order("position"), supabase.from("app_settings").select("value").eq("key", "table_tips").maybeSingle(), supabase.from("ehl_standings").select("team,position,played,points,synced_at").eq("season", "2026/27").order("position"), supabase.from("table_tip_deviation").select("player_id,team,predicted_position,actual_position,deviation").order("predicted_position"), supabase.from("table_tip_scores").select("player_id,display_name,compared_teams,total_deviation,worst_deviation,exact_positions").order("total_deviation")]);
    setPlayers((p.data || []) as Player[]); const tableRows = (t.data || []) as TableTip[]; setRows(tableRows); setStandings((s.data || []) as EhlStanding[]); setDeviations((d.data || []) as Deviation[]); setScores(((sc.data || []) as TableScore[]).filter(x => x.compared_teams > 0));
    const own = tableRows.filter(r => r.player_id === uid).sort((a,b) => a.position - b.position); if (own.length === 10) setOrder(own.map(r => r.team));
    const value = settings.data?.value as { deadline?: string | null } | undefined; const nextDeadline = value?.deadline || null; setDeadline(nextDeadline); setLocked(Boolean(nextDeadline && Date.now() >= new Date(nextDeadline).getTime())); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function move(index: number, direction: -1 | 1) { if (locked) return; const target = index + direction; if (target < 0 || target >= order.length) return; const next = [...order]; [next[index], next[target]] = [next[target], next[index]]; setOrder(next); setStatus(""); }
  async function save() { const supabase = getSupabaseBrowserClient(); if (!supabase || !meId || locked || saving) return; setSaving(true); setStatus("Lagrer …"); const { error } = await supabase.rpc("save_table_tip_rankings", { teams: order }); setSaving(false); if (error) { setStatus(`Feil: ${error.message}`); return; } setStatus("✓ Tabelltipset er lagret."); await load(); }

  const grouped = useMemo(() => players.map(player => ({ player, tips: rows.filter(r => r.player_id === player.id).sort((a,b) => a.position - b.position) })), [players, rows]);
  const ownDeviation = useMemo(() => deviations.filter(d => d.player_id === meId).sort((a,b) => a.predicted_position - b.predicted_position), [deviations, meId]);
  const ownSavedCount = useMemo(() => rows.filter(r => r.player_id === meId).length, [rows, meId]);
  const seasonStarted = useMemo(() => standings.some(s => s.played > 0), [standings]);
  const lastSynced = standings.length ? standings.map(s => s.synced_at).sort().at(-1) || null : null;
  const ownScore = scores.find(s => s.player_id === meId) || null;
  const leader = scores[0] || null;

  if (loading) return <main className="appShell"><p className="muted">Laster tabelltips …</p></main>;
  return <main className="appShell tableTipsPage"><header className="topbar"><a href="/" className="brand brandButton" style={{textDecoration:"none"}}><div className="brandMark">🏒</div><div><p className="eyebrow">EHL 2026/27</p><h1>Tabelltips</h1></div></a><a href="/" className="textButton">← Hjem</a></header>
    <section className="pageStack tableTipsStack" style={{marginTop:24}}>
      <article className={`heroCard tableTipsHero ${locked?"locked":"open"}`}><div><p className="eyebrow">Sesongkonkurranse</p><h2>{locked ? "Tabelltipset er låst" : ownSavedCount===10 ? "Tabelltipset ditt er klart ✓" : "Sett din EHL-tabell"}</h2><p className="muted">Ranger alle 10 lag. Når sesongen starter vinner lavest samlet plasseringsavvik.</p></div><div className="countdown"><strong>{locked?"🔒":`${ownSavedCount}/10`}</strong><span>{locked?"fristen er passert":"lag lagret"}</span></div></article>
      <div className="tableTipsSummary"><article className="miniCard"><span>Frist</span><strong>{deadline ? formatShortDate(deadline) : "Ikke satt"}</strong><small>{locked?"Låst":"Kan endres frem til fristen"}</small></article><article className="miniCard"><span>Din status</span><strong>{ownSavedCount===10?"Levert ✓":"Ikke komplett"}</strong><small>{ownSavedCount}/10 plasseringer lagret</small></article><article className="miniCard"><span>{seasonStarted?"Din score":"EHL-status"}</span><strong>{seasonStarted&&ownScore?ownScore.total_deviation:seasonStarted?"–":"Før start"}</strong><small>{seasonStarted&&ownScore?`${ownScore.exact_positions} eksakte`:"Avvik aktiveres etter første kamp"}</small></article></div>
      {status && <article className={`quoteCard tableTipsStatus ${status.startsWith("✓")?"success":""}`}><span>Status</span><p>{status}</p></article>}

      <section className="contentGrid tableTipsMainGrid">
        <article className="panel tableTipEditor"><div className="panelHeading"><div><p className="eyebrow">Mitt tips</p><h3>Forventet sluttabell</h3></div><span className={`statusPill ${ownSavedCount===10?"complete":""}`}>{ownSavedCount===10?"✓ Lagret":"Ikke lagret"}</span></div><p className="muted tableTipHelp">Bruk pilene for å flytte lag. <b>1.</b> er laget du tror vinner serien.</p>
          <div className="rankingList tableTipRanking">{order.map((team,i)=><div className={`rankingItem tableTipRankingItem ${i<3?`podium podium${i+1}`:""}`} key={team}><span className="rank">{i+1}</span><div className="tableTipTeam"><strong>{team}</strong>{i===0&&<small>Seriemester</small>}</div><div className="tableTipMoveButtons"><button disabled={locked||i===0} onClick={()=>move(i,-1)} aria-label={`Flytt ${team} opp`}>↑</button><button disabled={locked||i===order.length-1} onClick={()=>move(i,1)} aria-label={`Flytt ${team} ned`}>↓</button></div></div>)}</div>
          <button className="primaryButton tableTipSave" disabled={!meId||locked||saving} onClick={save}>{locked?"🔒 Tabelltipset er låst":saving?"Lagrer …":ownSavedCount===10?"Lagre endringer":"Lagre tabelltips"}</button>{!locked&&<p className="muted tableTipSaveHint">Du kan endre og lagre på nytt helt frem til fristen.</p>}
        </article>

        <article className="panel currentEhlTable"><div className="panelHeading"><div><p className="eyebrow">EHL akkurat nå</p><h3>Gjeldende tabell</h3></div><span className="statusPill">{standings.length}/10 lag</span></div>
          {standings.length===0?<p className="muted">Venter på EHL-tabell. Når synken fyller standings-data, vises den automatisk her.</p>:<><div className="ehlStandingList">{standings.map(s=><div className="ehlStandingRow" key={s.team}><span className="rank">{s.position}</span><strong>{s.team}</strong><span>{s.played} K</span><b>{s.points} p</b></div>)}</div><p className="muted tableSync">{lastSynced?`Sist synket ${formatShortDate(lastSynced)}`:""}</p>{!seasonStarted&&<p className="muted">Tabelltips-score aktiveres automatisk når minst én EHL-kamp er spilt.</p>}</>}
        </article>
      </section>

      {standings.length>0&&seasonStarted&&<section className="contentGrid tableTipsCompareGrid"><article className="panel"><div className="panelHeading"><div><p className="eyebrow">Mitt avvik</p><h3>Tips mot faktisk tabell</h3></div>{ownScore&&<span className="statusPill">Totalt {ownScore.total_deviation}</span>}</div>{ownDeviation.length===0?<p className="muted">Lagre et komplett tabelltips for å få beregnet avvik.</p>:<div className="deviationList">{ownDeviation.map(d=><div className={`deviationRow ${d.deviation===0?"exact":""}`} key={d.team}><span><b>{d.predicted_position}.</b> {d.team}</span><span>Faktisk {d.actual_position}. <b>{d.deviation===0?"✓":`±${d.deviation}`}</b></span></div>)}</div>}</article>
        <article className="panel"><div className="panelHeading"><div><p className="eyebrow">Tabelltips-stilling</p><h3>Lavest avvik leder</h3></div>{leader&&<span className="statusPill">Leder: {leader.display_name}</span>}</div>{scores.length===0?<p className="muted">Ingen sammenlignbar score ennå.</p>:<div className="tableTipsScoreList">{scores.map((score,i)=><div className={`tableTipsScoreRow ${score.player_id===meId?"isMe":""}`} key={score.player_id}><span className="rank">{i+1}</span><span><b>{score.display_name}</b><small>{score.exact_positions} eksakte · største bom {score.worst_deviation}</small></span><strong>{score.total_deviation}</strong></div>)}</div>}{!locked&&<p className="muted tableTipPrivacy">Full konkurransestilling åpnes etter fristen. Databasen håndhever innsynsreglene frem til da.</p>}</article></section>}

      {standings.length>0&&!seasonStarted&&<article className="panel"><div className="panelHeading"><div><p className="eyebrow">Tabelltips-stilling</p><h3>Konkurransen starter med serien</h3></div></div><p className="muted">Ingen avviksscore beregnes ennå. Når første EHL-kamp er spilt, aktiveres avvik og tabelltips-stillingen automatisk.</p></article>}
      <article className="panel tableTipsPrivacy"><div className="panelHeading"><div><p className="eyebrow">Innsyn</p><h3>{locked?"Alle tabelltips":"Tipsene er hemmelige"}</h3></div><span className="statusPill">{locked?"Åpent innsyn":"🔐 Privat"}</span></div>{!locked&&<p className="muted">Før fristen ser hver spiller bare sitt eget tabelltips. Etter fristen åpnes alle innleverte tips automatisk.</p>}{locked&&<div className="pageStack" style={{gap:12}}>{grouped.map(({player,tips})=><article className="quoteCard" key={player.id}><span>{player.display_name}</span>{tips.length===10?<div className="simpleList" style={{marginTop:8}}>{tips.map(t=><div key={`${player.id}-${t.team}`}><span><b>{t.position}.</b> {t.team}</span></div>)}</div>:<p className="muted">Ikke levert komplett tabelltips.</p>}</article>)}</div>}</article>
    </section>
  </main>;
}
