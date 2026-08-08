"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "../lib/supabase";

type Player = { id: string; display_name: string };
type Tip = { id: number; player_id: string; match_id: number; points: number | null };
type Match = { id: number; finished: boolean; home_score: number | null; away_score: number | null; match_time: string | null };
type Row = Player & { points: number; exact: number; correct: number };

export default function HomeLiveTable() {
  const pathname = usePathname();
  const [players, setPlayers] = useState<Player[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [moves, setMoves] = useState<Record<string, number>>({});
  const previousPositions = useRef<Record<string, number>>({});

  useEffect(() => {
    if (pathname !== "/") return;
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setLoaded(true); return; }
      const [p, t, m] = await Promise.all([
        supabase.from("players").select("id,display_name").order("created_at"),
        supabase.from("tips").select("id,player_id,match_id,points"),
        supabase.from("matches").select("id,finished,home_score,away_score,match_time"),
      ]);
      setPlayers((p.data || []) as Player[]);
      setTips((t.data || []) as Tip[]);
      setMatches((m.data || []) as Match[]);
      setUpdatedAt(new Date());
      setLoaded(true);
    };
    load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, [pathname]);

  const finishedIds = useMemo(() => new Set(matches.filter(m => m.finished || (m.home_score !== null && m.away_score !== null)).map(m => m.id)), [matches]);
  const liveNow = useMemo(() => matches.some(m => !m.finished && !!m.match_time && Date.now() >= new Date(m.match_time).getTime()), [matches, updatedAt]);

  const rows = useMemo<Row[]>(() => players.map(player => {
    const scored = tips.filter(t => t.player_id === player.id && finishedIds.has(t.match_id));
    const points = scored.reduce((sum, t) => sum + Number(t.points ?? 0), 0);
    const exact = scored.filter(t => Number(t.points ?? 0) === 5).length;
    const correct = scored.filter(t => Number(t.points ?? 0) > 0).length;
    return { ...player, points, exact, correct };
  }).sort((a,b) => b.points-a.points || b.exact-a.exact || b.correct-a.correct || a.display_name.localeCompare(b.display_name,"no")), [players, tips, finishedIds]);

  useEffect(() => {
    if (!rows.length) return;
    const next: Record<string, number> = {};
    const current: Record<string, number> = {};
    rows.forEach((row, i) => { current[row.id] = i; });
    Object.entries(current).forEach(([id, pos]) => {
      const prev = previousPositions.current[id];
      next[id] = prev === undefined ? 0 : prev - pos;
    });
    setMoves(next);
    previousPositions.current = current;
  }, [rows]);

  if (pathname !== "/") return null;

  return (
    <section className="homeLiveTableWrap" aria-label="Live-tabell">
      <article className={`homeLiveTableCard ${liveNow ? "isLive" : ""}`}>
        <div className="homeLiveTableHead">
          <div>
            <span className="homeLiveKicker">{liveNow ? "🟢 LIVE-TABELL" : "🏆 TABELL NÅ"}</span>
            <h3>Toppen akkurat nå</h3>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}><a href="/live">Live-senter →</a><a href="/leaderboard">Hele tabellen →</a></div>
        </div>
        {!loaded ? <p className="muted" style={{ margin: 0 }}>Laster live-tabellen …</p> : rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>Ingen spillere er registrert ennå.</p> : <div className="homeLiveRows">
          {rows.slice(0,5).map((row, i) => {
            const move = moves[row.id] || 0;
            return <a href={`/player/${row.id}`} className="homeLiveRow" key={row.id}>
              <span className="homeLiveRank">{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</span>
              <span className="homeLiveName"><b>{row.display_name}</b><small>🎯 {row.exact} eksakte</small></span>
              <span className={`homeLiveMove ${move>0?"up":move<0?"down":"same"}`}>{move>0?`▲ +${move}`:move<0?`▼ ${move}`:"—"}</span>
              <strong className="homeLivePoints">{row.points} p</strong>
            </a>;
          })}
        </div>}
        <div className="homeLiveFooter">
          <span>{liveNow ? "Oppdateres automatisk hvert 30. sekund" : "Ingen livekamper akkurat nå"}</span>
          <span>{updatedAt ? `Oppdatert ${updatedAt.toLocaleTimeString("no-NO", { hour:"2-digit", minute:"2-digit" })}` : ""}</span>
        </div>
      </article>
    </section>
  );
}
