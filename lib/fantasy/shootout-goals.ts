/** Validate HockeyLive scoring events against a final score, including shootouts.
 * A shootout adds exactly one deciding goal to the final score, but no player goal event.
 * Only accept a one-goal discrepancy if the actual events are tied by team and
 * the official score differs by exactly one goal on the winning side.
 */
type Goal = Record<string, unknown>;
function key(v: unknown) { return String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""); }
export function completeGoalFeed(game: {home_score?: number|null; away_score?: number|null; home_team?: string|null; away_team?: string|null}, goals: Goal[]): boolean {
  const home = Number(game.home_score), away = Number(game.away_score);
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) return false;
  const expected = home + away;
  if (goals.length >= expected) return true;
  if (goals.length !== expected - 1 || Math.abs(home-away) !== 1) return false;
  const h = key(game.home_team), a = key(game.away_team);
  if (!h || !a || h === a) return false;
  let homeEvents = 0, awayEvents = 0;
  for (const goal of goals) {
    const team = key(goal.teamName ?? goal.TeamName ?? goal.teamShortName ?? goal.TeamShortName);
    if (team && (team === h || h.includes(team) || team.includes(h))) homeEvents++;
    else if (team && (team === a || a.includes(team) || team.includes(a))) awayEvents++;
    else return false; // Unknown scoring side: never silently excuse a missing goal.
  }
  return homeEvents === awayEvents && homeEvents === Math.min(home,away);
}
