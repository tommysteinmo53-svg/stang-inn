// HockeyLive's final score includes one shootout winner that is not a player goal.
// Only reconcile that difference when the event feed proves a tied game before the
// extra final-score goal. A one-goal deficit alone is NOT sufficient evidence.
type Goal = Record<string, unknown>;
function teamKey(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("nb-NO").replace(/[^a-z0-9æøå]/g, "");
}
export function isShootoutScoreDifference(input: {
  homeScore: number; awayScore: number; homeTeam: string; awayTeam: string; goals: Goal[];
}): boolean {
  const { homeScore, awayScore, homeTeam, awayTeam, goals } = input;
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) return false;
  if (Math.abs(homeScore - awayScore) !== 1 || goals.length !== homeScore + awayScore - 1) return false;
  const home = teamKey(homeTeam), away = teamKey(awayTeam);
  if (!home || !away || home === away) return false;
  let homeGoals = 0, awayGoals = 0;
  for (const goal of goals) {
    const team = teamKey(goal.teamName ?? goal.TeamName ?? goal.teamShortName ?? goal.TeamShortName);
    if (!team) return false;
    const matchesHome = team === home || team.includes(home) || home.includes(team);
    const matchesAway = team === away || team.includes(away) || away.includes(team);
    if (matchesHome === matchesAway) return false;
    if (matchesHome) homeGoals++; else awayGoals++;
  }
  return homeGoals === awayGoals
    && homeScore === homeGoals + (homeScore > awayScore ? 1 : 0)
    && awayScore === awayGoals + (awayScore > homeScore ? 1 : 0);
}
