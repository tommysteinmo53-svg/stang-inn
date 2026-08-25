import type { ImportedMatch, MatchProvider } from "../../types/data-provider";

const API_BASE = "https://sf34-terminlister-prod-app.azurewebsites.net/";
const DEFAULT_TOURNAMENT_ID = "448981";
const DEFAULT_SEASON_LABEL = "2026/27";
const HOCKEYLIVE_TIMEOUT_MS = 10_000;

type Row = Record<string, any>;

export type ImportedStanding = {
  season: string;
  team: string;
  position: number;
  played: number;
  points: number;
};

function first(...values: any[]) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function teamName(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return first(value.name, value.teamName, value.shortName, value.clubName);
}

function parseRound(raw: Row): number | null {
  const direct = numberOrNull(first(raw.round, raw.Round, raw.roundNumber, raw.RoundNumber, raw.roundNo));
  if (direct !== null) return direct;
  const roundName = first(raw.roundName, raw.RoundName);
  if (roundName) {
    const match = String(roundName).match(/\d+/);
    if (match) return Number(match[0]);
  }
  return null;
}

function osloOffsetForDate(year: number, month: number, day: number) {
  const lastSunday = (y: number, m: number) => {
    const d = new Date(Date.UTC(y, m, 0));
    return d.getUTCDate() - d.getUTCDay();
  };
  if (month < 3 || month > 10) return "+01:00";
  if (month > 3 && month < 10) return "+02:00";
  if (month === 3) return day >= lastSunday(year, 3) ? "+02:00" : "+01:00";
  return day < lastSunday(year, 10) ? "+02:00" : "+01:00";
}

function matchDateTime(raw: Row): string | null {
  const direct = first(raw.matchStartDate, raw.MatchStartDate, raw.startDate, raw.StartDate, raw.dateTime, raw.startTimeUtc);
  if (direct) {
    const text = String(direct);
    if (/Z$|[+-]\d{2}:?\d{2}$/.test(text)) {
      const date = new Date(text);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }

  const dateValue = first(raw.matchDate, raw.MatchDate, raw.date, raw.Date, direct);
  if (!dateValue) return null;
  const dateText = String(dateValue).slice(0, 10);
  const parts = dateText.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let year: number, month: number, day: number;
  if (parts) {
    year = Number(parts[1]); month = Number(parts[2]); day = Number(parts[3]);
  } else {
    const parsed = new Date(String(dateValue));
    if (Number.isNaN(parsed.getTime())) return null;
    year = parsed.getFullYear(); month = parsed.getMonth() + 1; day = parsed.getDate();
  }
  const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timeValue = first(raw.matchStartTime, raw.MatchStartTime, raw.startTime, direct && String(direct).slice(11, 16));
  let timeText = "00:00";
  if (timeValue !== null) {
    const rawTime = String(timeValue);
    const colon = rawTime.match(/(\d{1,2}):(\d{2})/);
    if (colon) timeText = `${colon[1].padStart(2, "0")}:${colon[2]}`;
    else {
      const digits = rawTime.replace(/\D/g, "").padStart(4, "0");
      if (digits.length >= 4) timeText = `${digits.slice(-4, -2)}:${digits.slice(-2)}`;
    }
  }
  const date = new Date(`${ymd}T${timeText}:00${osloOffsetForDate(year, month, day)}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalize(raw: Row, season: string): ImportedMatch | null {
  const id = first(raw.matchId, raw.MatchId, raw.matchID, raw.id, raw.Id);
  const home = first(raw.hometeamOverriddenName, raw.hometeam, raw.hometeamOrgName, raw.homeTeamName, raw.HomeTeamName, teamName(raw.homeTeam), teamName(raw.HomeTeam), teamName(raw.home), raw.teamNameHome);
  const away = first(raw.awayteamOverriddenName, raw.awayteam, raw.awayteamOrgName, raw.awayTeamName, raw.AwayTeamName, teamName(raw.awayTeam), teamName(raw.AwayTeam), teamName(raw.away), raw.teamNameAway);
  const time = matchDateTime(raw);
  if (!id || !home || !away || !time) return null;
  const homeScore = numberOrNull(first(raw.hometeamScore, raw.homeTeamScore, raw.hometeamGoals, raw.homeTeamGoals, raw.HomeTeamGoals, raw.homeScore, raw.HomeScore, raw.homeGoals));
  const awayScore = numberOrNull(first(raw.awayteamScore, raw.awayTeamScore, raw.awayteamGoals, raw.awayTeamGoals, raw.AwayTeamGoals, raw.awayScore, raw.AwayScore, raw.awayGoals));
  const statusTypeId = numberOrNull(raw.statusTypeId);
  const finishedByStatus = statusTypeId !== null && statusTypeId >= 4;
  const finishedFallback = statusTypeId === null && Boolean(first(raw.finished, raw.isFinished, raw.matchFinished));
  return { externalId: `hockeylive:${id}`, season, round: parseRound(raw), homeTeam: String(home), awayTeam: String(away), matchTime: time, homeScore, awayScore, finished: finishedByStatus || finishedFallback };
}

function normalizeStanding(raw: Row, season: string): ImportedStanding | null {
  const nestedTeam = first(raw.team, raw.Team, raw.tournamentTeam, raw.TournamentTeam);
  const team = first(
    raw.teamName,
    raw.TeamName,
    raw.tournamentTeamName,
    raw.TournamentTeamName,
    raw.teamOverriddenName,
    raw.orgName,
    raw.clubName,
    teamName(nestedTeam),
  );
  const position = numberOrNull(first(raw.position, raw.Position, raw.rank, raw.Rank, raw.place, raw.Place, raw.tablePosition, raw.standing));
  if (!team || position === null || position < 1 || position > 10) return null;
  const played = numberOrNull(first(raw.played, raw.Played, raw.matchesPlayed, raw.MatchesPlayed, raw.playedMatches, raw.gamesPlayed, raw.numberOfMatches)) ?? 0;
  const points = numberOrNull(first(raw.points, raw.Points, raw.tablePoints, raw.TablePoints, raw.score, raw.Score)) ?? 0;
  return { season, team: String(team), position, played, points };
}

async function fetchJson(endpoint: string) {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { Accept: "application/json", "User-Agent": "StangInn/0.9 (+https://stang-inn-xi.vercel.app)" },
      cache: "no-store",
      signal: AbortSignal.timeout(HOCKEYLIVE_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error(`HockeyLive API svarte ikke innen ${HOCKEYLIVE_TIMEOUT_MS / 1000} sekunder`);
    }
    throw error;
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HockeyLive API svarte ${response.status}: ${body.slice(0, 180)}`);
  }
  return response.json();
}

