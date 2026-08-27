"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type Row = {
  player_id: string;
  display_name: string;
  points: number;
  exact: number;
  correct_outcome: number;
  scored_tips: number;
  hit_rate: number;
  streak: number;
  best_streak: number;
  standings_position: number;
};
type MatchStatus = { id: number; finished: boolean; match_time: string | null };
type Movement = Record<string, number>;

function medal(index: number) { if (index === 0) return "🥇"; if (index === 1) return "🥈"; if (index === 2) return "🥉"; return String(index + 1); }
function isLiveMatch(match: MatchStatus) { if (match.finished || !match.match_time) return false; const age = Date.now() - new Date(match.match_time).getTime(); return age >= 0 && age < 4 * 60 * 60 * 1000; }

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [matchStatus, setMatchStatus] = useState<MatchStatus[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [movement, setMovement] = useState<Movement>({});
  const [leaderNotice, setLeaderNotice] = useState<string | null>(null);
  const previousRanks = useRef<Map<string, number>>(new Map());
  const previousLeader = useRef<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowserClient(); if (!supabase) { setLoading(false); return; }
    const [{ data: sessionData }, board, matches] = await Promise.all([
      supabase.auth.getSession(),
      supabase.rpc("get_tipping_leaderboard_v1"),
      supabase.from("matches").select("id,finished,match_time"),
    ]);

    setCurrentUserId(sessionData.session?.user.id ?? null);
    if (board.error) console.error("Tipping leaderboard RPC failed", board.error);
    else setRows(((board.data || []) as Row[]).map((row) => ({
      ...row,
      points: Number(row.points || 0),
      exact: Number(row.exact || 0),
      correct_outcome: Number(row.correct_outcome || 0),
      scored_tips: Number(row.scored_tips || 0),
      hit_rate: Number(row.hit_rate || 0),
      streak: Number(row.streak || 0),
      best_streak: Number(row.best_streak || 0),
      standings_position: Number(row.standings_position || 0),
    })));
    if (matches.data) setMatchStatus(matches.data as MatchStatus[]);
    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(); const timer = window.setInterval(load, 30_000); return () => window.clearInterval(timer); }, [load]);

  const finishedCount = useMemo(() => matchStatus.filter(match => match.finished).length, [matchStatus]);
  const liveCount = useMemo(() => matchStatus.filter(isLiveMatch).length, [matchStatus, updatedAt]);

  useEffect(() => {
    if (!rows.length) return;
    const current = new Map(rows.map((row) => [row.player_id, row.standings_position]));
    if (previousRanks.current.size) {
      const nextMovement: Movement = {};
      rows.forEach((row) => { const oldRank = previousRanks.current.get(row.player_id); if (oldRank) nextMovement[row.player_id] = oldRank - row.standings_position; });
      setMovement(nextMovement);
      const newLeader = rows[0];
      if (previousLeader.current && previousLeader.current !== newLeader.player_id) { setLeaderNotice(`👑 ${newLeader.display_name} tok ledelsen!`); window.setTimeout(() => setLeaderNotice(null), 9000); }
    }
    previousRanks.current = current;
    previousLeader.current = rows[0]?.player_id ?? null;
  }, [rows]);

  const myRow = rows.find(row => row.player_id === currentUserId) ?? null;
  const leader = rows[0] ?? null;

  if (loading) return <main className="appShell"><p className="muted">Laster tabellen …</p></main>;

  return <main className="appShell leaderboardPage">
    <header className="topbar"><a className="brand brandButton" href="/" style={{ textDecoration: "none" }}><div className="brandMark">🏒</div><div><p className="eyebrow">EHL 2026/27</p><h1>Stang Inn</h1></div></a><a className="textButton" href="/" style={{ textDecoration: "none" }}>Til oversikten →</a></header>

    <section className="leaderboardIntro">
      <div>
        <p className="eyebrow">Stang Inn tipping</p>
        <h2>Tabell</h2>
        <p className="muted">Sammenlagtstillingen oppdateres når ferdigspilte kamper er scoret.</p>
      </div>
      <span className={`statusPill ${liveCount ? "leaderboardLivePill" : ""}`}>{liveCount ? `🟢 ${liveCount} kamp${liveCount === 1 ? "" : "er"} pågår` : `${finishedCount} kamper ferdigspilt`}</span>
    </section>

    <section className="leaderboardSummary" aria-label="Nøkkeltall">
      <article><span>👑 Leder</span><strong>{leader?.display_name ?? "–"}</strong><small>{leader ? `${leader.points} poeng` : "Sesongen har ikke startet"}</small></article>
      <article className="isMine"><span>📍 Din plass</span><strong>{myRow ? `${myRow.standings_position}.` : "–"}</strong><small>{myRow ? `${myRow.points} poeng · ${myRow.hit_rate}% treff` : "Ingen spillerprofil funnet"}</small></article>
      <article><span>🎯 Flest eksakte</span><strong>{rows.length ? Math.max(...rows.map(row => row.exact)) : 0}</strong><small>korrekte sluttresultat</small></article>
    </section>

    {leaderNotice && <article className="leaderboardLeaderNotice"><span>NY LEDER</span><strong>{leaderNotice}</strong></article>}

    <section className="competitionTable" aria-label="Sammenlagttabell">
      <div className="competitionTableTop">
        <div><p className="eyebrow">Sammenlagt</p><h3>Sesongtabell</h3></div>
        <a href="/live" className="textButton">Live-senter →</a>
      </div>
      <div className="competitionHead" aria-hidden="true"><span>#</span><span>↕</span><span>Spiller</span><span>Eksakte</span><span>Streak</span><span>Poeng</span></div>
      <div className="competitionRows">
        {rows.map((row,index) => {
          const move = movement[row.player_id] ?? 0;
          const movementLabel = move > 0 ? `▲ ${move}` : move < 0 ? `▼ ${Math.abs(move)}` : "–";
          return <a className={`competitionRow ${index < 3 ? `top${index + 1}` : ""} ${row.player_id === currentUserId ? "currentUser" : ""}`} href={`/player/${row.player_id}`} key={row.player_id}>
            <span className="competitionRank">{medal(index)}</span>
            <span className={`competitionMove ${move > 0 ? "up" : move < 0 ? "down" : "same"}`}>{movementLabel}</span>
            <span className="competitionPlayer"><b>{index === 0 ? "👑 " : ""}{row.display_name}{row.player_id === currentUserId ? <em>deg</em> : null}</b><small>{row.hit_rate}% treff · {row.scored_tips} avgjorte tips</small><small className="competitionMobileMeta">🎯 {row.exact} eksakte · 🔥 {row.streak}/{row.best_streak} · {movementLabel}</small></span>
            <span className="competitionStat">{row.exact}</span>
            <span className="competitionStat">{row.streak || row.best_streak ? `🔥 ${row.streak}/${row.best_streak}` : "–"}</span>
            <strong className="competitionPoints">{row.points}<small>p</small></strong>
          </a>;
        })}
        {rows.length === 0 && <p className="leaderboardEmpty">Ingen aktive spillere er registrert ennå.</p>}
      </div>
    </section>

    <section className="leaderboardRules">
      <div><span>Poeng</span><strong>5 / 3 / 0</strong></div>
      <p>Eksakt resultat gir 5 poeng, riktig kamputfall gir 3 og feil tips gir 0. Ved lik poengsum rangeres flest eksakte først.</p>
      <small>Sist oppdatert {updatedAt?.toLocaleTimeString("no-NO", { hour:"2-digit", minute:"2-digit" })}</small>
    </section>
  </main>;
}
