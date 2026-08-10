const PUBLIC_HOCKEY_BASE = "https://sf34-terminlister-prod-app.azurewebsites.net/icehockey";

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

async function hockeyJson(path: string): Promise<Row[]> {
  const response = await fetch(`${PUBLIC_HOCKEY_BASE}${path}`, {
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent": "StangInn/1.0 fantasy-match-import",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Offentlig HockeyLive ${path} svarte ${response.status}: ${body.slice(0, 240)}`);
  }

  return rowsFrom(await response.json());
}

export async function fetchNifMatchBundle(matchId: number): Promise<NifMatchBundle> {
  if (!Number.isInteger(matchId) || matchId <= 0) throw new Error("Ugyldig matchId");

  const [players, goalies, goals, penalties] = await Promise.all([
    hockeyJson(`/Match/Players/${matchId}`),
    hockeyJson(`/Match/GoalieLeaders/${matchId}`),
    hockeyJson(`/Match/Goals/${matchId}`),
    hockeyJson(`/Match/Penalties/${matchId}`),
  ]);

  return { matchId, players, goalies, goals, penalties };
}
