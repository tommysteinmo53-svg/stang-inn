"use client";

import { useEffect, useMemo, useState } from "react";
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
    [/Storhamar\s+Elite$/i, "Storhamar"],
    [/Frisk\s+Asker.*$/i, "Frisk Asker"],
    [/Stavanger\s+Oilers.*$/i, "Oilers"],
    [/Vålerenga\s+Ishockey.*$/i, "Vålerenga"],
    [/Narvik\s+Hockey.*$/i, "Narvik"],
    [/Sparta\s+Sarpsborg.*$/i, "Sparta"],
    [/Stjernen\s+Hockey.*$/i, "Stjernen"],
    [/Lillehammer\s+IK.*$/i, "Lillehammer"],
    [/Nidaros\s+Hockey.*$/i, "Nidaros"],
    [/Ringerike\s+Panthers.*$/i, "Ringerike"],
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(n)) return replacement;
  }
  return n.replace(/\s+(Elite|Ishockey|Hockey|IK)\b.*$/i, "").trim();
}

function initials(name: string) {
  return shortTeam(name)
    .split(/\s+/)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatKickoff(value: string | null) {
  if (!value) return "Tidspunkt ikke satt";
  return new Date(value).toLocaleString("no-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeLeft(value: string | null) {
  if (!value) return { main: "–", sub: "Tidspunkt ikke satt", soon: false, locked: false };
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return { main: "Låst", sub: "Kampen har startet", soon: false, locked: true };
  const totalHours = Math.floor(ms / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return { main: `${days} dager`, sub: hours ? `${hours} timer i tillegg` : "til kampstart", soon: days <= 1, locked: false };
  if (totalHours > 0) return { main: `${totalHours}t ${minutes}m`, sub: "til kampstart", soon: totalHours < 6, locked: false };
  return { main: `${minutes} min`, sub: "til kampstart", soon: true, locked: false };
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
  const [, setTick] = useState(0);

  useEffect(() => {
    if (pathname !== "/") return;
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id || null;
      setUid(userId);
      const [m, t] = await Promise.all([
        supabase.from("matches").select("id,home_team,away_team,match_time,finished,round").eq("finished", false).order("match_time", { ascending: true }),
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

  const next = useMemo(() => {
    const now = Date.now();
    return matches.find(m => !m.match_time || new Date(m.match_time).getTime() > now) || matches[0] || null;
  }, [matches]);

  const matchTips = useMemo(() => next ? tips.filter(t => t.match_id === next.id) : [], [tips, next]);
  const ownTip = useMemo(() => uid && next ? matchTips.find(t => t.player_id === uid) : undefined, [uid, next, matchTips]);

  const distribution = useMemo(() => {
    const total = matchTips.length;
    const home = matchTips.filter(t => resultKind(t) === "home").length;
    const draw = matchTips.filter(t => resultKind(t) === "draw").length;
    const away = matchTips.filter(t => resultKind(t) === "away").length;
    const pct = (n: number) => total ? Math.round((n / total) * 100) : 0;
    return { total, home: pct(home), draw: pct(draw), away: pct(away) };
  }, [matchTips]);

  if (pathname !== "/" || !next) return null;

  const left = timeLeft(next.match_time);
  const locked = left.locked;
  const statusClass = locked ? "locked" : left.soon ? "soon" : "open";
  const statusText = locked ? "🔴 Låst" : left.soon ? "🟡 Låser snart" : "🟢 Åpen for tips";
  const home = shortTeam(next.home_team);
  const away = shortTeam(next.away_team);

  return (
    <section className="premiumNextWrap">
      <article className="premiumNextCard">
        <div className="premiumNextTopline">
          <span className={`premiumGameStatus ${statusClass}`}>{statusText}</span>
          <span className="premiumRoundLabel">{next.round ? `Runde ${next.round}` : "EHL 2026/27"}</span>
        </div>

        <div className="premiumTeams">
          <div className="premiumTeam">
            <div className="premiumTeamLogo" aria-hidden>{initials(home)}</div>
            <strong>{home}</strong>
            <small>Hjemme</small>
          </div>
          <div className="premiumVs">
            <span>VS</span>
            <b>{left.main}</b>
            <small>{left.sub}</small>
          </div>
          <div className="premiumTeam">
            <div className="premiumTeamLogo" aria-hidden>{initials(away)}</div>
            <strong>{away}</strong>
            <small>Borte</small>
          </div>
        </div>

        <div className="premiumGameMeta">
          <span>📅 {formatKickoff(next.match_time)}</span>
          {next.round && <span>🏒 EHL · Runde {next.round}</span>}
        </div>

        <div className="premiumPrediction">
          <div className="premiumPredictionHead">
            <span>📊 Tipsfordeling</span>
            <small>{distribution.total} levert</small>
          </div>
          {distribution.total > 0 ? <>
            <div className="premiumPredictionBar" aria-label={`Hjemme ${distribution.home} prosent, uavgjort ${distribution.draw} prosent, borte ${distribution.away} prosent`}>
              <i className="home" style={{ width: `${distribution.home}%` }} />
              <i className="draw" style={{ width: `${distribution.draw}%` }} />
              <i className="away" style={{ width: `${distribution.away}%` }} />
            </div>
            <div className="premiumPredictionLabels">
              <span>{home} <b>{distribution.home}%</b></span>
              <span>X <b>{distribution.draw}%</b></span>
              <span>{away} <b>{distribution.away}%</b></span>
            </div>
          </> : <p className="premiumNoTips">Ingen har levert tips på kampen ennå.</p>}
        </div>

        <div className="premiumNextActions">
          <a href={`/match/${next.id}`} className="premiumSecondaryAction">Se kampside</a>
          <a href={locked ? `/match/${next.id}` : "/tips"} className="premiumMainAction">
            {locked ? "Se kampen" : ownTip ? `Endre tips · ${ownTip.home_tip}–${ownTip.away_tip}` : "Lever tips"}
          </a>
        </div>
      </article>
    </section>
  );
}
