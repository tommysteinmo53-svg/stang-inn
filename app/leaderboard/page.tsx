"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type Player = { id: string; display_name: string };
type Tip = { id: number; player_id: string; match_id: number; points: number | null };
type Match = { id: number; finished: boolean; home_score: number | null; away_score: number | null; match_time: string | null };
type Row = Player & { points: number; exact: number; correctOutcome: number; scoredTips: number; hitRate: number; streak: number };

type Movement = Record<string, number>;

function medal(index: number) { if (index === 0) return "🥇"; if (index === 1) return "🥈"; if (index === 2) return "🥉"; return String(index + 1); }
function isLiveMatch(match: Match) { return !match.finished && !!match.match_time && Date.now() >= new Date(match.match_time).getTime(); }

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [movement, setMovement] = useState<Movement>({});
  const [leaderNotice, setLeaderNotice] = useState<string | null>(null);
  const previousRanks = useRef<Map<string, number>>(new Map());
  const previousLeader = useRef<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowserClient(); if (!supabase) { setLoading(false); return; }
    const [{ data: sessionData }, p, t, m] = await Promise.all([
      supabase.auth.getSession(),
      supabase.from("players").select("id,display_name").order("created_at"),
      supabase.from("tips").select("id,player_id,match_id,points"),
      supabase.from("matches").select("id,finished,home_score,away_score,match_time"),
    ]);
    setCurrentUserId(sessionData.session?.user.id ?? null);
    if (p.data) setPlayers(p.data as Player[]);
    if (t.data) setTips(t.data as Tip[]);
    if (m.data) setMatches(m.data as Match[]);
    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(); const timer = window.setInterval(load, 30_000); return () => window.clearInterval(timer); }, [load]);

  const finishedMatches = useMemo(() => matches
    .filter(m => m.finished || (m.home_score !== null && m.away_score !== null))
    .sort((a,b)=>(a.match_time || "").localeCompare(b.match_time || "")), [matches]);
  const finishedMatchIds = useMemo(() => new Set(finishedMatches.map(m => m.id)), [finishedMatches]);
  const liveCount = useMemo(() => matches.filter(isLiveMatch).length, [matches, updatedAt]);

  const rows = useMemo<Row[]>(() => players.map(player => {
    const scored = tips.filter(t => t.player_id === player.id && finishedMatchIds.has(t.match_id));
    const points = scored.reduce((sum, tip) => sum + Number(tip.points ?? 0), 0);
    const exact = scored.filter(t => Number(t.points ?? 0) === 5).length;
    const correctOutcome = scored.filter(t => Number(t.points ?? 0) === 3).length;
    const hits = exact + correctOutcome;
    const tipByMatch = new Map(scored.map(t => [t.match_id, t]));
    let streak = 0;
    for (let i = finishedMatches.length - 1; i >= 0; i--) {
      const tip = tipByMatch.get(finishedMatches[i].id);
      if (!tip || Number(tip.points ?? 0) <= 0) break;
      streak++;
    }
    return { ...player, points, exact, correctOutcome, scoredTips: scored.length, hitRate: scored.length ? Math.round((hits / scored.length) * 100) : 0, streak };
  }).sort((a,b) => b.points-a.points || b.exact-a.exact || b.correctOutcome-a.correctOutcome || a.display_name.localeCompare(b.display_name, "no")), [players, tips, finishedMatchIds, finishedMatches]);

  useEffect(() => {
    if (!rows.length) return;
    const current = new Map(rows.map((row, index) => [row.id, index + 1]));
    if (previousRanks.current.size) {
      const nextMovement: Movement = {};
      rows.forEach((row, index) => {
        const oldRank = previousRanks.current.get(row.id);
        if (oldRank) nextMovement[row.id] = oldRank - (index + 1);
      });
      setMovement(nextMovement);
      const newLeader = rows[0];
      if (previousLeader.current && previousLeader.current !== newLeader.id) {
        setLeaderNotice(`👑 ${newLeader.display_name} tok ledelsen!`);
        window.setTimeout(() => setLeaderNotice(null), 9000);
      }
    }
    previousRanks.current = current;
    previousLeader.current = rows[0]?.id ?? null;
  }, [rows]);

  if (loading) return <main className="appShell"><p className="muted">Laster tabellen …</p></main>;

  return <main className="appShell">
    <header className="topbar"><a className="brand brandButton" href="/" style={{ textDecoration: "none" }}><div className="brandMark">🏒</div><div><p className="eyebrow">EHL 2026/27</p><h1>Stang Inn</h1></div></a><a className="textButton" href="/" style={{ textDecoration: "none" }}>Til appen →</a></header>
    <section className="pageStack" style={{ marginTop: 24 }}>
      <div className="pageHeading"><div><p className="eyebrow">Ligaen</p><h2>{liveCount ? "🟢 Live-tabell" : "Sammenlagt"}</h2><p className="muted">Oppdateres automatisk hvert 30. sekund. Pilene viser endring siden forrige oppdatering.</p></div><span className="statusPill">{liveCount ? `${liveCount} live nå` : `${finishedMatchIds.size} ferdigspilt`}</span></div>

      {leaderNotice && <article className="quoteCard" style={{ borderColor: "rgba(245,196,81,.45)", background: "rgba(245,196,81,.08)" }}><span>NY LEDER</span><p><strong>{leaderNotice}</strong></p></article>}

      <article className="panel standings">
        <div className="tableHead" style={{ gridTemplateColumns: "48px 44px 1fr 64px 64px 64px" }}><span>#</span><span>↕</span><span>Spiller</span><span>🎯</span><span>🔥</span><span>Poeng</span></div>
        {rows.map((row,index) => {
          const move = movement[row.id] ?? 0;
          const movementLabel = move > 0 ? `▲ ${move}` : move < 0 ? `▼ ${Math.abs(move)}` : "–";
          const movementColor = move > 0 ? "#54dea8" : move < 0 ? "#ff7b8c" : "#8fa5bf";
          return <div className="tableRow" style={{ gridTemplateColumns: "48px 44px 1fr 64px 64px 64px", borderRadius: 12, background: index === 0 ? "rgba(245,196,81,.07)" : row.id === currentUserId ? "rgba(85,184,255,.08)" : undefined, boxShadow: index === 0 ? "inset 0 0 0 1px rgba(245,196,81,.12)" : undefined }} key={row.id}>
            <span className="rank" style={{ fontSize: index < 3 ? 22 : undefined }}>{medal(index)}</span>
            <span style={{ color: movementColor, fontSize: 11, fontWeight: 900 }}>{movementLabel}</span>
            <span><a href={`/player/${row.id}`} style={{ color: "inherit", textDecoration: "none" }}><b>{index === 0 ? "👑 " : ""}{row.display_name}{row.id === currentUserId ? " · deg" : ""}</b><small>{row.hitRate}% treff · {row.scoredTips} avgjorte tips · profil →</small></a></span>
            <span>{row.exact}</span>
            <span>{row.streak > 0 ? `🔥 ${row.streak}` : "–"}</span>
            <span className="points">{row.points}</span>
          </div>;
        })}
        {rows.length === 0 && <p className="muted">Ingen spillere er registrert ennå.</p>}
      </article>

      <article className="panel">
        <div className="panelHeading"><div><p className="eyebrow">Live-status</p><h3>{liveCount ? "Tabellen følger kampene" : "Venter på neste kamp"}</h3></div><span className="statusPill">30 sek</span></div>
        <p className="muted">Når HockeyLive-synken lagrer nye sluttresultater og poeng, oppdateres plassering, eksakte resultater og streak automatisk her.</p>
        <p className="muted" style={{ marginTop: 8 }}>Sist oppdatert: {updatedAt?.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
      </article>
    </section>
  </main>;
}
