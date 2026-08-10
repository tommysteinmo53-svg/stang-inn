const NIF_BASE = "https://data.nif.no/api/v1/icehockey";

type Row = Record<string, unknown>;

export type NifMatchBundle = {
  matchId: number;
  players: Row[];
  goalies: Row[];
  goals: Row[];
  penalties: Row[];
};

function rowsFrom(payload: unknown): Row[] {
  if (Array.isArray(payload)) return payload as Row[];
  if (!payload || typeof payload !== "object") return [];
  const value = payload as Record<string, unknown>;
  for (const key of ["data", "items", "players", "goalies", "goals", "penalties", "result", "results"]) {
    if (Array.isArray(value[key])) return value[key] as Row[];
  }
  return [];
}

async function nifJson(path: string): Promise<Row[]> {
  const token = process.env.NIF_DATA_TOKEN;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${NIF_BASE}${path}`, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`NIF ${path} svarte ${response.status}: ${body.slice(0, 240)}`);
  }

  return rowsFrom(await response.json());
}

export async function fetchNifMatchBundle(matchId: number): Promise<NifMatchBundle> {
  if (!Number.isInteger(matchId) || matchId <= 0) throw new Error("Ugyldig matchId");

  const [players, goalies, goals, penalties] = await Promise.all([
    nifJson(`/Match/Players/${matchId}`),
    nifJson(`/Match/GoalieLeaders/${matchId}`),
    nifJson(`/Match/Goals/${matchId}`),
    nifJson(`/Match/Penalties/${matchId}`),
  ]);

  return { matchId, players, goalies, goals, penalties };
}
