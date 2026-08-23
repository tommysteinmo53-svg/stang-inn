"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type Player = { id: string; display_name: string };
type Match = {
  id: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  finished: boolean;
  round: number | null;
  match_time: string | null;
};
type Tip = {
  player_id: string;
  match_id: number;
  home_tip: number;
  away_tip: number;
  points: number | null;
};
type Award = { icon: string; title: string; player: Player | null; value: string; detail: string };

const isFinal = (match: Match) =>
  match.finished && match.home_score !== null && match.away_score !== null;
const outcome = (home: number, away: number) => (home > away ? "H" : home < away ? "A" : "D");
const isExact = (match: Match, tip: Tip) =>
  match.home_score !== null &&
  match.away_score !== null &&
  tip.home_tip === match.home_score &&
  tip.away_tip === match.away_score;
const isCorrectOutcome = (match: Match, tip: Tip) =>
  match.home_score !== null &&
  match.away_score !== null &&
  outcome(tip.home_tip, tip.away_tip) === outcome(match.home_score, match.away_score);

function monthKey(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthIsClosed(key: string, now = new Date()) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month, 1).getTime() <= now.getTime();
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("no-NO", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1, 12),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function AwardsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setLoading(false);
        return;
      }
      const [playerResult, matchResult, tipResult] = await Promise.all([
        supabase.from("players").select("id,display_name"),
        supabase
          .from("matches")
          .select("id,home_team,away_team,home_score,away_score,finished,round,match_time")
          .order("match_time"),
        supabase.from("tips").select("player_id,match_id,home_tip,away_tip,points"),
      ]);
      setPlayers((playerResult.data || []) as Player[]);
      setMatches((matchResult.data || []) as Match[]);
      setTips((tipResult.data || []) as Tip[]);
      setLoading(false);
    })();
  }, []);

  const data = useMemo(() => {
    const finished = matches.filter(isFinal);
    const matchMap = new Map(finished.map((match) => [match.id, match]));
    const finishedIds = new Set(finished.map((match) => match.id));

    // Point-based awards use only persisted points from the production score engine.
    // We deliberately do not recalculate 5/3/0 in the browser, so app_settings
    // changes or corrected results cannot make awards drift from authoritative scoring.
    const scored = tips.filter((tip) => finishedIds.has(tip.match_id) && tip.points !== null);
    const finishedTips = tips.filter((tip) => finishedIds.has(tip.match_id));
    const pointsFor = (tip: Tip) => Number(tip.points ?? 0);

    const summarize = (player: Player, rows: Tip[]) => {
      let exact = 0;
      let correct = 0;
      let points = 0;
      for (const tip of rows) {
        const match = matchMap.get(tip.match_id);
        if (!match) continue;
        points += pointsFor(tip);
        if (isExact(match, tip)) exact += 1;
        else if (isCorrectOutcome(match, tip)) correct += 1;
      }
      return { p: player, points, exact, correct, tipped: rows.length };
    };

    const byPlayer = players.map((player) =>
      summarize(
        player,
        scored.filter((tip) => tip.player_id === player.id),
      ),
    );
    const sniper = scored.length
      ? [...byPlayer].sort(
          (a, b) =>
            b.exact - a.exact ||
            b.points - a.points ||
            b.correct - a.correct ||
            a.p.display_name.localeCompare(b.p.display_name, "no"),
        )[0]
      : null;

    let streak: { p: Player; n: number } | null = null;
    if (scored.length) {
      for (const player of players) {
        let current = 0;
        let best = 0;
        for (const match of [...finished].sort((a, b) =>
          (a.match_time || "").localeCompare(b.match_time || ""),
        )) {
          const tip = scored.find(
            (candidate) => candidate.player_id === player.id && candidate.match_id === match.id,
          );
          if (tip && pointsFor(tip) > 0) {
            current += 1;
            best = Math.max(best, current);
          } else {
            current = 0;
          }
        }
        if (best > 0 && (!streak || best > streak.n)) streak = { p: player, n: best };
      }
    }

    const roundNumbers = [
      ...new Set(matches.map((match) => match.round).filter((round): round is number => round !== null)),
    ].sort((a, b) => a - b);
    const completedRounds = roundNumbers.filter((round) => {
      const roundMatches = matches.filter((match) => match.round === round);
      return roundMatches.length > 0 && roundMatches.every(isFinal);
    });
    const latestRound = completedRounds.at(-1);
    let roundWinner: ReturnType<typeof summarize> | null = null;
    if (latestRound !== undefined) {
      const roundIds = new Set(finished.filter((match) => match.round === latestRound).map((match) => match.id));
      const rows = players
        .map((player) =>
          summarize(
            player,
            scored.filter((tip) => tip.player_id === player.id && roundIds.has(tip.match_id)),
          ),
        )
        .sort(
          (a, b) =>
            b.points - a.points ||
            b.exact - a.exact ||
            b.correct - a.correct ||
            a.p.display_name.localeCompare(b.p.display_name, "no"),
        );
      roundWinner = rows.find((row) => row.tipped > 0) || null;
    }

    const closedScoredMonths = [
      ...new Set(
        scored
          .map((tip) => monthKey(matchMap.get(tip.match_id)?.match_time || null))
          .filter((key): key is string => key !== null && monthIsClosed(key)),
      ),
    ].sort();
    const latestClosedMonth = closedScoredMonths.at(-1);
    let monthlyWinner: ReturnType<typeof summarize> | null = null;
    if (latestClosedMonth) {
      const monthIds = new Set(
        finished
          .filter((match) => monthKey(match.match_time) === latestClosedMonth)
          .map((match) => match.id),
      );
      monthlyWinner = players
        .map((player) =>
          summarize(
            player,
            scored.filter((tip) => tip.player_id === player.id && monthIds.has(tip.match_id)),
          ),
        )
        .filter((row) => row.tipped > 0)
        .sort(
          (a, b) =>
            b.points - a.points ||
            b.exact - a.exact ||
            b.correct - a.correct ||
            a.p.display_name.localeCompare(b.p.display_name, "no"),
        )[0] || null;
    }

    let miss: { p: Player; distance: number; match: Match; tip: Tip } | null = null;
    for (const tip of finishedTips) {
      const match = matchMap.get(tip.match_id);
      const player = players.find((candidate) => candidate.id === tip.player_id);
      if (!match || !player) continue;
      const distance =
        Math.abs(tip.home_tip - match.home_score!) + Math.abs(tip.away_tip - match.away_score!);
      if (!miss || distance > miss.distance) miss = { p: player, distance, match, tip };
    }

    const awards: Award[] = [
      {
        icon: "🏆",
        title: "Rundevinner",
        player: roundWinner?.p || null,
        value: roundWinner ? `${roundWinner.points} poeng` : "–",
        detail: latestRound !== undefined ? `Runde ${latestRound}` : "Ingen ferdigspilte runder",
      },
      {
        icon: "📅",
        title: "Månedsvinner",
        player: monthlyWinner?.p || null,
        value: monthlyWinner ? `${monthlyWinner.points} poeng` : "–",
        detail: latestClosedMonth
          ? monthLabel(latestClosedMonth)
          : "Kåres etter første avsluttede kalendermåned med scorede tips",
      },
      {
        icon: "🎯",
        title: "Sniper",
        player: sniper?.p || null,
        value: sniper ? `${sniper.exact} eksakte` : "–",
        detail: "Flest eksakte tips denne sesongen",
      },
      {
        icon: "🔥",
        title: "Beste streak",
        player: streak?.p || null,
        value: streak ? `${streak.n} på rad` : "–",
        detail: "Lengste rekke med poenggivende tips",
      },
      {
        icon: "💥",
        title: "Sesongens bom",
        player: miss?.p || null,
        value: miss ? `${miss.tip.home_tip}–${miss.tip.away_tip}` : "–",
        detail: miss
          ? `${miss.match.home_team}–${miss.match.away_team} endte ${miss.match.home_score}–${miss.match.away_score}`
          : "Ingen ferdige kamper",
      },
    ];
    return awards;
  }, [players, matches, tips]);

  if (loading) {
    return (
      <main className="appShell">
        <p className="muted">Laster awards …</p>
      </main>
    );
  }

  return (
    <main className="appShell">
      <header className="topbar">
        <a href="/" className="brand brandButton" style={{ textDecoration: "none" }}>
          <div className="brandMark">🏒</div>
          <div>
            <p className="eyebrow">Hall of fame</p>
            <h1>Awards</h1>
          </div>
        </a>
      </header>
      <section className="pageStack" style={{ marginTop: 22 }}>
        <article className="heroCard">
          <div>
            <p className="eyebrow">Prestasjoner</p>
            <h2>Hvem utmerker seg?</h2>
            <p className="muted">Kåringer bruker poengene fra den autoritative tippingmotoren.</p>
          </div>
          <div className="countdown">
            <strong>🏅</strong>
            <span>Stang Inn</span>
          </div>
        </article>
        <section className="awardsGrid">
          {data.map((award) => (
            <article className="awardCard" key={award.title}>
              <div className="awardIcon">{award.icon}</div>
              <p className="eyebrow">{award.title}</p>
              <h2>{award.player?.display_name || "Ikke kåret"}</h2>
              <strong>{award.value}</strong>
              <p className="muted">{award.detail}</p>
              {award.player && <a href={`/player/${award.player.id}`}>Se spillerprofil →</a>}
            </article>
          ))}
        </section>
        <article className="panel">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">Sesongen</p>
              <h3>Kåringer aktiveres av faktiske resultater</h3>
            </div>
          </div>
          <p className="muted">
            Poengbaserte kåringer bruker bare tips som er scoret av produksjonsmotoren. Månedsvinner kåres
            først når kalendermåneden er avsluttet.
          </p>
        </article>
      </section>
    </main>
  );
}