export async function fetchHockeyLiveStandings(): Promise<ImportedStanding[]> {
  const tournamentId = process.env.HOCKEYLIVE_TOURNAMENT_ID || DEFAULT_TOURNAMENT_ID;
  const season = process.env.NIF_SEASON_LABEL || DEFAULT_SEASON_LABEL;
  const endpoint = `${API_BASE}ta/TournamentStandings/?tournamentId=${encodeURIComponent(tournamentId)}`;
  const payload = await fetchJson(endpoint);
  const rows: Row[] = Array.isArray(payload)
    ? payload
    : payload?.standings ?? payload?.rows ?? payload?.data?.standings ?? payload?.data ?? [];
  const normalized = rows.map((row) => normalizeStanding(row, season)).filter(Boolean) as ImportedStanding[];
  const unique = new Map(normalized.map((standing) => [standing.team, standing]));
  const result = [...unique.values()].sort((a, b) => a.position - b.position);
  if (!result.length) {
    const sample = rows[0] ?? {};
    const sampleKeys = Object.keys(sample).slice(0, 45).join(", ") || "ingen rader";
    throw new Error(`TournamentStandings ga ${rows.length} rader, men 0 kunne normaliseres. Første rad-felter: ${sampleKeys}`);
  }
  return result;
}

export function createHockeyLiveProvider(): MatchProvider {
  return {
    name: "hockeylive",
    async fetchMatches() {
      const tournamentId = process.env.HOCKEYLIVE_TOURNAMENT_ID || DEFAULT_TOURNAMENT_ID;
      const season = process.env.NIF_SEASON_LABEL || DEFAULT_SEASON_LABEL;
      const endpoint = `${API_BASE}ta/TournamentMatches/?tournamentId=${encodeURIComponent(tournamentId)}`;
      const payload = await fetchJson(endpoint);
      const rows: Row[] = Array.isArray(payload) ? payload : payload?.matches ?? payload?.data?.matches ?? [];
      const published = rows.filter((row) => row.statusTypeId == null || (row.statusTypeId >= 1 && row.statusTypeId <= 5));
      const normalized = published.map((row) => normalize(row, season)).filter(Boolean) as ImportedMatch[];
      const unique = new Map(normalized.map((match) => [match.externalId, match]));
      if (!unique.size) {
        const sample = rows[0] ?? {};
        const sampleKeys = Object.keys(sample).slice(0, 45).join(", ") || "ingen rader";
        throw new Error(`HockeyLive API svarte med ${rows.length} kamper, men 0 kunne normaliseres. Første rad-felter: ${sampleKeys}`);
      }
      return [...unique.values()].sort((a, b) => a.matchTime.localeCompare(b.matchTime));
    },
  };
}
