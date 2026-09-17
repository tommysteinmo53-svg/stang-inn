type Row = Record<string, any>;
const score = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
};
const first = (...values: any[]) => values.find(v => v !== null && v !== undefined && v !== "");

/** HockeyLive's own NI match-state selector treats matchResult as a final result.
 * statusTypeId describes the administrative fixture, not live match completion.
 * Require an internally consistent published result, not just a live score or elapsed time.
 */
export function hockeyLiveResult(raw: Row) {
  const result = raw.matchResult;
  const publishedHome = score(result?.homeGoals), publishedAway = score(result?.awayGoals);
  const end = typeof result?.matchEndResult === "string" ? result.matchEndResult.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/) : null;
  const published = publishedHome !== null && publishedAway !== null && !!end && Number(end[1]) === publishedHome && Number(end[2]) === publishedAway;
  const home = published ? publishedHome : score(first(raw.hometeamScore, raw.homeTeamScore, raw.hometeamGoals, raw.homeTeamGoals, raw.HomeTeamGoals, raw.homeScore, raw.HomeScore, raw.homeGoals));
  const away = published ? publishedAway : score(first(raw.awayteamScore, raw.awayTeamScore, raw.awayteamGoals, raw.awayTeamGoals, raw.AwayTeamGoals, raw.awayScore, raw.AwayScore, raw.awayGoals));
  const explicit = [raw.finished, raw.isFinished, raw.matchFinished].some(v => v === true);
  const legacy = raw.matchResult === undefined && Number(raw.statusTypeId) >= 4;
  return {homeScore: home, awayScore: away, finished: home !== null && away !== null && (published || explicit || legacy)};
}
