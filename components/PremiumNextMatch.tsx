"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "../lib/supabase";

type Match = {
  id: number;
  home_team: string;
  away_team: string;
  match_time: string | null;
  finished: boolean;
  round: number | null;
};

type Tip = {
  player_id: string;
  match_id: number;
  home_tip: number;
  away_tip: number;
};

function shortTeam(name: string) {
  const n = name.trim();
  const replacements: Array<[RegExp, string]> = [
    [/Storhamar.*$/i, "Storhamar"],
    [/Frisk\s+Asker.*$/i, "Frisk Asker"],
    [/Stavanger.*$/i, "Oilers"],
    [/Vålerenga.*$/i, "Vålerenga"],
    [/Narvik.*$/i, "Narvik"],
    [/Sparta.*$/i, "Sparta"],
    [/Stjernen.*$/i, "Stjernen"],
    [/Lillehammer.*$/i, "Lillehammer"],
    [/Nidaros.*$/i, "Nidaros"],
    [/Ringerike.*$/i, "Ringerike"],
  ];
  for (const [pattern, replacement] of replacements) if (pattern.test(n)) return replacement;
  return n
    .replace(/\bElitehockeyligaen\b/gi, "")
    .replace(/\bIshockeyklubb\b/gi, "")
    .replace(/\bIshockey\b/gi, "")
    .replace(/\bHockey\b/gi, "")
    .replace(/\s*-?\s*MEN\s*1\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function initials(name: string) {
  return shortTeam(name).split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatKickoff(value: string | null) {
  if (!value) return "Tidspunkt ikke satt";
  return new Date(value).toLocaleString("no-NO", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function timeLeft(value: string | null, finished = false) {
  if (finished) return { main: "Ferdig", sub: "Kampen er avsluttet", soon: false, locked: true };
  if (!value) return { main: "–", sub: "Tidspunkt ikke satt", soon: false, locked: false };
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return { main: "I gang", sub: "Tips er låst", soon: false, locked: true };
  const totalHours = Math.floor(ms / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return { main: `${days} dager`, sub: hours ? `${hours} timer i tillegg` : "til kampstart", soon: days <= 1, locked: false };
  if (totalHours > 0) return { main: `${totalHours}t ${minutes}m`, sub: "til kampstart", soon: totalHours < 6, locked: false };
  return { main: `${Math.max(0, minutes)} min`, sub: "til kampstart", soon: true, locked: false };
}

function resultKind(tip: Tip) {
  if (tip.home_tip > tip.away_tip) return "home";
  if (tip.home_tip < tip.away_tip) return "away";
  return "draw";
}

export default function PremiumNextMatch() {
  const pathname = usePathname();
  const [matches, setMatches] = useState<Match[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [, setTick] = useState(0);
  const rail = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (pathname !== "/") return;
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const { data: session } = await supabase.auth.getSession();
      setUid(session.session?.user.id || null);
      const [m, t] = await Promise.all([
        supabase.from("matches").select("id,home_team,away_team,match_time,finished,round").order("match_time", { ascending: true }),
        supabase.from("tips").select("player_id,match_id,home_tip,away_tip"),
      ]);
      setMatches((m.data || []) as Match[]);
      setTips((t.data || []) as Tip[]);
    };
    load();
    const refresh = window.setInterval(load, 30_000);
    const clock = window.setInterval(() => setTick(v => v + 1), 60_000);
    return () => { window.clearInterval(refresh); window.clearInterval(clock); };
  }, [pathname]);

  const currentRound = useMemo(() => {
    const now = Date.now();
    const active = matches.find(m => !m.finished && !!m.match_time && new Date(m.match_time).getTime() <= now && m.round !== null);
    if (active?.round !== null && active?.round !== undefined) return active.round;
    const next = matches.find(m => !m.finished && (!m.match_time || new Date(m.match_time).getTime() > now) && m.round !== null);
    return next?.round ?? matches.find(m => m.round !== null)?.round ?? null;
  }, [matches]);

  const roundMatches = useMemo(() => {
    if (currentRound === null) return [];
    return matches.filter(m => m.round === currentRound).sort((a, b) => (a.match_time || "").localeCompare(b.match_time || ""));
  }, [matches, currentRound]);

  const defaultIndex = useMemo(() => {
    if (!roundMatches.length) return 0;
    const now = Date.now();
    const liveIndex = roundMatches.findIndex(m => !m.finished && !!m.match_time && new Date(m.match_time).getTime() <= now);
    if (liveIndex >= 0) return liveIndex;
    const upcomingIndex = roundMatches.findIndex(m => !m.finished && (!m.match_time || new Date(m.match_time).getTime() > now));
    return upcomingIndex >= 0 ? upcomingIndex : roundMatches.length - 1;
  }, [roundMatches]);

  useEffect(() => {
    setIndex(defaultIndex);
    requestAnimationFrame(() => {
      const r = rail.current;
      if (r) r.scrollTo({ left: defaultIndex * r.clientWidth, behavior: "auto" });
    });
  }, [defaultIndex, currentRound]);

  function go(nextIndex: number) {
    const r = rail.current;
    if (!r || !roundMatches.length) return;
    const target = Math.max(0, Math.min(roundMatches.length - 1, nextIndex));
    setIndex(target);
    r.scrollTo({ left: target * r.clientWidth, behavior: "smooth" });
  }

  function handleScroll() {
    const r = rail.current;
    if (!r || !roundMatches.length || !r.clientWidth) return;
    const nextIndex = Math.max(0, Math.min(roundMatches.length - 1, Math.round(r.scrollLeft / r.clientWidth)));
    setIndex(nextIndex);
  }

  if (pathname !== "/" || !roundMatches.length) return null;

  return (
    <section className="premiumNextWrap premiumRoundSwipeWrap">
      <div className="premiumSwipeHeader">
        <div>
          <span className="premiumSwipeEyebrow">Kamper i runden</span>
          <strong>Runde {currentRound}</strong>
        </div>
        <span className="premiumSwipeCount">{index + 1} / {roundMatches.length}</span>
      </div>

      <div className="premiumSwipeFrame">
        <button type="button" className="premiumSwipeArrow left" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Forrige kamp">‹</button>
        <div className="premiumSwipeRail" ref={rail} onScroll={handleScroll}>
          {roundMatches.map(match => {
            const matchTips = tips.filter(t => t.match_id === match.id);
            const ownTip = uid ? matchTips.find(t => t.player_id === uid) : undefined;
            const total = matchTips.length;
            const homeCount = matchTips.filter(t => resultKind(t) === "home").length;
            const drawCount = matchTips.filter(t => resultKind(t) === "draw").length;
            const awayCount = matchTips.filter(t => resultKind(t) === "away").length;
            const pct = (n: number) => total ? Math.round(n / total * 100) : 0;
            const distribution = { total, home: pct(homeCount), draw: pct(drawCount), away: pct(awayCount) };
            const left = timeLeft(match.match_time, match.finished);
            const locked = left.locked;
            const statusClass = match.finished || locked ? "locked" : left.soon ? "soon" : "open";
            const statusText = match.finished ? "🏁 Ferdig" : locked ? "🔴 Låst" : left.soon ? "🟡 Låser snart" : "🟢 Åpen for tips";
            const home = shortTeam(match.home_team);
            const away = shortTeam(match.away_team);

            return <article className="premiumNextCard premiumSwipeSlide" key={match.id}>
              <div className="premiumNextTopline">
                <span className={`premiumGameStatus ${statusClass}`}>{statusText}</span>
                <span className="premiumRoundLabel">Runde {match.round ?? currentRound}</span>
              </div>

              <div className="premiumTeams">
                <div className="premiumTeam"><div className="premiumTeamLogo" aria-hidden>{initials(home)}</div><strong>{home}</strong><small>Hjemme</small></div>
                <div className="premiumVs"><span>VS</span><b>{left.main}</b><small>{left.sub}</small></div>
                <div className="premiumTeam"><div className="premiumTeamLogo" aria-hidden>{initials(away)}</div><strong>{away}</strong><small>Borte</small></div>
              </div>

              <div className="premiumGameMeta"><span>📅 {formatKickoff(match.match_time)}</span><span>🏒 EHL · Runde {match.round ?? currentRound}</span></div>

              <div className="premiumPrediction">
                <div className="premiumPredictionHead"><span>📊 Tipsfordeling</span><small>{distribution.total} levert</small></div>
                {distribution.total > 0 ? <>
                  <div className="premiumPredictionBar"><i className="home" style={{ width: `${distribution.home}%` }} /><i className="draw" style={{ width: `${distribution.draw}%` }} /><i className="away" style={{ width: `${distribution.away}%` }} /></div>
                  <div className="premiumPredictionLabels"><span>{home} <b>{distribution.home}%</b></span><span>X <b>{distribution.draw}%</b></span><span>{away} <b>{distribution.away}%</b></span></div>
                </> : <p className="premiumNoTips">Ingen har levert tips på kampen ennå.</p>}
              </div>

              <div className="premiumNextActions">
                <a href={`/match/${match.id}`} className="premiumSecondaryAction">Se kampside</a>
                <a href={locked ? `/match/${match.id}` : "/tips"} className="premiumMainAction">{locked ? "Se kampen" : ownTip ? `Endre tips · ${ownTip.home_tip}–${ownTip.away_tip}` : "Lever tips"}</a>
              </div>
            </article>;
          })}
        </div>
        <button type="button" className="premiumSwipeArrow right" onClick={() => go(index + 1)} disabled={index >= roundMatches.length - 1} aria-label="Neste kamp">›</button>
      </div>

      <div className="premiumSwipeDots" aria-label="Velg kamp">
        {roundMatches.map((match, i) => <button type="button" key={match.id} onClick={() => go(i)} className={i === index ? "active" : ""} aria-label={`Kamp ${i + 1}`} />)}
      </div>
      <p className="premiumSwipeHint">← Sveip mellom kampene →</p>
    </section>
  );
}
