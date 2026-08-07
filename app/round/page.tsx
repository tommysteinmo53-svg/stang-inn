"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type Player = { id: string; display_name: string };
type Match = { id: number; home_team: string; away_team: string; match_time: string | null; home_score: number | null; away_score: number | null; finished: boolean; round: number | null };
type Tip = { id: number; player_id: string; match_id: number; home_tip: number; away_tip: number; points: number | null };
type RoundRow = Player & { points: number; exact: number; correctOutcome: number; tipped: number };

function hasStarted(match: Match) { return match.finished || (!!match.match_time && Date.now() >= new Date(match.match_time).getTime()); }
function isLive(match: Match) { return !match.finished && !!match.match_time && Date.now() >= new Date(match.match_time).getTime(); }
function fmt(value: string | null) { if (!value) return "Tidspunkt ikke satt"; return new Date(value).toLocaleString("no-NO", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function statusText(match: Match) { if (match.finished && match.home_score !== null && match.away_score !== null) return `Slutt ${match.home_score}–${match.away_score}`; if (isLive(match)) { if (match.home_score !== null && match.away_score !== null) return `🟢 LIVE ${match.home_score}–${match.away_score}`; return "🟢 LIVE"; } return fmt(match.match_time); }
function featured(match: Match) { return `${match.home_team} ${match.away_team}`.toLowerCase().includes("narvik"); }

export default function RoundPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowserClient(); if (!supabase) { setLoading(false); return; }
    const { data: session } = await supabase.auth.getSession(); setMeId(session.session?.user.id || null);
    const [p,m,t] = await Promise.all([
      supabase.from("players").select("id,display_name").order("created_at"),
      supabase.from("matches").select("id,home_team,away_team,match_time,home_score,away_score,finished,round").order("match_time"),
      supabase.from("tips").select("id,player_id,match_id,home_tip,away_tip,points"),
    ]);
    setPlayers((p.data || []) as Player[]); setMatches((m.data || []) as Match[]); setTips((t.data || []) as Tip[]); setUpdatedAt(new Date()); setLoading(false);
  }, []);

  useEffect(() => { load(); const timer = window.setInterval(load, 30_000); return () => window.clearInterval(timer); }, [load]);

  const rounds = useMemo(() => [...new Set(matches.map(m => m.round).filter((r): r is number => r !== null))].sort((a,b)=>a-b), [matches]);
  useEffect(() => { if (selectedRound !== null || rounds.length === 0) return; const now = Date.now(); const active = matches.find(m => m.round !== null && !!m.match_time && !m.finished && new Date(m.match_time).getTime() <= now); const next = matches.find(m => m.round !== null && (!m.match_time || new Date(m.match_time).getTime() >= now)); setSelectedRound(active?.round ?? next?.round ?? rounds[0]); }, [rounds,matches,selectedRound]);

  const roundMatches = useMemo(() => matches.filter(m => m.round === selectedRound).sort((a,b) => { const priority = (m: Match) => featured(m) ? 0 : isLive(m) ? 1 : m.finished ? 3 : 2; return priority(a)-priority(b) || (a.match_time || "").localeCompare(b.match_time || ""); }), [matches,selectedRound,updatedAt]);
  const roundMatchIds = useMemo(() => new Set(roundMatches.map(m => m.id)), [roundMatches]);
  const roundRows = useMemo<RoundRow[]>(() => players.map(player => {
    const playerTips = tips.filter(t => t.player_id === player.id && roundMatchIds.has(t.match_id));
    const scored = playerTips.filter(t => roundMatches.find(m => m.id === t.match_id)?.finished);
    return { ...player, points: scored.reduce((sum,t)=>sum+Number(t.points ?? 0),0), exact: scored.filter(t=>Number(t.points ?? 0)===5).length, correctOutcome: scored.filter(t=>Number(t.points ?? 0)===3).length, tipped: playerTips.length };
  }).sort((a,b)=>b.points-a.points || b.exact-a.exact || b.correctOutcome-a.correctOutcome || a.display_name.localeCompare(b.display_name,"no")), [players,tips,roundMatchIds,roundMatches]);

  const liveMatches = roundMatches.filter(isLive); const leader = roundRows[0]; const completedCount = roundMatches.filter(m=>m.finished).length;
  if (loading) return <main className="appShell"><p className="muted">Laster runden …</p></main>;

  return <main className="appShell">
    <header className="topbar"><a href="/" className="brand brandButton" style={{ textDecoration: "none" }}><div className="brandMark">🏒</div><div><p className="eyebrow">EHL 2026/27</p><h1>Runde</h1></div></a><a href="/" className="textButton" style={{ textDecoration: "none" }}>Til appen →</a></header>
    <section className="pageStack" style={{ marginTop: 24 }}>
      <article className="heroCard"><div><p className="eyebrow">Rundeoversikt</p><h2>{selectedRound !== null ? `Runde ${selectedRound}` : "Velg runde"}</h2><p className="muted">Oppdateres automatisk hvert 30. sekund. Alle tips blir synlige når den enkelte kampen starter.</p></div><div className="countdown"><strong>{liveMatches.length ? `🟢 ${liveMatches.length}` : completedCount}</strong><span>{liveMatches.length ? "live nå" : `${completedCount}/${roundMatches.length} ferdig`}</span></div></article>
      <select className="roundSelect" value={selectedRound ?? ""} onChange={e=>setSelectedRound(Number(e.target.value))} style={{ width: "100%", maxWidth: 320 }}>{rounds.map(r=><option value={r} key={r}>Runde {r}</option>)}</select>
      {leader && <article className="quoteCard"><span>{liveMatches.length ? "🟢 LIVE-RUNDELEDER" : "🏆 RUNDELEDER"}</span><p><a href={`/player/${leader.id}`} style={{ color: "inherit", fontWeight: 900 }}><strong>{leader.display_name}</strong></a> leder med {leader.points} poeng{leader.exact ? ` og ${leader.exact} eksakte` : ""}.</p></article>}
      <article className="panel standings">
        <div className="panelHeading"><div><p className="eyebrow">Rundetabell</p><h3>Poeng denne runden</h3></div><span className="statusPill">{updatedAt ? `Oppdatert ${updatedAt.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" })}` : ""}</span></div>
        <div className="tableHead" style={{ gridTemplateColumns: "42px 1fr 70px 70px" }}><span>#</span><span>Spiller</span><span>Eksakt</span><span>Poeng</span></div>
        {roundRows.map((row,i)=><div className="tableRow" style={{ gridTemplateColumns: "42px 1fr 70px 70px" }} key={row.id}><span className="rank">{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</span><span><a href={`/player/${row.id}`} style={{ color: "inherit", textDecoration: "none" }}><b>{row.display_name}{row.id===meId?" · deg":""}</b><small>{row.tipped}/{roundMatches.length} tips levert · profil →</small></a></span><span>{row.exact}</span><span className="points">{row.points}</span></div>)}
      </article>
      {roundMatches.map(match => {
        const matchTips = tips.filter(t=>t.match_id===match.id); const visible = hasStarted(match); const isFeatured = featured(match); const live = isLive(match);
        return <article className="panel" key={match.id} style={isFeatured ? { border: "1px solid rgba(245,196,81,.55)", boxShadow: "0 0 0 1px rgba(245,196,81,.08) inset" } : live ? { border: "1px solid rgba(79,214,156,.45)" } : undefined}>
          <div className="panelHeading"><div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>{isFeatured&&<span className="statusPill">⭐ Rundens kamp</span>}{live&&<span className="delivery complete">🟢 LIVE</span>}</div><small className="muted">{statusText(match)}</small><h3 style={{ marginTop: 6 }}>{match.home_team} – {match.away_team}</h3></div><a href={`/match/${match.id}`} className="textButton" style={{ textDecoration: "none" }}>Kampside →</a></div>
          {!visible ? <div className="quoteCard"><span>Tips skjult</span><p>🔒 Andre spilleres tips blir synlige ved kampstart.</p></div> : <div className="simpleList">{players.map(player => { const tip = matchTips.find(t=>t.player_id===player.id); const exact = match.finished && Number(tip?.points ?? 0)===5; const correct = match.finished && Number(tip?.points ?? 0)===3; return <div key={player.id} style={exact ? { background: "rgba(245,196,81,.08)", borderRadius: 10, paddingInline: 8 } : undefined}><span>{exact?"🎯 ":correct?"✓ ":""}<a href={`/player/${player.id}`} style={{ color: "inherit", textDecoration: "none" }}>{player.display_name}{player.id===meId?" · deg":""}</a></span><strong>{tip ? `${tip.home_tip}–${tip.away_tip}${match.finished ? ` · +${Number(tip.points ?? 0)} p${exact ? " · EKSAKT" : ""}` : ""}` : "Ikke levert"}</strong></div>; })}</div>}
        </article>;
      })}
      {roundMatches.length===0&&<article className="panel emptyState"><strong>Ingen kamper i denne runden.</strong></article>}
    </section>
  </main>;
}
