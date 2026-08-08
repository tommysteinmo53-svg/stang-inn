"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type Player = { id: string; display_name: string };
type TableTip = { player_id: string; team: string; position: number };

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

  async function load() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setLoading(false); return; }

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id || null;
    setMeId(uid);

    const [p, t, settings] = await Promise.all([
      supabase.from("players").select("id,display_name").order("display_name"),
      supabase.from("table_tips").select("player_id,team,position").order("position"),
      supabase.from("app_settings").select("value").eq("key", "table_tips").maybeSingle(),
    ]);

    setPlayers((p.data || []) as Player[]);
    const tableRows = (t.data || []) as TableTip[];
    setRows(tableRows);

    const own = tableRows.filter(r => r.player_id === uid).sort((a,b) => a.position - b.position);
    if (own.length === 10) setOrder(own.map(r => r.team));

    const value = settings.data?.value as { deadline?: string | null } | undefined;
    const d = value?.deadline || null;
    setDeadline(d);
    setLocked(Boolean(d && Date.now() >= new Date(d).getTime()));
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

  if (loading) return <main className="appShell"><p className="muted">Laster tabelltips …</p></main>;

  return <main className="appShell">
    <header className="topbar">
      <a href="/" className="brand brandButton" style={{textDecoration:"none"}}>
        <div className="brandMark">🏒</div><div><p className="eyebrow">EHL 2026/27</p><h1>Tabelltips</h1></div>
      </a>
      <a href="/" className="textButton">← Hjem</a>
    </header>

    <section className="pageStack" style={{marginTop:24}}>
      <div className="pageHeading"><div><p className="eyebrow">Sesongkonkurranse</p><h2>Forventet sluttabell</h2><p className="muted">Ranger lagene 1–10. Andre spilleres tips åpnes automatisk etter fristen.</p></div><span className="statusPill">{locked ? "🔒 Låst" : "🟢 Åpent"}</span></div>

      {status && <article className="quoteCard"><span>Status</span><p>{status}</p></article>}

      <section className="contentGrid">
        <article className="panel">
          <div className="panelHeading"><div><p className="eyebrow">Mitt tips</p><h3>Min rangering</h3></div><span className="statusPill">{deadline ? `Frist ${new Date(deadline).toLocaleString("no-NO", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}` : "Frist ikke satt"}</span></div>
          <div className="rankingList">{order.map((team,i)=><div className="rankingItem" key={team} style={{display:"grid",gridTemplateColumns:"42px 1fr auto",gap:10,alignItems:"center"}}><span className="rank">{i+1}</span><strong>{team}</strong><span style={{display:"flex",gap:6}}><button className="compactButton" disabled={locked||i===0} onClick={()=>move(i,-1)}>↑</button><button className="compactButton" disabled={locked||i===order.length-1} onClick={()=>move(i,1)}>↓</button></span></div>)}</div>
          <button className="primaryButton" style={{marginTop:16}} disabled={!meId||locked||saving} onClick={save}>{locked ? "Tabelltipset er låst" : saving ? "Lagrer …" : "Lagre tabelltips"}</button>
        </article>

        <article className="panel">
          <div className="panelHeading"><div><p className="eyebrow">Innsyn</p><h3>{locked ? "Alle tabelltips" : "Skjult frem til fristen"}</h3></div></div>
          {!locked && <p className="muted">Før fristen er de andre spillernes tabelltips skjult av databasen. Ingen kan snoke i rekkefølgen på forhånd.</p>}
          {locked && <div className="pageStack" style={{gap:12}}>{grouped.map(({player,tips})=><article className="quoteCard" key={player.id}><span>{player.display_name}</span>{tips.length===10 ? <div className="simpleList" style={{marginTop:8}}>{tips.map(t=><div key={`${player.id}-${t.team}`}><span><b>{t.position}.</b> {t.team}</span></div>)}</div> : <p className="muted">Ikke levert komplett tabelltips.</p>}</article>)}</div>}
        </article>
      </section>
    </section>
  </main>;
}
