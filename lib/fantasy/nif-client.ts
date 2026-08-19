const PUBLIC_ROOT = "https://sf34-terminlister-prod-app.azurewebsites.net";
const PUBLIC_HOCKEY_BASE = `${PUBLIC_ROOT}/icehockey`;
const PUBLIC_REQUEST_TIMEOUT_MS = 10000;

type Row = Record<string, unknown>;

export type NifMatchBundle = {
  matchId: number;
  players: Row[];
  goalies: Row[];
  goals: Row[];
  penalties: Row[];
  teamMembers: Row[];
  tournamentPlayers: Row[];
  availability: {
    players: boolean;
    goalies: boolean;
    goals: boolean;
    penalties: boolean;
    teamMembers: boolean;
  };
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
    signal: AbortSignal.timeout(PUBLIC_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Offentlig HockeyLive svarte ${response.status}: ${body.slice(0, 240)}`);
  }
  return rowsFrom(await response.json());
}

async function safePublicJson(url: string): Promise<{rows:Row[];ok:boolean}> {
  try { return {rows:await publicJson(url),ok:true}; }
  catch { return {rows:[],ok:false}; }
}

async function hockeyJson(path: string) {
  return publicJson(`${PUBLIC_HOCKEY_BASE}${path}`);
}

export async function fetchNifMatchBundle(matchId: number, tournamentId?: string | number): Promise<NifMatchBundle> {
  if (!Number.isInteger(matchId) || matchId <= 0) throw new Error("Ugyldig matchId");

  const tournamentPromise = tournamentId
    ? safePublicJson(`${PUBLIC_HOCKEY_BASE}/TournamentPlayers/${tournamentId}`)
    : Promise.resolve({rows:[] as Row[],ok:false});

  const [playersRes, goaliesRes, goalsRes, penaltiesRes, teamMembersRes, tournamentRes] = await Promise.all([
    safePublicJson(`${PUBLIC_HOCKEY_BASE}/Match/Players/${matchId}`),
    safePublicJson(`${PUBLIC_HOCKEY_BASE}/Match/GoalieLeaders/${matchId}`),
    safePublicJson(`${PUBLIC_HOCKEY_BASE}/Match/Goals/${matchId}`),
    safePublicJson(`${PUBLIC_HOCKEY_BASE}/Match/Penalties/${matchId}`),
    safePublicJson(`${PUBLIC_ROOT}/ta/MatchTeamMembers/${matchId}`),
    tournamentPromise,
  ]);

  const goalies = goaliesRes.rows.map(normalizeGoalie);
  return {
    matchId,
    players:playersRes.rows,
    goalies,
    goals:goalsRes.rows,
    penalties:penaltiesRes.rows,
    teamMembers:teamMembersRes.rows,
    tournamentPlayers:tournamentRes.rows,
    availability:{
      players:playersRes.ok,
      goalies:goaliesRes.ok,
      goals:goalsRes.ok,
      penalties:penaltiesRes.ok,
      teamMembers:teamMembersRes.ok,
    },
  };
}
