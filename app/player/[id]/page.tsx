"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabase";

type Player = { id: string; display_name: string; email: string | null };
type Match = { id: number; home_team: string; away_team: string; match_time: string | null; home_score: number | null; away_score: number | null; finished: boolean; round: number | null };
type Tip = { id: number; player_id: string; match_id: number; home_tip: number; away_tip: number; points: number | null };
type RoundStat = { round: number; points: number; exact: number; correct: number; tipped: number };
type TrendPoint = { round:number; cumulative:number; position:number };

function isFinal(match: Match) {
  return match.finished && match.home_score !== null && match.away_score !== null;
}
function started(match: Match) {
  return isFinal(match) || (!!match.match_time && Date.now() >= new Date(match.match_time).getTime());
}
function fmt(value: string | null) {
  if (!value) return "Tidspunkt ikke satt";
  return new Date(value).toLocaleString("no-NO", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function medal(pos:number){return pos===1?"🥇":pos===2?"🥈":pos===3?"🥉":`#${pos}`}

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
  const finalMatches = useMemo(() => matches.filter(isFinal), [matches]);
  const finishedIds = useMemo(() => new Set(finalMatches.map(m => m.id)), [finalMatches]);
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
      const match = finalMatches.find(m => m.id === tip.match_id);
      if (match?.round == null) return;
      const current = map.get(match.round) || { round: match.round, points: 0, exact: 0, correct: 0, tipped: 0 };
      current.points += Number(tip.points ?? 0);
      current.tipped += 1;
      if (Number(tip.points ?? 0) === 5) current.exact += 1;
      if (Number(tip.points ?? 0) === 3) current.correct += 1;
      map.set(match.round, current);
    });
    return [...map.values()].sort((a,b) => a.round-b.round);
  }, [scoredTips, finalMatches]);

  const bestRound = [...roundStats].sort((a,b) => b.points-a.points || b.exact-a.exact)[0];
  const worstRound = [...roundStats].sort((a,b) => a.points-b.points || a.exact-b.exact)[0];
  const lastFive = [...roundStats].sort((a,b)=>b.round-a.round).slice(0,5).reverse();
  const activeStreak = useMemo(()=>{
    const ordered=[...scoredTips].sort((a,b)=>{
      const ma=matches.find(m=>m.id===a.match_id)?.match_time||"";
      const mb=matches.find(m=>m.id===b.match_id)?.match_time||"";
      return mb.localeCompare(ma);
    });
    let s=0; for(const t of ordered){if(Number(t.points??0)>0)s++;else break;} return s;
  },[scoredTips,matches]);

  const completeRounds = useMemo(() => {
    const roundNumbers = [...new Set(matches.map(m => m.round).filter((r): r is number => r !== null))];
    return roundNumbers.filter(round => {
      const roundMatches = matches.filter(m => m.round === round);
      return roundMatches.length > 0 && roundMatches.every(isFinal);
    }).sort((a,b)=>a-b);
  }, [matches]);

  const roundWins = useMemo(()=>{
    let wins=0;
    completeRounds.forEach(r=>{
      const mids=new Set(finalMatches.filter(m=>m.round===r).map(m=>m.id));
      const rs=players.map(p=>{
        const pt=tips.filter(t=>t.player_id===p.id&&mids.has(t.match_id));
        return {id:p.id,pts:pt.reduce((s,t)=>s+Number(t.points??0),0),exact:pt.filter(t=>Number(t.points??0)===5).length,correct:pt.filter(t=>Number(t.points??0)===3).length,name:p.display_name};
      }).sort((a,b)=>b.pts-a.pts||b.exact-a.exact||b.correct-a.correct||a.name.localeCompare(b.name,"no"));
      if(rs[0]?.id===playerId) wins++;
    });
    return wins;
  },[completeRounds,finalMatches,players,tips,playerId]);

  const trend = useMemo<TrendPoint[]>(()=>{
    const rounds=[...new Set(finalMatches.map(m=>m.round).filter((r):r is number=>r!==null))].sort((a,b)=>a-b);
    return rounds.map(r=>{
      const mids=new Set(finalMatches.filter(m=>(m.round??0)<=r).map(m=>m.id));
      const table=players.map(p=>{
        const pt=tips.filter(t=>t.player_id===p.id&&mids.has(t.match_id));
        return {id:p.id,pts:pt.reduce((s,t)=>s+Number(t.points??0),0),exact:pt.filter(t=>Number(t.points??0)===5).length,correct:pt.filter(t=>Number(t.points??0)===3).length,name:p.display_name};
      }).sort((a,b)=>b.pts-a.pts||b.exact-a.exact||b.correct-a.correct||a.name.localeCompare(b.name,"no"));
      const row=table.find(x=>x.id===playerId);
      return {round:r,cumulative:row?.pts??0,position:Math.max(1,table.findIndex(x=>x.id===playerId)+1)};
    });
  },[finalMatches,players,tips,playerId]);

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
  const maxPts = Math.max(1,...trend.map(t=>t.cumulative));

  return <main className="appShell">
    <header className="topbar"><a href="/leaderboard" className="brand brandButton" style={{ textDecoration: "none" }}><div className="brandMark">🏒</div><div><p className="eyebrow">Spillerprofil</p><h1>Stang Inn</h1></div></a><a href="/leaderboard" className="textButton" style={{ textDecoration: "none" }}>← Tabell</a></header>

    <section className="pageStack" style={{ marginTop: 24 }}>
      <article className="profileHero"><div className="profileAvatar">{initial}</div><div><p className="eyebrow">{meId === player.id ? "Din profil" : "Spiller"}</p><h2>{player.display_name}</h2><p className="muted">{medal(position||0)} sammenlagt · {points} poeng</p></div></article>

      <section className="statsGrid">
        <article className="miniCard"><span>Plassering</span><strong>#{position || "–"}</strong><small>sammenlagt</small></article>
        <article className="miniCard"><span>Poeng</span><strong>{points}</strong><small>{scoredTips.length} avgjorte tips</small></article>
        <article className="miniCard"><span>Treff</span><strong>{hitRate}%</strong><small>{hits} riktige</small></article>
        <article className="miniCard"><span>Eksakte</span><strong>{exact}</strong><small>5-poengere</small></article>
      </section>

      <section className="statsGrid">
        <article className="miniCard"><span>🔥 Streak</span><strong>{activeStreak}</strong><small>riktige på rad</small></article>
        <article className="miniCard"><span>🏆 Rundeseire</span><strong>{roundWins}</strong><small>ferdigspilte runder</small></article>
        <article className="miniCard"><span>Beste runde</span><strong>{bestRound?.points ?? 0}</strong><small>{bestRound?`Runde ${bestRound.round}`:"–"}</small></article>
        <article className="miniCard"><span>Siste 5</span><strong>{lastFive.reduce((s,r)=>s+r.points,0)}</strong><small>poeng</small></article>
      </section>

      <section className="contentGrid">
        <article className="panel"><div className="panelHeading"><div><p className="eyebrow">Form</p><h3>Siste 5 runder</h3></div></div><div className="simpleList">{lastFive.map(r=><div key={r.round}><span>Runde {r.round}</span><strong>{r.points} p · {r.exact} eksakte</strong></div>)}{!lastFive.length&&<p className="muted">Ingen ferdigspilte kamper ennå.</p>}</div></article>

        <article className="panel"><div className="panelHeading"><div><p className="eyebrow">Runder</p><h3>Beste og svakeste</h3></div></div><div className="simpleList"><div><span>🏆 Beste runde</span><strong>{bestRound ? `Runde ${bestRound.round} · ${bestRound.points} p` : "–"}</strong></div><div><span>🧊 Svakeste runde</span><strong>{worstRound ? `Runde ${worstRound.round} · ${worstRound.points} p` : "–"}</strong></div><div><span>✓ Riktig utfall</span><strong>{correctOutcome}</strong></div></div></article>
      </section>

      <article className="panel">
        <div className="panelHeading"><div><p className="eyebrow">Sesongutvikling</p><h3>Poeng og plassering per runde</h3></div></div>
        <div style={{display:"grid",gap:10}}>{trend.map(t=><div key={t.round} style={{display:"grid",gridTemplateColumns:"72px 1fr 86px",gap:10,alignItems:"center"}}><span className="muted">Runde {t.round}</span><div style={{height:10,borderRadius:999,background:"rgba(97,196,255,.08)",overflow:"hidden"}}><div style={{height:"100%",width:`${Math.max(4,Math.round(t.cumulative/maxPts*100))}%`,background:"linear-gradient(90deg,#31a9f1,#54dea8)",borderRadius:999}}/></div><strong style={{textAlign:"right"}}>{t.cumulative} p · #{t.position}</strong></div>)}{!trend.length&&<p className="muted">Ingen utvikling å vise ennå.</p>}</div>
      </article>

      <article className="panel"><div className="panelHeading"><div><p className="eyebrow">Historikk</p><h3>Tips</h3></div><span className="statusPill">{visibleHistory.length} vist</span></div><div className="pageStack" style={{ gap: 8 }}>{visibleHistory.map(({ tip, match }) => <a href={`/match/${match.id}`} key={tip.id} style={{ textDecoration: "none", color: "inherit", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, padding: 12, border: "1px solid var(--line)", borderRadius: 12 }}><span><strong>{match.home_team} – {match.away_team}</strong><small className="muted" style={{ display: "block", marginTop: 3 }}>{fmt(match.match_time)}{match.round ? ` · Runde ${match.round}` : ""}</small></span><span style={{ textAlign: "right" }}><strong>{tip.home_tip}–{tip.away_tip}</strong><small className="muted" style={{ display: "block", marginTop: 3 }}>{isFinal(match) ? `${Number(tip.points ?? 0)} p` : started(match) ? "Pågår" : "Kommende"}</small></span></a>)}{visibleHistory.length === 0 && <p className="muted">Ingen synlige tips ennå.</p>}</div></article>
    </section>
  </main>;
}
