"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabase";

type Player = { id: string; display_name: string };
type Match = { id: number; home_team: string; away_team: string; match_time: string | null; home_score: number | null; away_score: number | null; finished: boolean; round: number | null };
type Tip = { id?: number; player_id: string; match_id: number; home_tip: number; away_tip: number; points: number | null };

function isStarted(match: Match) { return match.finished || (!!match.match_time && Date.now() >= new Date(match.match_time).getTime()); }
function isLive(match: Match) {
  if (match.finished || !match.match_time) return false;
  const age = Date.now() - new Date(match.match_time).getTime();
  return age >= 0 && age <= 4 * 60 * 60 * 1000;
}
function fmt(value: string | null) { if (!value) return "Tidspunkt ikke satt"; return new Date(value).toLocaleString("no-NO", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }); }
function outcome(h: number, a: number) { return h > a ? "H" : h < a ? "A" : "D"; }
function livePoints(match: Match, tip?: Tip) { if (!tip || match.home_score === null || match.away_score === null) return 0; if (tip.home_tip === match.home_score && tip.away_tip === match.away_score) return 5; if (outcome(tip.home_tip, tip.away_tip) === outcome(match.home_score, match.away_score)) return 3; return 0; }

export default function MatchPage() {
  const params = useParams<{ id: string }>();
  const matchId = Number(params.id);
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  async function load() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !Number.isFinite(matchId)) { setLoading(false); return; }
    const { data: session } = await supabase.auth.getSession();
    setMeId(session.session?.user.id || null);
    const [m,p,t] = await Promise.all([
      supabase.from("matches").select("id,home_team,away_team,match_time,home_score,away_score,finished,round").eq("id", matchId).maybeSingle(),
      supabase.from("players").select("id,display_name").order("created_at"),
      supabase.from("tips").select("id,player_id,match_id,home_tip,away_tip,points").eq("match_id", matchId),
    ]);
    setMatch((m.data || null) as Match | null);
    setPlayers((p.data || []) as Player[]);
    setTips((t.data || []) as Tip[]);
    setUpdatedAt(new Date());
    setLoading(false);
  }

  useEffect(() => { load(); }, [matchId]);
  useEffect(() => { const timer = window.setInterval(load, 30_000); return () => window.clearInterval(timer); }, [matchId]);

  const started = match ? isStarted(match) : false;
  const live = match ? isLive(match) : false;
  const myTip = tips.find(t => t.player_id === meId);
  const rows = useMemo(() => players.map(player => {
    const tip = tips.find(t => t.player_id === player.id);
    const points = match ? (match.finished ? Number(tip?.points ?? 0) : livePoints(match, tip)) : 0;
    return { player, tip, points };
  }).sort((a,b)=>b.points-a.points || a.player.display_name.localeCompare(b.player.display_name,"no")), [players,tips,match]);

  if (loading) return <main className="appShell"><p className="muted">Laster kampen …</p></main>;
  if (!match) return <main className="appShell"><article className="panel"><h2>Kampen ble ikke funnet</h2><a className="textButton" href="/tips">← Tilbake til tips</a></article></main>;

  const statusTitle = match.finished ? "Ferdigspilt" : live ? "🟢 LIVE" : started ? "Avventer sluttstatus" : "Kommende kamp";
  const statusShort = match.finished ? "Slutt" : live ? "LIVE" : started ? "Låst" : "Åpen";
  const scoreText = match.home_score !== null && match.away_score !== null ? `${match.home_score}–${match.away_score}` : started ? "🔒" : "–";

  return <main className="appShell">
    <header className="topbar"><a href="/round" className="brand brandButton" style={{ textDecoration: "none" }}><div className="brandMark">🏒</div><div><p className="eyebrow">{match.round ? `Runde ${match.round}` : "EHL 2026/27"}</p><h1>Kampside</h1></div></a><a href="/round" className="textButton" style={{ textDecoration: "none" }}>← Runde</a></header>
    <section className="pageStack" style={{ marginTop: 24 }}>
      <article className="heroCard"><div><p className="eyebrow">{statusTitle}</p><h2>{match.home_team} <span>vs</span> {match.away_team}</h2><p className="muted">{fmt(match.match_time)}{updatedAt ? ` · oppdatert ${updatedAt.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</p></div><div className="countdown"><strong>{scoreText}</strong><span>{match.finished ? "slutt" : live ? "live score" : started ? "tips låst" : "kamp"}</span></div></article>

      <section className="statsGrid">
        <article className="miniCard"><span>Ditt tips</span><strong>{myTip ? `${myTip.home_tip}–${myTip.away_tip}` : "–"}</strong><small>{myTip ? "Levert" : "Ikke levert"}</small></article>
        <article className="miniCard"><span>Levert</span><strong>{tips.length}/{players.length}</strong><small>spillere</small></article>
        <article className="miniCard"><span>Dine poeng</span><strong>{myTip ? (match.finished ? Number(myTip.points ?? 0) : started ? livePoints(match, myTip) : 0) : 0}</strong><small>{match.finished ? "endelig" : live ? "live-estimat" : started ? "foreløpig" : "ikke startet"}</small></article>
        <article className="miniCard"><span>Status</span><strong>{statusShort}</strong><small>{started ? "tips kan ikke endres" : "tips kan endres"}</small></article>
      </section>

      <article className="panel"><div className="panelHeading"><div><p className="eyebrow">Kampen</p><h3>Spillernes tips</h3></div><span className="statusPill">{started ? (live ? "Live-poeng" : "Synlig for alle") : "Skjult til kampstart"}</span></div>
        {!started && <div className="quoteCard" style={{ marginTop: 0 }}><span>🔒 Før kampstart</span><p>Andre spilleres tips er skjult. Du ser kun ditt eget tips frem til kampen starter.</p></div>}
        {live && <div className="quoteCard" style={{ marginTop: 0 }}><span>🟢 LIVE</span><p>Poengene under er foreløpige og beregnes mot gjeldende HockeyLive-score. De blir endelige når kampen markeres som ferdig.</p></div>}
        <div className="pageStack" style={{ marginTop: 12 }}>{rows.map(({ player, tip, points }) => {
          const isMe = player.id === meId;
          const canShow = started || isMe;
          const pointLabel = match.finished && tip ? `${points} p` : live && tip ? `${points} p live` : "–";
          return <div key={player.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", padding: 14, borderRadius: 14, border: isMe ? "1px solid rgba(85,184,255,.55)" : "1px solid var(--line)", background: isMe ? "rgba(85,184,255,.08)" : "#0a1729" }}><div><a href={`/player/${player.id}`} style={{ color: "inherit", textDecoration: "none" }}><strong>{player.display_name}{isMe ? " (deg)" : ""}</strong><div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{tip ? "Tips levert · profil →" : "Ikke levert · profil →"}</div></a></div><strong style={{ fontSize: 20 }}>{canShow ? (tip ? `${tip.home_tip}–${tip.away_tip}` : "–") : "🔒"}</strong><span className="statusPill">{started ? pointLabel : "–"}</span></div>;
        })}</div>
      </article>
    </section>
  </main>;
}
