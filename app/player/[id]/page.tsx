"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabase";

type Player = { id: string; display_name: string; email: string | null };
type Match = { id: number; home_team: string; away_team: string; match_time: string | null; home_score: number | null; away_score: number | null; finished: boolean; round: number | null };
type Tip = { id: number; player_id: string; match_id: number; home_tip: number; away_tip: number; points: number | null };
type RoundStat = { round: number; points: number; exact: number; correct: number; tipped: number };

function started(match: Match) {
  return match.finished || (!!match.match_time && Date.now() >= new Date(match.match_time).getTime());
}

function fmt(value: string | null) {
  if (!value) return "Tidspunkt ikke satt";
  return new Date(value).toLocaleString("no-NO", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const playerId = params.id;
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setLoading(false); return; }
    const [{ data: session }, p, m, t] = await Promise.all([
      supabase.auth.getSession(),
      supabase.from("players").select("id,display_name,email").order("created_at"),
      supabase.from("matches").select("id,home_team,away_team,match_time,home_score,away_score,finished,round").order("match_time", { ascending: false }),
      supabase.from("tips").select("id,player_id,match_id,home_tip,away_tip,points"),
    ]);
    setMeId(session.session?.user.id || null);
    setPlayers((p.data || []) as Player[]);
    setMatches((m.data || []) as Match[]);
    setTips((t.data || []) as Tip[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [playerId]);

  const player = players.find(p => p.id === playerId) || null;
  const finishedIds = useMemo(() => new Set(matches.filter(m => m.finished).map(m => m.id)), [matches]);

  const standings = useMemo(() => players.map(p => {
    const scored = tips.filter(t => t.player_id === p.id && finishedIds.has(t.match_id));
    const points = scored.reduce((sum, t) => sum + Number(t.points ?? 0), 0);
    const exact = scored.filter(t => Number(t.points ?? 0) === 5).length;
    const correct = scored.filter(t => Number(t.points ?? 0) === 3).length;
    return { ...p, points, exact, correct };
  }).sort((a,b) => b.points-a.points || b.exact-a.exact || b.correct-a.correct || a.display_name.localeCompare(b.display_name, "no")), [players, tips, finishedIds]);

  const profileTips = useMemo(() => tips.filter(t => t.player_id === playerId), [tips, playerId]);
  const scoredTips = useMemo(() => profileTips.filter(t => finishedIds.has(t.match_id)), [profileTips, finishedIds]);
  const points = scoredTips.reduce((sum,t) => sum + Number(t.points ?? 0), 0);
  const exact = scoredTips.filter(t => Number(t.points ?? 0) === 5).length;
  const correctOutcome = scoredTips.filter(t => Number(t.points ?? 0) === 3).length;
  const hits = exact + correctOutcome;
  const hitRate = scoredTips.length ? Math.round((hits / scoredTips.length) * 100) : 0;
  const position = standings.findIndex(p => p.id === playerId) + 1;

  const roundStats = useMemo<RoundStat[]>(() => {
    const map = new Map<number, RoundStat>();
    scoredTips.forEach(tip => {
      const match = matches.find(m => m.id === tip.match_id);
      if (match?.round == null) return;
      const current = map.get(match.round) || { round: match.round, points: 0, exact: 0, correct: 0, tipped: 0 };
      current.points += Number(tip.points ?? 0);
      current.tipped += 1;
      if (Number(tip.points ?? 0) === 5) current.exact += 1;
      if (Number(tip.points ?? 0) === 3) current.correct += 1;
      map.set(match.round, current);
    });
    return [...map.values()].sort((a,b) => a.round-b.round);
  }, [scoredTips, matches]);

  const bestRound = [...roundStats].sort((a,b) => b.points-a.points || b.exact-a.exact)[0];
  const worstRound = [...roundStats].sort((a,b) => a.points-b.points || a.exact-b.exact)[0];

  const visibleHistory = useMemo(() => {
    const ownProfile = meId === playerId;
    return profileTips
      .map(tip => ({ tip, match: matches.find(m => m.id === tip.match_id) }))
      .filter((x): x is { tip: Tip; match: Match } => !!x.match && (ownProfile || started(x.match)))
      .sort((a,b) => (b.match.match_time || "").localeCompare(a.match.match_time || ""));
  }, [profileTips, matches, meId, playerId]);

  if (loading) return <main className="appShell"><p className="muted">Laster spillerprofil …</p></main>;
  if (!player) return <main className="appShell"><article className="panel"><h2>Spilleren ble ikke funnet</h2><a href="/leaderboard" className="textButton">← Til tabellen</a></article></main>;

  const initial = player.display_name.slice(0,1).toUpperCase();

  return <main className="appShell">
    <header className="topbar">
      <a href="/leaderboard" className="brand brandButton" style={{ textDecoration: "none" }}><div className="brandMark">🏒</div><div><p className="eyebrow">Spillerprofil</p><h1>Stang Inn</h1></div></a>
      <a href="/leaderboard" className="textButton" style={{ textDecoration: "none" }}>← Tabell</a>
    </header>

    <section className="pageStack" style={{ marginTop: 24 }}>
      <article className="profileHero">
        <div className="profileAvatar">{initial}</div>
        <div><p className="eyebrow">{meId === player.id ? "Din profil" : "Spiller"}</p><h2>{player.display_name}</h2><p className="muted">#{position || "–"} sammenlagt · {points} poeng</p></div>
      </article>

      <section className="statsGrid">
        <article className="miniCard"><span>Plassering</span><strong>#{position || "–"}</strong><small>sammenlagt</small></article>
        <article className="miniCard"><span>Poeng</span><strong>{points}</strong><small>{scoredTips.length} avgjorte tips</small></article>
        <article className="miniCard"><span>Treff</span><strong>{hitRate}%</strong><small>{hits} riktige</small></article>
        <article className="miniCard"><span>Eksakte</span><strong>{exact}</strong><small>5-poengere</small></article>
      </section>

      <section className="contentGrid">
        <article className="panel">
          <div className="panelHeading"><div><p className="eyebrow">Runder</p><h3>Beste og svakeste</h3></div></div>
          <div className="simpleList">
            <div><span>🏆 Beste runde</span><strong>{bestRound ? `Runde ${bestRound.round} · ${bestRound.points} p` : "–"}</strong></div>
            <div><span>🧊 Svakeste runde</span><strong>{worstRound ? `Runde ${worstRound.round} · ${worstRound.points} p` : "–"}</strong></div>
            <div><span>✓ Riktig utfall</span><strong>{correctOutcome}</strong></div>
          </div>
        </article>

        <article className="panel">
          <div className="panelHeading"><div><p className="eyebrow">Poengutvikling</p><h3>Per runde</h3></div></div>
          <div className="simpleList">
            {roundStats.map(r => <div key={r.round}><span>Runde {r.round}</span><strong>{r.points} p · {r.exact} eksakte</strong></div>)}
            {roundStats.length === 0 && <p className="muted">Ingen ferdigspilte runder ennå.</p>}
          </div>
        </article>
      </section>

      <article className="panel">
        <div className="panelHeading"><div><p className="eyebrow">Historikk</p><h3>Tips</h3></div><span className="statusPill">{visibleHistory.length} vist</span></div>
        <div className="pageStack" style={{ gap: 8 }}>
          {visibleHistory.map(({ tip, match }) => <a href={`/match/${match.id}`} key={tip.id} style={{ textDecoration: "none", color: "inherit", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, padding: 12, border: "1px solid var(--line)", borderRadius: 12 }}>
            <span><strong>{match.home_team} – {match.away_team}</strong><small className="muted" style={{ display: "block", marginTop: 3 }}>{fmt(match.match_time)}{match.round ? ` · Runde ${match.round}` : ""}</small></span>
            <span style={{ textAlign: "right" }}><strong>{tip.home_tip}–{tip.away_tip}</strong><small className="muted" style={{ display: "block", marginTop: 3 }}>{match.finished ? `${Number(tip.points ?? 0)} p` : started(match) ? "Pågår" : "Kommende"}</small></span>
          </a>)}
          {visibleHistory.length === 0 && <p className="muted">Ingen synlige tips ennå.</p>}
        </div>
      </article>
    </section>
  </main>;
}
