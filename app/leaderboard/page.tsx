"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type Player = {
  id: string;
  display_name: string;
};

type Tip = {
  id: number;
  player_id: string;
  match_id: number;
  points: number | null;
};

type Match = {
  id: number;
  finished: boolean;
  home_score: number | null;
  away_score: number | null;
};

type Row = Player & {
  points: number;
  exact: number;
  correctOutcome: number;
  scoredTips: number;
  hitRate: number;
};

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const [p, t, m] = await Promise.all([
      supabase.from("players").select("id,display_name").order("created_at"),
      supabase.from("tips").select("id,player_id,match_id,points"),
      supabase.from("matches").select("id,finished,home_score,away_score"),
    ]);

    if (p.data) setPlayers(p.data as Player[]);
    if (t.data) setTips(t.data as Tip[]);
    if (m.data) setMatches(m.data as Match[]);
    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const finishedMatchIds = useMemo(
    () => new Set(matches.filter(m => m.finished || (m.home_score !== null && m.away_score !== null)).map(m => m.id)),
    [matches],
  );

  const rows = useMemo<Row[]>(() => {
    return players
      .map(player => {
        const scored = tips.filter(t => t.player_id === player.id && finishedMatchIds.has(t.match_id));
        const points = scored.reduce((sum, tip) => sum + Number(tip.points ?? 0), 0);
        const exact = scored.filter(t => Number(t.points ?? 0) === 5).length;
        const correctOutcome = scored.filter(t => Number(t.points ?? 0) === 3).length;
        const hits = exact + correctOutcome;
        return {
          ...player,
          points,
          exact,
          correctOutcome,
          scoredTips: scored.length,
          hitRate: scored.length ? Math.round((hits / scored.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.points - a.points || b.exact - a.exact || b.correctOutcome - a.correctOutcome || a.display_name.localeCompare(b.display_name, "no"));
  }, [players, tips, finishedMatchIds]);

  if (loading) {
    return <main className="appShell"><p className="muted">Laster tabellen …</p></main>;
  }

  return (
    <main className="appShell">
      <header className="topbar">
        <a className="brand brandButton" href="/" style={{ textDecoration: "none" }}>
          <div className="brandMark">🏒</div>
          <div><p className="eyebrow">EHL 2026/27</p><h1>Stang Inn</h1></div>
        </a>
        <a className="textButton" href="/" style={{ textDecoration: "none" }}>Til appen →</a>
      </header>

      <section className="pageStack" style={{ marginTop: 24 }}>
        <div className="pageHeading">
          <div>
            <p className="eyebrow">Poengmotor</p>
            <h2>Sammenlagt</h2>
            <p className="muted">Poengene leses direkte fra <code>tips.points</code> og oppdateres automatisk.</p>
          </div>
          <span className="statusPill">{matches.filter(m => m.finished).length} ferdigspilt</span>
        </div>

        <article className="panel standings">
          <div className="tableHead" style={{ gridTemplateColumns: "42px 1fr 72px 72px 72px" }}>
            <span>#</span><span>Spiller</span><span>Eksakt</span><span>Utfall</span><span>Poeng</span>
          </div>
          {rows.map((row, index) => (
            <div className="tableRow" style={{ gridTemplateColumns: "42px 1fr 72px 72px 72px" }} key={row.id}>
              <span className="rank">{index + 1}</span>
              <span>
                <b>{row.display_name}</b>
                <small>{row.hitRate}% treff · {row.scoredTips} avgjorte tips</small>
              </span>
              <span>{row.exact}</span>
              <span>{row.correctOutcome}</span>
              <span className="points">{row.points}</span>
            </div>
          ))}
          {rows.length === 0 && <p className="muted">Ingen spillere er registrert ennå.</p>}
        </article>

        <article className="panel">
          <h3>Poengregler</h3>
          <p className="muted">5 poeng = eksakt resultat · 3 poeng = riktig kamputfall · 0 poeng = feil utfall.</p>
          <p className="muted" style={{ marginTop: 8 }}>Sist oppdatert: {updatedAt?.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
        </article>
      </section>
    </main>
  );
}
