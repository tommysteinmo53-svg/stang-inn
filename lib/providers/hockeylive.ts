import type { ImportedMatch, MatchProvider } from "../../types/data-provider";

const API_BASE = "https://sf34-terminlister-prod-app.azurewebsites.net/";
const DEFAULT_TOURNAMENT_ID = "448981";
const DEFAULT_SEASON_LABEL = "2026/27";

type Row = Record<string, any>;

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

function matchDateTime(raw: Row): string | null {
  const direct = first(raw.matchStartDate, raw.MatchStartDate, raw.startDate, raw.StartDate, raw.dateTime, raw.startTimeUtc);
  if (direct) {
    const date = new Date(String(direct));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const dateValue = first(raw.matchDate, raw.MatchDate, raw.date, raw.Date);
  if (!dateValue) return null;

  const dateText = String(dateValue).slice(0, 10);
  const timeValue = first(raw.matchStartTime, raw.MatchStartTime, raw.startTime);
  let timeText = "00:00";

  if (timeValue !== null) {
    const digits = String(timeValue).replace(/\D/g, "").padStart(4, "0");
    if (digits.length >= 4) timeText = `${digits.slice(-4, -2)}:${digits.slice(-2)}`;
  }

  const date = new Date(`${dateText}T${timeText}:00+02:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalize(raw: Row, season: string): ImportedMatch | null {
  const id = first(raw.matchId, raw.MatchId, raw.matchID, raw.id, raw.Id);
  const home = first(
    raw.homeTeamName,
    raw.HomeTeamName,
    teamName(raw.homeTeam),
    teamName(raw.HomeTeam),
    teamName(raw.home),
    raw.teamNameHome,
  );
  const away = first(
    raw.awayTeamName,
    raw.AwayTeamName,
    teamName(raw.awayTeam),
    teamName(raw.AwayTeam),
    teamName(raw.away),
    raw.teamNameAway,
  );
  const time = matchDateTime(raw);

  if (!id || !home || !away || !time) return null;

  const homeScore = numberOrNull(first(raw.homeTeamGoals, raw.HomeTeamGoals, raw.homeScore, raw.HomeScore, raw.homeGoals));
  const awayScore = numberOrNull(first(raw.awayTeamGoals, raw.AwayTeamGoals, raw.awayScore, raw.AwayScore, raw.awayGoals));
  const statusTypeId = numberOrNull(raw.statusTypeId);
  const finishedByStatus = statusTypeId !== null && statusTypeId >= 4;

  return {
    externalId: `hockeylive:${id}`,
    season,
    round: numberOrNull(first(raw.round, raw.Round, raw.roundNumber, raw.RoundNumber, raw.roundNo)),
    homeTeam: String(home),
    awayTeam: String(away),
    matchTime: time,
    homeScore,
    awayScore,
    finished: finishedByStatus || (homeScore !== null && awayScore !== null),
  };
}

export function createHockeyLiveProvider(): MatchProvider {
  return {
    name: "hockeylive",
    async fetchMatches() {
      const tournamentId = process.env.HOCKEYLIVE_TOURNAMENT_ID || DEFAULT_TOURNAMENT_ID;
      const season = process.env.NIF_SEASON_LABEL || DEFAULT_SEASON_LABEL;
      const endpoint = `${API_BASE}ta/TournamentMatches/?tournamentId=${encodeURIComponent(tournamentId)}`;

      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
          "User-Agent": "StangInn/0.8 (+https://stang-inn-xi.vercel.app)",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HockeyLive API svarte ${response.status}: ${body.slice(0, 180)}`);
      }

      const payload = await response.json();
      const rows: Row[] = Array.isArray(payload) ? payload : payload?.matches ?? payload?.data?.matches ?? [];

      // Samme statusfilter som HockeyLive-klienten bruker.
      const published = rows.filter((row) => row.statusTypeId == null || (row.statusTypeId >= 1 && row.statusTypeId <= 5));
      const normalized = published.map((row) => normalize(row, season)).filter(Boolean) as ImportedMatch[];
      const unique = new Map(normalized.map((match) => [match.externalId, match]));

      if (!unique.size) {
        const sampleKeys = rows[0] ? Object.keys(rows[0]).slice(0, 30).join(", ") : "ingen rader";
        throw new Error(`HockeyLive API svarte med ${rows.length} kamper, men 0 kunne normaliseres. Første rad-felter: ${sampleKeys}`);
      }

      return [...unique.values()].sort((a, b) => a.matchTime.localeCompare(b.matchTime));
    },
  };
}
