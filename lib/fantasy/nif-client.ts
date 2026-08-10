const PUBLIC_ROOT = "https://sf34-terminlister-prod-app.azurewebsites.net";
const PUBLIC_HOCKEY_BASE = `${PUBLIC_ROOT}/icehockey`;

type Row = Record<string, unknown>;

export type NifMatchBundle = {
  matchId: number;
  players: Row[];
  goalies: Row[];
  goals: Row[];
  penalties: Row[];
  teamMembers: Row[];
  tournamentPlayers: Row[];
};

function rowsFrom(payload: unknown): Row[] {
  if (Array.isArray(payload)) return payload as Row[];
  if (!payload || typeof payload !== "object") return [];
  const value = payload as Record<string, unknown>;
  for (const key of ["data", "items", "players", "goalies", "goals", "penalties", "members", "result", "results"]) {
    if (Array.isArray(value[key])) return value[key] as Row[];
  }
  return [];
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeGoalie(row: Row): Row {
  const shots = numberValue(row.shots ?? row.Shots);
  const saves = numberValue(row.sv ?? row.SV ?? row.saves ?? row.Saves);
  const secondsPlayed = numberValue(row.secondsPlayed ?? row.SecondsPlayed);
  return { ...row, saves, goalsAgainst: Math.max(0, shots - saves), playerTimeSeconds: secondsPlayed };
}

async function publicJson(url: string): Promise<Row[]> {
  const response = await fetch(url, {
    headers: { Accept: "application/json,text/plain,*/*", "User-Agent": "StangInn/1.0 fantasy-match-import" },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Offentlig HockeyLive svarte ${response.status}: ${body.slice(0, 240)}`);
  }
  return rowsFrom(await response.json());
}

async function hockeyJson(path: string) {
  return publicJson(`${PUBLIC_HOCKEY_BASE}${path}`);
}

export async function fetchNifMatchBundle(matchId: number, tournamentId?: string | number): Promise<NifMatchBundle> {
  if (!Number.isInteger(matchId) || matchId <= 0) throw new Error("Ugyldig matchId");
  const tournamentPromise = tournamentId
    ? hockeyJson(`/TournamentPlayers/${tournamentId}`).catch(() => [])
    : Promise.resolve([] as Row[]);
  const [players, rawGoalies, goals, penalties, teamMembers, tournamentPlayers] = await Promise.all([
    hockeyJson(`/Match/Players/${matchId}`),
    hockeyJson(`/Match/GoalieLeaders/${matchId}`),
    hockeyJson(`/Match/Goals/${matchId}`),
    hockeyJson(`/Match/Penalties/${matchId}`),
    publicJson(`${PUBLIC_ROOT}/ta/MatchTeamMembers/${matchId}`),
    tournamentPromise,
  ]);
  const goalies = rawGoalies.map(normalizeGoalie);
  return { matchId, players, goalies, goals, penalties, teamMembers, tournamentPlayers };
}
