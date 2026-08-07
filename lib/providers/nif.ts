import type { ImportedMatch, MatchProvider } from "../../types/data-provider";

const BASE_URL = "https://data.nif.no/api/v1/ta";

function first<T>(...values: T[]): T | null {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalize(raw: any, season: string): ImportedMatch | null {
  const externalId = String(first(raw.matchId, raw.MatchId, raw.MatchID, raw.id, raw.Id) ?? "");
  const homeTeam = first(raw.homeTeamName, raw.HomeTeamName, raw.homeTeam?.name, raw.HomeTeam?.name);
  const awayTeam = first(raw.awayTeamName, raw.AwayTeamName, raw.awayTeam?.name, raw.AwayTeam?.name);
  const matchTime = first(raw.matchStartDate, raw.MatchStartDate, raw.matchDate, raw.MatchDate, raw.startDate, raw.StartDate, raw.date);
  const round = asNumber(first(raw.round, raw.Round, raw.roundNumber, raw.RoundNumber));
  const homeScore = asNumber(first(raw.homeTeamGoals, raw.HomeTeamGoals, raw.homeScore, raw.HomeScore));
  const awayScore = asNumber(first(raw.awayTeamGoals, raw.AwayTeamGoals, raw.awayScore, raw.AwayScore));

  if (!externalId || !homeTeam || !awayTeam || !matchTime) return null;

  return {
    externalId,
    season,
    round,
    homeTeam: String(homeTeam),
    awayTeam: String(awayTeam),
    matchTime: new Date(String(matchTime)).toISOString(),
    homeScore,
    awayScore,
    finished: homeScore !== null && awayScore !== null,
  };
}

export function createNifProvider(): MatchProvider {
  return {
    name: "nif",
    async fetchMatches() {
      const tournamentId = process.env.NIF_TOURNAMENT_ID || "448981";
      const season = process.env.NIF_SEASON_LABEL || "2026/27";
      const token = process.env.NIF_DATA_TOKEN;

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${BASE_URL}/TournamentMatches?TournamentId=${encodeURIComponent(tournamentId)}`, {
        headers,
        cache: "no-store",
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`NIF svarte ${response.status}: ${body.slice(0, 220)}`);
      }

      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : payload?.matches || payload?.items || payload?.data || [];

      return rows.map((row: any) => normalize(row, season)).filter(Boolean) as ImportedMatch[];
    },
  };
}
