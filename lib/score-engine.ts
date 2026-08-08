import type { SupabaseClient } from "@supabase/supabase-js";

type FinishedMatch = {
  id: number;
  home_score: number;
  away_score: number;
};

type MatchState = {
  id: number;
  finished: boolean;
  home_score: number | null;
  away_score: number | null;
};

type TipRow = {
  id: number;
  match_id: number;
  home_tip: number;
  away_tip: number;
  points: number | null;
};

export type ScoreResult = {
  finishedMatches: number;
  tipsScored: number;
  tipsChanged: number;
};

type PointRules = { exact: number; outcome: number };

function outcome(home: number, away: number) {
  if (home > away) return "H";
  if (home < away) return "A";
  return "D";
}

export function calculateTipPoints(
  homeTip: number,
  awayTip: number,
  homeScore: number,
  awayScore: number,
  rules: PointRules = { exact: 5, outcome: 3 },
) {
  if (homeTip === homeScore && awayTip === awayScore) return rules.exact;
  if (outcome(homeTip, awayTip) === outcome(homeScore, awayScore)) return rules.outcome;
  return 0;
}

async function loadPointRules(supabase: SupabaseClient): Promise<PointRules> {
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", "points").maybeSingle();
  if (error || !data?.value) return { exact: 5, outcome: 3 };
  const value = data.value as Record<string, unknown>;
  const exact = Number(value.exact ?? 5);
  const outcomePoints = Number(value.outcome ?? 3);
  return {
    exact: Number.isFinite(exact) ? exact : 5,
    outcome: Number.isFinite(outcomePoints) ? outcomePoints : 3,
  };
}

/**
 * Recalculates points for every tip belonging to a valid finished match.
 * If a previously finished match is reopened, postponed or loses its final score,
 * stale points are cleared again. This keeps sync idempotent in both directions.
 */
export async function scoreFinishedMatches(supabase: SupabaseClient): Promise<ScoreResult> {
  const rules = await loadPointRules(supabase);
  const { data: allMatchRows, error: matchError } = await supabase
    .from("matches")
    .select("id,finished,home_score,away_score");

  if (matchError) throw matchError;

  const matches = (allMatchRows ?? []) as MatchState[];
  const finishedMatches: FinishedMatch[] = matches
    .filter(
      (match) =>
        match.finished === true &&
        match.home_score !== null &&
        match.away_score !== null,
    )
    .map((match) => ({
      id: match.id,
      home_score: match.home_score as number,
      away_score: match.away_score as number,
    }));

  const invalidMatchIds = matches
    .filter(
      (match) =>
        match.finished !== true ||
        match.home_score === null ||
        match.away_score === null,
    )
    .map((match) => match.id);

  let tipsChanged = 0;

  // A sync can reopen/postpone a match that was previously scored. Clear those
  // stored points so standings never keep points from a no-longer-final result.
  if (invalidMatchIds.length) {
    const { data: staleTips, error: staleTipError } = await supabase
      .from("tips")
      .select("id")
      .in("match_id", invalidMatchIds)
      .not("points", "is", null);

    if (staleTipError) throw staleTipError;
    const staleTipIds = (staleTips ?? []).map((tip: { id: number }) => tip.id);
    if (staleTipIds.length) {
      const { error: clearError } = await supabase
        .from("tips")
        .update({ points: null })
        .in("id", staleTipIds);
      if (clearError) throw clearError;
      tipsChanged += staleTipIds.length;
    }
  }

  if (!finishedMatches.length) {
    return { finishedMatches: 0, tipsScored: 0, tipsChanged };
  }

  const matchIds = finishedMatches.map((match) => match.id);
  const matchMap = new Map(finishedMatches.map((match) => [match.id, match]));
  const { data: tipRows, error: tipError } = await supabase
    .from("tips")
    .select("id,match_id,home_tip,away_tip,points")
    .in("match_id", matchIds);

  if (tipError) throw tipError;
  const tips = (tipRows ?? []) as TipRow[];

  for (const tip of tips) {
    const match = matchMap.get(tip.match_id);
    if (!match) continue;
    const points = calculateTipPoints(tip.home_tip, tip.away_tip, match.home_score, match.away_score, rules);
    // Null skal ikke behandles som ferdiglagret 0. Vi vil ha eksplisitt 0 i
    // databasen for alle scorede tips, slik at alle visninger bruker samme verdi.
    if (tip.points === points) continue;
    const { error } = await supabase.from("tips").update({ points }).eq("id", tip.id);
    if (error) throw error;
    tipsChanged++;
  }

  return { finishedMatches: finishedMatches.length, tipsScored: tips.length, tipsChanged };
}
