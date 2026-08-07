import type { SupabaseClient } from "@supabase/supabase-js";

type FinishedMatch = {
  id: number;
  home_score: number;
  away_score: number;
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
) {
  if (homeTip === homeScore && awayTip === awayScore) return 5;
  if (outcome(homeTip, awayTip) === outcome(homeScore, awayScore)) return 3;
  return 0;
}

/**
 * Recalculates points for every tip belonging to a finished match.
 * This is intentionally idempotent: it can safely run after every HockeyLive sync.
 * If a result is corrected upstream, stored tip points are corrected on the next run.
 */
export async function scoreFinishedMatches(supabase: SupabaseClient): Promise<ScoreResult> {
  const { data: matchRows, error: matchError } = await supabase
    .from("matches")
    .select("id,home_score,away_score")
    .eq("finished", true)
    .not("home_score", "is", null)
    .not("away_score", "is", null);

  if (matchError) throw matchError;

  const finishedMatches = (matchRows ?? []) as FinishedMatch[];
  if (!finishedMatches.length) {
    return { finishedMatches: 0, tipsScored: 0, tipsChanged: 0 };
  }

  const matchIds = finishedMatches.map((match) => match.id);
  const matchMap = new Map(finishedMatches.map((match) => [match.id, match]));

  const { data: tipRows, error: tipError } = await supabase
    .from("tips")
    .select("id,match_id,home_tip,away_tip,points")
    .in("match_id", matchIds);

  if (tipError) throw tipError;

  const tips = (tipRows ?? []) as TipRow[];
  let tipsChanged = 0;

  // Supabase REST does not support a heterogeneous bulk update cleanly here,
  // so update only rows whose calculated score changed.
  for (const tip of tips) {
    const match = matchMap.get(tip.match_id);
    if (!match) continue;

    const points = calculateTipPoints(
      tip.home_tip,
      tip.away_tip,
      match.home_score,
      match.away_score,
    );

    if ((tip.points ?? 0) === points) continue;

    const { error } = await supabase
      .from("tips")
      .update({ points })
      .eq("id", tip.id);

    if (error) throw error;
    tipsChanged++;
  }

  return {
    finishedMatches: finishedMatches.length,
    tipsScored: tips.length,
    tipsChanged,
  };
}
