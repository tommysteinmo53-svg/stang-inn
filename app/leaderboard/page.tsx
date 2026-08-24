"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type Player = { id: string; display_name: string };
type Tip = { id: number; player_id: string; match_id: number; home_tip: number; away_tip: number; points: number | null };
type Match = { id: number; finished: boolean; home_score: number | null; away_score: number | null; match_time: string | null };
type Row = Player & { points: number; exact: number; correctOutcome: number; scoredTips: number; hitRate: number; streak: number; bestStreak: number };
type Movement = Record<string, number>;

function medal(index: number) { if (index === 0) return "🥇"; if (index === 1) return "🥈"; if (index === 2) return "🥉"; return String(index + 1); }
function isFinishedMatch(match: Match) { return match.finished && match.home_score !== null && match.away_score !== null; }
function isLiveMatch(match: Match) { if (match.finished || !match.match_time) return false; const age = Date.now() - new Date(match.match_time).getTime(); return age >= 0 && age < 4 * 60 * 60 * 1000; }
function outcome(home:number,away:number){return home>away?"H":home<away?"A":"D";}
function resolvedPoints(match:Match,tip:Tip){
  if(tip.points!==null)return Number(tip.points);
  if(match.home_score===null||match.away_score===null)return 0;
  if(tip.home_tip===match.home_score&&tip.away_tip===match.away_score)return 5;
  return outcome(tip.home_tip,tip.away_tip)===outcome(match.home_score,match.away_score)?3:0;
}

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
      supabase.from("tips").select("id,player_id,match_id,home_tip,away_tip,points"),
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

  const finishedMatches = useMemo(() => matches.filter(isFinishedMatch).sort((a,b)=>(a.match_time || "").localeCompare(b.match_time || "")), [matches]);
  const finishedMatchIds = useMemo(() => new Set(finishedMatches.map(m => m.id)), [finishedMatches]);
  const matchMap = useMemo(() => new Map(finishedMatches.map(m=>[m.id,m])),[finishedMatches]);
  const liveCount = useMemo(() => matches.filter(isLiveMatch).length, [matches, updatedAt]);

  const rows = useMemo<Row[]>(() => players.map(player => {
    const scored = tips.filter(t => t.player_id === player.id && finishedMatchIds.has(t.match_id));
    const values = scored.map(t=>{const m=matchMap.get(t.match_id);return m?resolvedPoints(m,t):0});
    const points = values.reduce((sum, value) => sum + value, 0);
    const exact = values.filter(value => value === 5).length;
    const correctOutcome = values.filter(value => value === 3).length;
    const hits = values.filter(value=>value>0).length;
    const tipByMatch = new Map(scored.map(t => [t.match_id, t]));
    let currentStreak = 0, bestStreak = 0;
    for (const match of finishedMatches) {
      const tip = tipByMatch.get(match.id);
      if (tip && resolvedPoints(match,tip) > 0) { currentStreak++; bestStreak=Math.max(bestStreak,currentStreak); }
      else currentStreak=0;
    }
    return { ...player, points, exact, correctOutcome, scoredTips: scored.length, hitRate: scored.length ? Math.round((hits / scored.length) * 100) : 0, streak: currentStreak, bestStreak };
  }).sort((a,b) => b.points-a.points || b.exact-a.exact || b.correctOutcome-a.correctOutcome || a.display_name.localeCompare(b.display_name, "no")), [players, tips, finishedMatchIds, finishedMatches, matchMap]);

  useEffect(() => {
    if (!rows.length) return;
    const current = new Map(rows.map((row, index) => [row.id, index + 1]));
    if (previousRanks.current.size) {
      const nextMovement: Movement = {};
      rows.forEach((row, index) => { const oldRank = previousRanks.current.get(row.id); if (oldRank) nextMovement[row.id] = oldRank - (index + 1); });
      setMovement(nextMovement);
      const newLeader = rows[0];
      if (previousLeader.current && previousLeader.current !== newLeader.id) { setLeaderNotice(`👑 ${newLeader.display_name} tok ledelsen!`); window.setTimeout(() => setLeaderNotice(null), 9000); }
    }
    previousRanks.current = current;
    previousLeader.current = rows[0]?.id ?? null;
  }, [rows]);

  const myIndex = rows.findIndex(row => row.id === currentUserId);
  const myRow = myIndex >= 0 ? rows[myIndex] : null;
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
      <span className={`statusPill ${liveCount ? "leaderboardLivePill" : ""}`}>{liveCount ? `🟢 ${liveCount} kamp${liveCount === 1 ? "" : "er"} pågår` : `${finishedMatchIds.size} kamper ferdigspilt`}</span>
    </section>

    <section className="leaderboardSummary" aria-label="Nøkkeltall">
      <article><span>👑 Leder</span><strong>{leader?.display_name ?? "–"}</strong><small>{leader ? `${leader.points} poeng` : "Sesongen har ikke startet"}</small></article>
      <article className="isMine"><span>📍 Din plass</span><strong>{myRow ? `${myIndex + 1}.` : "–"}</strong><small>{myRow ? `${myRow.points} poeng · ${myRow.hitRate}% treff` : "Ingen spillerprofil funnet"}</small></article>
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
          const move = movement[row.id] ?? 0;
          const movementLabel = move > 0 ? `▲ ${move}` : move < 0 ? `▼ ${Math.abs(move)}` : "–";
          return <a className={`competitionRow ${index < 3 ? `top${index + 1}` : ""} ${row.id === currentUserId ? "currentUser" : ""}`} href={`/player/${row.id}`} key={row.id}>
            <span className="competitionRank">{medal(index)}</span>
            <span className={`competitionMove ${move > 0 ? "up" : move < 0 ? "down" : "same"}`}>{movementLabel}</span>
            <span className="competitionPlayer"><b>{index === 0 ? "👑 " : ""}{row.display_name}{row.id === currentUserId ? <em>deg</em> : null}</b><small>{row.hitRate}% treff · {row.scoredTips} avgjorte tips</small><small className="competitionMobileMeta">🎯 {row.exact} eksakte · 🔥 {row.streak}/{row.bestStreak} · {movementLabel}</small></span>
            <span className="competitionStat">{row.exact}</span>
            <span className="competitionStat">{row.streak || row.bestStreak ? `🔥 ${row.streak}/${row.bestStreak}` : "–"}</span>
            <strong className="competitionPoints">{row.points}<small>p</small></strong>
          </a>;
        })}
        {rows.length === 0 && <p className="leaderboardEmpty">Ingen spillere er registrert ennå.</p>}
      </div>
    </section>

    <section className="leaderboardRules">
      <div><span>Poeng</span><strong>5 / 3 / 0</strong></div>
      <p>Eksakt resultat gir 5 poeng, riktig kamputfall gir 3 og feil tips gir 0. Ved lik poengsum rangeres flest eksakte først.</p>
      <small>Sist oppdatert {updatedAt?.toLocaleTimeString("no-NO", { hour:"2-digit", minute:"2-digit" })}</small>
    </section>
  </main>;
}
