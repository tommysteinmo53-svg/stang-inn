const NIF_BASE = "https://data.nif.no/api/v1/ta";

export const EHL_TOURNAMENT_ID = process.env.NIF_TOURNAMENT_ID || "448981";
export const EHL_SEASON = process.env.NIF_SEASON_LABEL || "2026/27";

function headers(): HeadersInit {
  const token = process.env.NIF_DATA_TOKEN;
  return token
    ? { Accept: "application/json", Authorization: `Bearer ${token}` }
    : { Accept: "application/json" };
}

export async function fetchTournamentMatches() {
  const url = `${NIF_BASE}/TournamentMatches?TournamentId=${encodeURIComponent(EHL_TOURNAMENT_ID)}`;
  const response = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!response.ok) throw new Error(`NIF TournamentMatches feilet med HTTP ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : payload?.items || payload?.data || payload?.matches || [];
}

export async function fetchTournamentStandings() {
  const url = `${NIF_BASE}/TournamentStandings?TournamentId=${encodeURIComponent(EHL_TOURNAMENT_ID)}`;
  const response = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!response.ok) throw new Error(`NIF TournamentStandings feilet med HTTP ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : payload?.items || payload?.data || payload?.standings || [];
}

export function pick(obj: any, keys: string[]) {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj?.[key] !== null) return obj[key];
  }
  return null;
}

export function normalizeMatch(raw: any) {
  const externalId = String(pick(raw, ["matchId", "MatchId", "id", "Id"]) || "");
  const homeTeam = pick(raw, ["homeTeamName", "HomeTeamName"]) || raw?.homeTeam?.name || raw?.HomeTeam?.name;
  const awayTeam = pick(raw, ["awayTeamName", "AwayTeamName"]) || raw?.awayTeam?.name || raw?.AwayTeam?.name;
  const starts = pick(raw, ["matchStartDate", "MatchStartDate", "matchDate", "MatchDate", "startDate", "date"]);
  const homeScore = pick(raw, ["homeTeamGoals", "HomeTeamGoals", "homeScore", "HomeScore"]);
  const awayScore = pick(raw, ["awayTeamGoals", "AwayTeamGoals", "awayScore", "AwayScore"]);
  const round = pick(raw, ["round", "Round", "roundNo", "RoundNo"]);

  return {
    external_id: externalId,
    season: EHL_SEASON,
    round: round === null ? null : Number(round),
    home_team: homeTeam ? String(homeTeam) : "",
    away_team: awayTeam ? String(awayTeam) : "",
    match_time: starts ? new Date(starts).toISOString() : null,
    home_score: homeScore === null ? null : Number(homeScore),
    away_score: awayScore === null ? null : Number(awayScore),
    finished: homeScore !== null && awayScore !== null,
  };
}
