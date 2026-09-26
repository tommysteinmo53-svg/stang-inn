import { calculate19FantasyPoints, type FantasyScoringConfig } from "./scoring";
import type { NifMatchBundle } from "./nif-client";
import { canonicalMatchPlayerExternalId } from "./match-player-identities";
import { plusMinusFromGoals, specialStats, specialTeamsFromGoals } from "./import-enrichment";

const n = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
// Postgres numeric rounds ties away from zero, including negative points.
export const roundPoints = (v: number) => Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;
export function lineupPoints(raw: number, line: number, captain: boolean, vice: boolean,
  rules: { captain?: number; vice?: number; viceEnabled?: boolean; line2?: number } = {}) {
  const base = roundPoints(raw * (line === 2 ? rules.line2 ?? 0.5 : 1));
  const multiplier = captain ? rules.captain ?? 2 : vice && rules.viceEnabled !== false ? rules.vice ?? 1.5 : 1;
  return roundPoints(base + roundPoints(base * (multiplier - 1)));
}

export function liveMatchStats(bundle: NifMatchBundle, home: string, away: string, config: FantasyScoringConfig = {}) {
  const pm = plusMinusFromGoals(bundle.goals, home, away, new Set<string>(), new Set<string>());
  const special = specialTeamsFromGoals(bundle.goals);
  const skaters = new Map(bundle.players.map(r => [canonicalMatchPlayerExternalId(`nif:${r.personId}`), r]));
  const goalies = new Map(bundle.goalies.map(r => [canonicalMatchPlayerExternalId(`nif:${r.personId}`), r]));
  const activity = bundle.players.some(r => n(r.playerTime) > 0 || n(r.playerTimeSeconds) > 0 || n(r.shots) > 0 || n(r.pim) > 0)
    || bundle.goalies.some(r => n(r.saves) > 0 || n(r.goalsAgainst) > 0 || n(r.playerTimeSeconds) > 0) || bundle.goals.length > 0;
  let homeScore = 0, awayScore = 0;
  let scoreKnown = bundle.availability.goals && activity;
  for (const goal of bundle.goals) {
    // A shootout feed is not an ordinary goal count. Wait for the official result.
    if (/shootout|straffeslag/i.test(String(goal.goalType) + " " + String(goal.periodName))) { scoreKnown = false; continue; }
    const side = String(goal.homeOrAwayTeam ?? "").toLowerCase();
    if (side === "h" || side === "home") homeScore++;
    else if (side === "b" || side === "a" || side === "away") awayScore++;
    else scoreKnown = false;
  }
  return {
    score: scoreKnown ? { homeScore, awayScore } : null,
    activity,
    complete: activity && bundle.availability.players && bundle.players.length > 0 && bundle.availability.goalies && bundle.goalies.length > 0 && bundle.availability.goals && pm.unresolvedGoals === 0,
    points(externalId: string, position: string): number | null {
      if (!activity || !externalId) return null;
      if (position === "G") {
        if (!bundle.availability.goalies || !bundle.goalies.length) return null;
        const r = goalies.get(externalId);
        if (!r) return 0;
        return calculate19FantasyPoints({ position, minutesPlayed: n(r.playerTimeSeconds) / 60,
          saves: n(r.saves), goalsAgainst: n(r.goalsAgainst), goals: n(r.goalsScored), assists: n(r.assists),
          pim: n(r.pim), win: false, shutout: false }, config).total;
      }
      if (!bundle.availability.players || !bundle.players.length || !bundle.availability.goals || pm.unresolvedGoals > 0) return null;
      const r = skaters.get(externalId);
      if (!r) return 0;
      const id = String(r.personId), st = special.totals.get(id), face = specialStats(r);
      return calculate19FantasyPoints({ position, didPlay: true, goals: n(r.goalsScored), assists: n(r.assists),
        shots: n(r.shots), pim: n(r.pim), plusMinus: pm.values.get(id) ?? 0,
        powerplayGoals: st?.powerplay_goals, powerplayAssists: st?.powerplay_assists,
        shorthandedGoals: st?.shorthanded_goals, shorthandedAssists: st?.shorthanded_assists,
        faceoffsWon: face.faceoffs_won, faceoffsTaken: face.faceoffs_taken }, config).total;
    },
  };
}
