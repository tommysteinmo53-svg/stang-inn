"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type Player = { id: string; display_name: string };
type Match = { id: number; home_team: string; away_team: string; match_time: string | null; home_score: number | null; away_score: number | null; finished: boolean; round: number | null };
type Tip = { id: number; player_id: string; match_id: number; home_tip: number; away_tip: number; points: number | null };
type RoundRow = Player & { points: number; exact: number; correctOutcome: number; tipped: number };
type Award = { icon: string; title: string; name: string; detail: string };

function hasStarted(match: Match) { return match.finished || (!!match.match_time && Date.now() >= new Date(match.match_time).getTime()); }
function isLive(match: Match) { return !match.finished && !!match.match_time && Date.now() >= new Date(match.match_time).getTime(); }
function fmt(value: string | null) { if (!value) return "Tidspunkt ikke satt"; return new Date(value).toLocaleString("no-NO", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function statusText(match: Match) { if (match.finished && match.home_score !== null && match.away_score !== null) return `Slutt ${match.home_score}–${match.away_score}`; if (isLive(match)) { if (match.home_score !== null && match.away_score !== null) return `🟢 LIVE ${match.home_score}–${match.away_score}`; return "🟢 LIVE"; } return fmt(match.match_time); }
function featured(match: Match) { return `${match.home_team} ${match.away_team}`.toLowerCase().includes("narvik"); }
function shortTeam(name: string) {
  return name
    .replace(/\bElitehockeyligaen\b/gi, "")
    .replace(/\bIshockeyklubb\b/gi, "")
    .replace(/\bIshockey\b/gi, "")
    .replace(/\bHockey\b/gi, "")
    .replace(/\bIL\b/gi, "")
    .replace(/\bIK\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function dateRange(matches: Match[]) {
  const dates = matches.map(m => m.match_time).filter((x): x is string => !!x).map(x => new Date(x)).sort((a,b)=>a.getTime()-b.getTime());
  if (!dates.length) return "Dato ikke satt";
  const first = dates[0], last = dates[dates.length-1];
  if (first.toDateString() === last.toDateString()) return first.toLocaleDateString("no-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (first.getMonth() === last.getMonth()) return `${first.getDate()}.–${last.getDate()}. ${last.toLocaleDateString("no-NO", { month: "long", year: "numeric" })}`;
  return `${first.toLocaleDateString("no-NO", { day: "numeric", month: "short" })}–${last.toLocaleDateString("no-NO", { day: "numeric", month: "short", year: "numeric" })}`;
}
function timeUntil(value: string | null) {
  if (!value) return "Tidspunkt ikke satt";
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return "I gang";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} d ${hours} t`;
  if (hours > 0) return `${hours} t ${minutes} min`;
  return `${Math.max(1, minutes)} min`;
}
function cumulativeRank(players: Player[], matches: Match[], tips: Tip[], predicate: (m: Match) => boolean) {
  const ids = new Set(matches.filter(predicate).map(m=>m.id));
  return players.map(p=>({ id:p.id, points: tips.filter(t=>t.player_id===p.id && ids.has(t.match_id)).reduce((s,t)=>s+Number(t.points??0),0) }))
    .sort((a,b)=>b.points-a.points || a.id.localeCompare(b.id));
}

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
  useEffect(() => {
    if (selectedRound !== null || rounds.length === 0) return;
    const now = Date.now();
    const activeRound = rounds.find(r => {
      const rm = matches.filter(m=>m.round===r);
      const first = rm.map(m=>m.match_time).filter(Boolean).sort()[0];
      return first && new Date(first).getTime() <= now && rm.some(m=>!m.finished);
    });
    const nextRound = rounds.find(r => matches.some(m=>m.round===r && (!m.match_time || new Date(m.match_time).getTime() >= now)));
    setSelectedRound(activeRound ?? nextRound ?? rounds[0]);
  }, [rounds,matches,selectedRound]);

  const roundMatches = useMemo(() => matches.filter(m => m.round === selectedRound).sort((a,b) => {
    const priority = (m: Match) => featured(m) ? 0 : isLive(m) ? 1 : m.finished ? 3 : 2;
    return priority(a)-priority(b) || (a.match_time || "").localeCompare(b.match_time || "");
  }), [matches,selectedRound,updatedAt]);
  const roundMatchIds = useMemo(() => new Set(roundMatches.map(m => m.id)), [roundMatches]);
  const roundRows = useMemo<RoundRow[]>(() => players.map(player => {
    const playerTips = tips.filter(t => t.player_id === player.id && roundMatchIds.has(t.match_id));
    const scored = playerTips.filter(t => roundMatches.find(m => m.id === t.match_id)?.finished);
    return { ...player, points: scored.reduce((sum,t)=>sum+Number(t.points ?? 0),0), exact: scored.filter(t=>Number(t.points ?? 0)===5).length, correctOutcome: scored.filter(t=>Number(t.points ?? 0)===3).length, tipped: playerTips.length };
  }).sort((a,b)=>b.points-a.points || b.exact-a.exact || b.correctOutcome-a.correctOutcome || a.display_name.localeCompare(b.display_name,"no")), [players,tips,roundMatchIds,roundMatches]);

  const liveMatches = roundMatches.filter(isLive);
  const completedCount = roundMatches.filter(m=>m.finished).length;
  const startedCount = roundMatches.filter(hasStarted).length;
  const leader = roundRows[0];
  const firstKickoff = roundMatches.map(m=>m.match_time).filter((x):x is string=>!!x).sort()[0] || null;
  const lastKickoff = roundMatches.map(m=>m.match_time).filter((x):x is string=>!!x).sort().at(-1) || null;
  const fullRoundDelivered = roundMatches.length ? roundRows.filter(r=>r.tipped===roundMatches.length).length : 0;
  const totalPossibleTips = players.length * roundMatches.length;
  const deliveredTips = tips.filter(t=>roundMatchIds.has(t.match_id)).length;
  const deliveryPct = totalPossibleTips ? Math.round(deliveredTips/totalPossibleTips*100) : 0;
  const progressPct = roundMatches.length ? Math.round(completedCount/roundMatches.length*100) : 0;
  const roundFinished = roundMatches.length > 0 && completedCount === roundMatches.length;
  const roundStarted = startedCount > 0;
  const roundState = roundFinished ? "FERDIG" : liveMatches.length ? "LIVE" : roundStarted ? "PÅGÅR" : "ÅPEN";

  const awards = useMemo<Award[]>(() => {
    if (!roundFinished || !roundRows.length || selectedRound === null) return [];
    const winner = roundRows[0];
    const sniper = [...roundRows].sort((a,b)=>b.exact-a.exact || b.points-a.points)[0];
    const almost = [...roundRows].sort((a,b)=>b.correctOutcome-a.correctOutcome || a.exact-b.exact || b.points-a.points)[0];
    const before = cumulativeRank(players,matches,tips,m=>m.finished && (m.round ?? Infinity) < selectedRound);
    const after = cumulativeRank(players,matches,tips,m=>m.finished && (m.round ?? Infinity) <= selectedRound);
    const beforePos = new Map(before.map((r,i)=>[r.id,i]));
    const climb = after.map((r,i)=>({ id:r.id, climb:(beforePos.get(r.id) ?? i)-i })).sort((a,b)=>b.climb-a.climb)[0];
    const climber = players.find(p=>p.id===climb?.id);
    return [
      { icon:"🥇", title:"Rundevinner", name:winner.display_name, detail:`${winner.points} poeng` },
      { icon:"🎯", title:"Sniper", name:sniper.display_name, detail:`${sniper.exact} eksakte resultater` },
      { icon:"😬", title:"Nesten", name:almost.display_name, detail:`${almost.correctOutcome} riktige utfall` },
      { icon:"📈", title:"Største klatring", name:climber?.display_name || "–", detail:climb && climb.climb>0 ? `Opp ${climb.climb} plass${climb.climb===1?"":"er"}` : "Ingen klatring denne runden" },
    ];
  }, [roundFinished,roundRows,selectedRound,players,matches,tips]);

  if (loading) return <main className="appShell"><p className="muted">Laster runden …</p></main>;

  return <main className="appShell">
    <header className="topbar"><a href="/" className="brand brandButton" style={{ textDecoration: "none" }}><div className="brandMark">🏒</div><div><p className="eyebrow">EHL 2026/27</p><h1>Runde</h1></div></a><a href="/" className="textButton" style={{ textDecoration: "none" }}>Til appen →</a></header>

    <section className="pageStack" style={{ marginTop: 24 }}>
      <article className="heroCard" style={{ alignItems:"stretch" }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:8 }}>
            <span className="statusPill">{roundState === "LIVE" ? "🟢 LIVE" : roundState === "FERDIG" ? "🏁 FERDIG" : roundState === "PÅGÅR" ? "🟡 PÅGÅR" : "🔵 ÅPEN"}</span>
            <span className="muted" style={{ fontSize:12 }}>{dateRange(roundMatches)}</span>
          </div>
          <p className="eyebrow">Runde-event</p>
          <h2>{selectedRound !== null ? `Runde ${selectedRound}` : "Velg runde"}</h2>
          <p className="muted">{roundFinished ? "Runden er ferdig og rundevinneren er kåret." : roundStarted ? "Poeng og rundetabell oppdateres fortløpende." : `Første kamp starter om ${timeUntil(firstKickoff)}.`}</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:8, marginTop:18 }}>
            <div className="miniCard"><span>Kamper</span><strong>{completedCount}/{roundMatches.length}</strong><small>ferdig</small></div>
            <div className="miniCard"><span>Fullført tips</span><strong>{fullRoundDelivered}/{players.length}</strong><small>spillere</small></div>
            <div className="miniCard"><span>Alle tips</span><strong>{deliveryPct}%</strong><small>{deliveredTips}/{totalPossibleTips || 0}</small></div>
          </div>
        </div>
        <div className="countdown" style={{ display:"flex", flexDirection:"column", justifyContent:"center" }}>
          <strong>{liveMatches.length ? `${liveMatches.length} LIVE` : roundFinished ? "100%" : !roundStarted ? timeUntil(firstKickoff) : `${progressPct}%`}</strong>
          <span>{liveMatches.length ? "kamper nå" : roundFinished ? "runden ferdig" : !roundStarted ? "til første kamp" : "av runden ferdig"}</span>
        </div>
      </article>

      <div style={{ height:8, borderRadius:999, background:"rgba(97,196,255,.08)", overflow:"hidden", border:"1px solid rgba(97,196,255,.12)" }}>
        <div style={{ width:`${roundStarted ? Math.max(progressPct,3) : 0}%`, height:"100%", borderRadius:999, background:"linear-gradient(90deg,#31a9f1,#54dea8)", transition:"width .35s ease" }} />
      </div>

      <select className="roundSelect" value={selectedRound ?? ""} onChange={e=>setSelectedRound(Number(e.target.value))} style={{ width: "100%", maxWidth: 320 }}>{rounds.map(r=><option value={r} key={r}>Runde {r}</option>)}</select>

      {leader && <article className="quoteCard"><span>{liveMatches.length ? "🟢 LIVE-RUNDELEDER" : roundFinished ? "🏆 RUNDEVINNER" : "🏆 RUNDELEDER"}</span><p><a href={`/player/${leader.id}`} style={{ color: "inherit", fontWeight: 900 }}><strong>{leader.display_name}</strong></a> {roundFinished ? "vant" : "leder"} med {leader.points} poeng{leader.exact ? ` og ${leader.exact} eksakte` : ""}.</p></article>}

      <article className="panel standings">
        <div className="panelHeading"><div><p className="eyebrow">Rundetabell</p><h3>Poeng denne runden</h3></div><span className="statusPill">{updatedAt ? `Oppdatert ${updatedAt.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" })}` : ""}</span></div>
        <div className="tableHead" style={{ gridTemplateColumns: "42px 1fr 70px 70px" }}><span>#</span><span>Spiller</span><span>Eksakt</span><span>Poeng</span></div>
        {roundRows.map((row,i)=><div className="tableRow" style={{ gridTemplateColumns: "42px 1fr 70px 70px", background: row.id===meId ? "rgba(97,196,255,.035)" : undefined }} key={row.id}><span className="rank">{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</span><span><a href={`/player/${row.id}`} style={{ color: "inherit", textDecoration: "none" }}><b>{row.display_name}{row.id===meId?" · deg":""}</b><small>{row.tipped}/{roundMatches.length} tips levert · profil →</small></a></span><span>{row.exact}</span><span className="points">{row.points}</span></div>)}
      </article>

      <div className="panelHeading" style={{ marginTop:10, marginBottom:0 }}><div><p className="eyebrow">Kampene</p><h3>{roundMatches.length} kamper i runden</h3></div>{lastKickoff&&<span className="muted" style={{ fontSize:12 }}>Siste kamp {fmt(lastKickoff)}</span>}</div>

      {roundMatches.map(match => {
        const matchTips = tips.filter(t=>t.match_id===match.id);
        const visible = hasStarted(match);
        const isFeatured = featured(match);
        const live = isLive(match);
        const delivered = matchTips.length;
        return <article className="panel" key={match.id} style={isFeatured ? { border: "1px solid rgba(245,196,81,.55)", boxShadow: "0 0 0 1px rgba(245,196,81,.08) inset" } : live ? { border: "1px solid rgba(79,214,156,.45)" } : undefined}>
          <div className="panelHeading"><div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>{isFeatured&&<span className="statusPill">⭐ Rundens kamp</span>}{live&&<span className="delivery complete">🟢 LIVE</span>}{!visible&&<span className="delivery">🔒 {delivered}/{players.length} levert</span>}</div><small className="muted">{statusText(match)}</small><h3 style={{ marginTop: 6 }}>{shortTeam(match.home_team)} – {shortTeam(match.away_team)}</h3></div><a href={`/match/${match.id}`} className="textButton" style={{ textDecoration: "none" }}>Kampside →</a></div>
          {!visible ? <div className="quoteCard"><span>Tips skjult</span><p>🔒 Andre spilleres tips blir synlige når denne kampen starter.</p></div> : <div className="simpleList">{players.map(player => { const tip = matchTips.find(t=>t.player_id===player.id); const exact = match.finished && Number(tip?.points ?? 0)===5; const correct = match.finished && Number(tip?.points ?? 0)===3; return <div key={player.id} style={exact ? { background: "rgba(245,196,81,.08)", borderRadius: 10, paddingInline: 8 } : undefined}><span>{exact?"🎯 ":correct?"✓ ":""}<a href={`/player/${player.id}`} style={{ color: "inherit", textDecoration: "none" }}>{player.display_name}{player.id===meId?" · deg":""}</a></span><strong>{tip ? `${tip.home_tip}–${tip.away_tip}${match.finished ? ` · +${Number(tip.points ?? 0)} p${exact ? " · EKSAKT" : ""}` : ""}` : "Ikke levert"}</strong></div>; })}</div>}
        </article>;
      })}

      {roundFinished && awards.length > 0 && <section className="pageStack" style={{ marginTop:12 }}>
        <div><p className="eyebrow">Runden er ferdig</p><h2 style={{ fontSize:30 }}>🏆 Rundepriser</h2><p className="muted">Automatisk kåret fra tipsene og poengene i runden.</p></div>
        <div className="awardGrid">{awards.map(a=><article className="awardCard" key={a.title}><div className="awardIcon">{a.icon}</div><span>{a.title}</span><strong>{a.name}</strong><small>{a.detail}</small></article>)}</div>
      </section>}

      {roundMatches.length===0&&<article className="panel emptyState"><strong>Ingen kamper i denne runden.</strong></article>}
    </section>
  </main>;
}
