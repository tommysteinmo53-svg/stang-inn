"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import styles from "./page.module.css";

type Player = { id: string; display_name: string; email: string | null };
type Match = { id: number; home_team: string; away_team: string; match_time: string | null; home_score: number | null; away_score: number | null; finished: boolean; round: number | null };
type Tip = { player_id: string; match_id: number; home_tip: number; away_tip: number };
type Standing = Player & { points: number; exact: number; correct: number; tonight: number };

function outcome(home: number, away: number) {
  return home > away ? "H" : home < away ? "A" : "D";
}

function points(match: Match, tip?: Tip) {
  if (!tip || match.home_score === null || match.away_score === null) return 0;
  if (tip.home_tip === match.home_score && tip.away_tip === match.away_score) return 5;
  return outcome(tip.home_tip, tip.away_tip) === outcome(match.home_score, match.away_score) ? 3 : 0;
}

function localDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
}

function formatTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" });
}

function buildStandings(players: Player[], matches: Match[], tips: Tip[], gameDate: string): Standing[] {
  const scoreable = matches.filter(m => m.home_score !== null && m.away_score !== null);
  return players.map(player => {
    const playerTips = new Map(tips.filter(t => t.player_id === player.id).map(t => [t.match_id, t]));
    let total = 0;
    let exact = 0;
    let correct = 0;
    let tonight = 0;
    for (const match of scoreable) {
      const p = points(match, playerTips.get(match.id));
      total += p;
      if (p === 5) exact++;
      if (p > 0) correct++;
      if (localDate(match.match_time) === gameDate) tonight += p;
    }
    return { ...player, points: total, exact, correct, tonight };
  }).sort((a, b) => b.points - a.points || b.exact - a.exact || b.correct - a.correct || a.display_name.localeCompare(b.display_name));
}

export default function LivePage() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [movement, setMovement] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const standingsRef = useRef<Standing[]>([]);

  const gameDate = useMemo(() => {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
    const todayMatches = matches.filter(m => localDate(m.match_time) === today);
    if (todayMatches.length) return today;
    const dates = [...new Set(matches.filter(m => m.home_score !== null && m.away_score !== null).map(m => localDate(m.match_time)).filter(Boolean))].sort();
    return dates.at(-1) || today;
  }, [matches]);

  const load = useCallback(async (silent = false) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    if (silent) setRefreshing(true);

    const [p, m, t] = await Promise.all([
      supabase.from("players").select("id,display_name,email").order("created_at"),
      supabase.from("matches").select("id,home_team,away_team,match_time,home_score,away_score,finished,round").order("match_time"),
      supabase.from("tips").select("player_id,match_id,home_tip,away_tip"),
    ]);

    const players = (p.data || []) as Player[];
    const nextMatches = (m.data || []) as Match[];
    const nextTips = (t.data || []) as Tip[];
    const osloToday = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
    const dates = [...new Set(nextMatches.filter(x => x.home_score !== null && x.away_score !== null).map(x => localDate(x.match_time)).filter(Boolean))].sort();
    const activeDate = nextMatches.some(x => localDate(x.match_time) === osloToday) ? osloToday : (dates.at(-1) || osloToday);
    const nextStandings = buildStandings(players, nextMatches, nextTips, activeDate);

    if (standingsRef.current.length) {
      const oldRanks = new Map(standingsRef.current.map((x, i) => [x.id, i + 1]));
      const nextMovement: Record<string, number> = {};
      nextStandings.forEach((x, i) => {
        const old = oldRanks.get(x.id);
        if (old) nextMovement[x.id] = old - (i + 1);
      });
      setMovement(nextMovement);
    }

    standingsRef.current = nextStandings;
    setStandings(nextStandings);
    setMatches(nextMatches);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const gameNightMatches = useMemo(() => matches.filter(m => localDate(m.match_time) === gameDate), [matches, gameDate]);
  const scoreMatches = gameNightMatches.filter(m => m.home_score !== null && m.away_score !== null);
  const pendingMatches = gameNightMatches.filter(m => m.home_score === null || m.away_score === null);
  const dateLabel = gameDate ? new Date(`${gameDate}T12:00:00`).toLocaleDateString("no-NO", { weekday: "long", day: "numeric", month: "long" }) : "kampkveld";

  if (loading) return <main className={styles.shell}><p className={styles.muted}>Laster live-tabellen …</p></main>;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.back} href="/">← Stang Inn</a>
        <div className={styles.liveBadge}><span /> LIVE</div>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Kampkveld · {dateLabel}</p>
          <h1>Live-tabell</h1>
          <p className={styles.muted}>Oppdateres automatisk hvert 30. sekund fra resultatene som ligger i Stang Inn.</p>
        </div>
        <button className={styles.refresh} onClick={() => load(true)} disabled={refreshing}>{refreshing ? "Oppdaterer …" : "↻ Oppdater nå"}</button>
      </section>

      <section className={styles.summary}>
        <article><span>Kamper</span><strong>{gameNightMatches.length}</strong><small>{scoreMatches.length} med resultat</small></article>
        <article><span>Leder</span><strong>{standings[0]?.display_name || "–"}</strong><small>{standings[0]?.points ?? 0} poeng</small></article>
        <article><span>Kveldens beste</span><strong>{[...standings].sort((a,b)=>b.tonight-a.tonight)[0]?.display_name || "–"}</strong><small>+{[...standings].sort((a,b)=>b.tonight-a.tonight)[0]?.tonight ?? 0} i kveld</small></article>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Sammenlagt</p><h2>Stilling akkurat nå</h2></div><span className={styles.updated}>{lastUpdated ? `Oppdatert ${lastUpdated.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</span></div>
          <div className={styles.tableHead}><span>#</span><span>Spiller</span><span>I kveld</span><span>Poeng</span></div>
          {standings.map((player, index) => {
            const move = movement[player.id] || 0;
            return <div className={styles.row} key={player.id}>
              <span className={styles.rank}>{index + 1}</span>
              <span className={styles.player}><b>{player.display_name}</b><small>{player.exact} eksakte · {player.correct} riktige</small></span>
              <span className={styles.tonight}>+{player.tonight}</span>
              <span className={styles.total}>{player.points}</span>
              <span className={`${styles.move} ${move > 0 ? styles.up : move < 0 ? styles.down : ""}`}>{move > 0 ? `▲ ${move}` : move < 0 ? `▼ ${Math.abs(move)}` : "—"}</span>
            </div>;
          })}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Kamper</p><h2>Kampkvelden</h2></div><span className={styles.updated}>{pendingMatches.length} venter</span></div>
          <div className={styles.matchList}>
            {gameNightMatches.length === 0 && <p className={styles.muted}>Ingen kamper på valgt kampdato.</p>}
            {gameNightMatches.map(match => <div className={styles.match} key={match.id}>
              <div><small>{formatTime(match.match_time)}{match.round ? ` · Runde ${match.round}` : ""}</small><b>{match.home_team} – {match.away_team}</b></div>
              <strong>{match.home_score !== null && match.away_score !== null ? `${match.home_score}–${match.away_score}` : "–"}</strong>
            </div>)}
          </div>
        </article>
      </section>

      <p className={styles.note}>Live-tabellen kan bare endre seg når nye resultater er synkronisert inn fra HockeyLive. Neste steg er derfor automatisk EHL-synk på kampkvelder.</p>
    </main>
  );
}
