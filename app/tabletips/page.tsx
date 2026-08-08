"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type Player = { id: string; display_name: string };
type TableTip = { player_id: string; team: string; position: number };
type EhlStanding = { team: string; position: number; played: number; points: number; synced_at: string };
type Deviation = { player_id: string; team: string; predicted_position: number; actual_position: number; deviation: number };
type TableScore = { player_id: string; display_name: string; compared_teams: number; total_deviation: number; worst_deviation: number; exact_positions: number };

const defaultOrder = ["Storhamar", "Oilers", "Vålerenga", "Frisk Asker", "Sparta", "Narvik", "Stjernen", "Lillehammer", "Nidaros", "Ringerike"];

export default function TableTipsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [rows, setRows] = useState<TableTip[]>([]);
  const [order, setOrder] = useState<string[]>(defaultOrder);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [standings, setStandings] = useState<EhlStanding[]>([]);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [scores, setScores] = useState<TableScore[]>([]);

  async function load() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setLoading(false); return; }

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id || null;
    setMeId(uid);

    const [p, t, settings, s, d, sc] = await Promise.all([
      supabase.from("players").select("id,display_name").order("display_name"),
      supabase.from("table_tips").select("player_id,team,position").order("position"),
      supabase.from("app_settings").select("value").eq("key", "table_tips").maybeSingle(),
      supabase.from("ehl_standings").select("team,position,played,points,synced_at").eq("season", "2026/27").order("position"),
      supabase.from("table_tip_deviation").select("player_id,team,predicted_position,actual_position,deviation").order("predicted_position"),
      supabase.from("table_tip_scores").select("player_id,display_name,compared_teams,total_deviation,worst_deviation,exact_positions").order("total_deviation"),
    ]);

    setPlayers((p.data || []) as Player[]);
    const tableRows = (t.data || []) as TableTip[];
    setRows(tableRows);
    setStandings((s.data || []) as EhlStanding[]);
    setDeviations((d.data || []) as Deviation[]);
    setScores(((sc.data || []) as TableScore[]).filter(x => x.compared_teams > 0));

    const own = tableRows.filter(r => r.player_id === uid).sort((a,b) => a.position - b.position);
    if (own.length === 10) setOrder(own.map(r => r.team));

    const value = settings.data?.value as { deadline?: string | null } | undefined;
    const nextDeadline = value?.deadline || null;
    setDeadline(nextDeadline);
    setLocked(Boolean(nextDeadline && Date.now() >= new Date(nextDeadline).getTime()));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function move(index: number, direction: -1 | 1) {
    if (locked) return;
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setStatus("");
  }

  async function save() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !meId || locked || saving) return;
    setSaving(true);
    setStatus("Lagrer …");
    const { error } = await supabase.rpc("save_table_tip_rankings", { teams: order });
    setSaving(false);
    if (error) { setStatus(`Feil: ${error.message}`); return; }
    setStatus("✓ Tabelltipset er lagret.");
    await load();
  }

  const grouped = useMemo(() => players.map(player => ({
    player,
    tips: rows.filter(r => r.player_id === player.id).sort((a,b) => a.position - b.position),
  })), [players, rows]);

  const ownDeviation = useMemo(() => deviations.filter(d => d.player_id === meId).sort((a,b) => a.predicted_position - b.predicted_position), [deviations, meId]);
  const seasonStarted = useMemo(() => standings.some(s => s.played > 0), [standings]);

  if (loading) return <main className="appShell"><p className="muted">Laster tabelltips …</p></main>;

  return <main className="appShell">
    <header className="topbar">
      <a href="/" className="brand brandButton" style={{textDecoration:"none"}}><div className="brandMark">🏒</div><div><p className="eyebrow">EHL 2026/27</p><h1>Tabelltips</h1></div></a>
      <a href="/" className="textButton">← Hjem</a>
    </header>

    <section className="pageStack" style={{marginTop:24}}>
      <div className="pageHeading"><div><p className="eyebrow">Sesongkonkurranse</p><h2>Forventet sluttabell</h2><p className="muted">Lavest samlet plasseringsavvik er best. Andre spilleres tips åpnes automatisk etter fristen.</p></div><span className="statusPill">{locked ? "🔒 Låst" : "🟢 Åpent"}</span></div>
      {status && <article className="quoteCard"><span>Status</span><p>{status}</p></article>}

      <section className="contentGrid">
        <article className="panel">
          <div className="panelHeading"><div><p className="eyebrow">Mitt tips</p><h3>Min rangering</h3></div><span className="statusPill">{deadline ? `Frist ${new Date(deadline).toLocaleString("no-NO", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}` : "Frist ikke satt"}</span></div>
          <div className="rankingList">{order.map((team,i)=><div className="rankingItem" key={team} style={{display:"grid",gridTemplateColumns:"42px 1fr auto",gap:10,alignItems:"center"}}><span className="rank">{i+1}</span><strong>{team}</strong><span style={{display:"flex",gap:6}}><button className="compactButton" disabled={locked||i===0} onClick={()=>move(i,-1)}>↑</button><button className="compactButton" disabled={locked||i===order.length-1} onClick={()=>move(i,1)}>↓</button></span></div>)}</div>
          <button className="primaryButton" style={{marginTop:16}} disabled={!meId||locked||saving} onClick={save}>{locked ? "Tabelltipset er låst" : saving ? "Lagrer …" : "Lagre tabelltips"}</button>
        </article>

        <article className="panel">
          <div className="panelHeading"><div><p className="eyebrow">EHL akkurat nå</p><h3>Gjeldende tabell</h3></div><span className="statusPill">{standings.length}/10 lag</span></div>
          {standings.length === 0 ? <p className="muted">Venter på EHL-tabell. Når synken fyller standings-data, vises plassering og avvik automatisk her.</p> : <><div className="simpleList">{standings.map(s=><div key={s.team}><span><b>{s.position}.</b> {s.team}</span><span className="muted">{s.played} K · {s.points} p</span></div>)}</div>{!seasonStarted && <p className="muted" style={{marginTop:12}}>Sesongen har ikke startet ennå. Tabellen vises, men tabelltips-avvik og konkurransestilling aktiveres først når minst én EHL-kamp er spilt.</p>}</>}
        </article>
      </section>

      {standings.length > 0 && seasonStarted && <section className="contentGrid">
        <article className="panel">
          <div className="panelHeading"><div><p className="eyebrow">Mitt avvik</p><h3>Tips mot faktisk tabell</h3></div></div>
          {ownDeviation.length === 0 ? <p className="muted">Lagre et komplett tabelltips for å få beregnet avvik.</p> : <div className="simpleList">{ownDeviation.map(d=><div key={d.team}><span><b>{d.predicted_position}.</b> {d.team}</span><span>Faktisk {d.actual_position}. · avvik <b>{d.deviation}</b></span></div>)}</div>}
        </article>

        <article className="panel">
          <div className="panelHeading"><div><p className="eyebrow">Tabelltips-stilling</p><h3>Lavest avvik leder</h3></div></div>
          {scores.length === 0 ? <p className="muted">Ingen sammenlignbar score ennå.</p> : <div className="simpleList">{scores.map((score,i)=><div key={score.player_id}><span><b>{i+1}. {score.display_name}</b><small style={{display:"block"}}>{score.exact_positions} eksakte plasseringer · største bom {score.worst_deviation}</small></span><strong>{score.total_deviation}</strong></div>)}</div>}
          {!locked && <p className="muted" style={{marginTop:12}}>Før fristen viser RLS bare score basert på tabelltips du har lov til å se. Full konkurransestilling åpnes etter fristen.</p>}
        </article>
      </section>}

      {standings.length > 0 && !seasonStarted && <article className="panel"><div className="panelHeading"><div><p className="eyebrow">Tabelltips-stilling</p><h3>Sesongen har ikke startet</h3></div></div><p className="muted">Ingen avviksscore beregnes ennå. Når HockeyLive rapporterer minst én spilt kamp, aktiveres avvik per lag og tabelltips-stillingen automatisk.</p></article>}

      <article className="panel">
        <div className="panelHeading"><div><p className="eyebrow">Innsyn</p><h3>{locked ? "Alle tabelltips" : "Skjult frem til fristen"}</h3></div></div>
        {!locked && <p className="muted">Før fristen er de andre spillernes tabelltips skjult av databasen. Ingen kan snoke i rekkefølgen på forhånd.</p>}
        {locked && <div className="pageStack" style={{gap:12}}>{grouped.map(({player,tips})=><article className="quoteCard" key={player.id}><span>{player.display_name}</span>{tips.length===10 ? <div className="simpleList" style={{marginTop:8}}>{tips.map(t=><div key={`${player.id}-${t.team}`}><span><b>{t.position}.</b> {t.team}</span></div>)}</div> : <p className="muted">Ikke levert komplett tabelltips.</p>}</article>)}</div>}
      </article>
    </section>
  </main>;
}
