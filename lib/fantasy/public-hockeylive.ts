type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Candidate = Record<string, unknown>;

export type PublicSeasonStat = {
  playerKey: string;
  name: string;
  team: string;
  kind: "skater" | "goalie";
  position: "G" | "D" | "W" | "C" | null;
  gamesPlayed: number;
  goals: number;
  assists: number;
  shots: number;
  plusMinus: number;
  pim: number;
  wins: number;
  shutouts: number;
  saves: number;
  goalsAgainst: number;
  raw: Record<string, unknown>;
};

export type PublicStatsProbe = {
  source: string;
  url: string;
  status: number;
  contentType: string | null;
  htmlLength: number;
  embeddedJsonObjects: number;
  candidateRows: Candidate[];
  tableHeaders: string[];
};

function decodeHtml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function slug(value: string) {
  return value.toLocaleLowerCase("nb-NO").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function embeddedJson(html: string): Json[] {
  const results: Json[] = [];
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const text = match[1]?.trim();
    if (!text) continue;
    if (!(text.startsWith("{") || text.startsWith("["))) continue;
    try { results.push(JSON.parse(text)); } catch { /* non-JSON script */ }
  }
  return results;
}

function looksLikeStatRow(value: Candidate) {
  const keys = Object.keys(value).map((key) => key.toLowerCase().replace(/[_-]/g, ""));
  const hasPlayer = keys.some((key) => ["player", "playername", "name", "fullname", "personname"].includes(key));
  const hits = ["goals", "assists", "plusminus", "pim", "shotsongoal", "saves", "goalsagainst", "gp", "gamesplayed"]
    .filter((needle) => keys.some((key) => key.includes(needle))).length;
  return hasPlayer && hits >= 2;
}

function walk(value: Json, output: Candidate[], seen: Set<object>) {
  if (!value || typeof value !== "object" || seen.has(value as object)) return;
  seen.add(value as object);
  if (!Array.isArray(value) && looksLikeStatRow(value as Candidate)) output.push(value as Candidate);
  if (Array.isArray(value)) for (const item of value) walk(item, output, seen);
  else for (const item of Object.values(value)) walk(item, output, seen);
}

function tableHeaders(html: string) {
  const headers: string[] = [];
  for (const match of html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)) {
    const value = stripTags(match[1] || "");
    if (value && !headers.includes(value)) headers.push(value);
  }
  return headers.slice(0, 40);
}

function tableRows(html: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (const table of html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)) {
    const body = table[1] || "";
    const headers = [...body.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => stripTags(m[1] || ""));
    if (!headers.some((h) => h.toUpperCase() === "PLAYER")) continue;
    for (const tr of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1] || ""));
      if (!cells.length || cells.length < headers.length) continue;
      const row: Record<string, string> = {};
      headers.forEach((header, index) => { if (header) row[header] = cells[index] ?? ""; });
      if (row.PLAYER) rows.push(row);
    }
  }
  return rows;
}

function candidateRows(html: string) {
  const candidates: Candidate[] = [];
  const seen = new Set<object>();
  for (const item of embeddedJson(html)) walk(item, candidates, seen);
  return candidates;
}

function valueFrom(row: Candidate, ...keys: string[]) {
  const entries = Object.entries(row);
  for (const key of keys) {
    const normalized = key.toLowerCase().replace(/[_-]/g, "");
    const found = entries.find(([k]) => k.toLowerCase().replace(/[_-]/g, "") === normalized);
    if (found && found[1] !== undefined && found[1] !== null) return found[1];
  }
  return null;
}

function normalizeRow(row: Candidate, kind: "skater" | "goalie"): PublicSeasonStat | null {
  const name = String(valueFrom(row, "PLAYER", "playerName", "name", "fullName", "personName") || "").trim();
  const team = String(valueFrom(row, "TEAM", "teamName", "team", "clubName", "orgName") || "").trim();
  if (!name || !team) return null;
  const rawPosition = String(valueFrom(row, "position", "pos", "playerPosition") || "").toLowerCase();
  const position = kind === "goalie" ? "G" : rawPosition.includes("back") || rawPosition === "d" ? "D" : rawPosition.includes("center") || rawPosition === "c" ? "C" : rawPosition.includes("wing") || rawPosition.includes("ving") || rawPosition === "lw" || rawPosition === "rw" ? "W" : null;
  const explicitId = String(valueFrom(row, "personId", "playerId", "id") || "").trim();
  return {
    playerKey: explicitId ? `hockeylive:${explicitId}` : `hockeylive-name:${slug(team)}:${slug(name)}`,
    name,
    team,
    kind,
    position,
    gamesPlayed: numberValue(valueFrom(row, "GP", "gamesPlayed")),
    goals: kind === "skater" ? numberValue(valueFrom(row, "G", "goals")) : 0,
    assists: kind === "skater" ? numberValue(valueFrom(row, "A", "assists")) : 0,
    shots: kind === "skater" ? numberValue(valueFrom(row, "SOG", "shotsOnGoal", "shots")) : 0,
    plusMinus: kind === "skater" ? numberValue(valueFrom(row, "+/-", "plusMinus")) : 0,
    pim: kind === "skater" ? numberValue(valueFrom(row, "PIM", "penaltyMinutes")) : 0,
    wins: kind === "goalie" ? numberValue(valueFrom(row, "W", "wins")) : 0,
    shutouts: kind === "goalie" ? numberValue(valueFrom(row, "SO", "shutouts")) : 0,
    saves: kind === "goalie" ? numberValue(valueFrom(row, "SV", "saves")) : 0,
    goalsAgainst: kind === "goalie" ? numberValue(valueFrom(row, "GA", "goalsAgainst")) : 0,
    raw: row,
  };
}

async function fetchPage(kind: "players" | "goalies", seasonId: string, tournamentId: string) {
  const url = `https://live.hockey.no/statistics/${kind}?seasonId=${encodeURIComponent(seasonId)}&tournamentId=${encodeURIComponent(tournamentId)}`;
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "StangInn/1.0 fantasy-snapshot" } });
  const html = await response.text();
  if (!response.ok) throw new Error(`HockeyLive ${kind} svarte ${response.status}`);
  return { url, response, html };
}

export async function fetchPublicHockeyLiveSeasonStats(options?: { seasonId?: string; tournamentId?: string }) {
  const seasonId = options?.seasonId || process.env.HOCKEYLIVE_SEASON_ID || "201071";
  const tournamentId = options?.tournamentId || process.env.HOCKEYLIVE_TOURNAMENT_ID || "448981";
  const [playersPage, goaliesPage] = await Promise.all([
    fetchPage("players", seasonId, tournamentId),
    fetchPage("goalies", seasonId, tournamentId),
  ]);
  const skaterSource = [...candidateRows(playersPage.html), ...tableRows(playersPage.html)];
  const goalieSource = [...candidateRows(goaliesPage.html), ...tableRows(goaliesPage.html)];
  const skaters = skaterSource.map((row) => normalizeRow(row, "skater")).filter(Boolean) as PublicSeasonStat[];
  const goalies = goalieSource.map((row) => normalizeRow(row, "goalie")).filter(Boolean) as PublicSeasonStat[];
  const unique = (rows: PublicSeasonStat[]) => [...new Map(rows.map((row) => [`${row.kind}:${row.playerKey}`, row])).values()];
  return { seasonId, tournamentId, skaters: unique(skaters), goalies: unique(goalies) };
}

export async function probePublicHockeyLiveStats(options?: { seasonId?: string; tournamentId?: string }): Promise<PublicStatsProbe> {
  const seasonId = options?.seasonId || process.env.HOCKEYLIVE_SEASON_ID || "201071";
  const tournamentId = options?.tournamentId || process.env.HOCKEYLIVE_TOURNAMENT_ID || "448981";
  const { url, response, html } = await fetchPage("players", seasonId, tournamentId);
  const json = embeddedJson(html);
  const candidates = candidateRows(html);
  return { source: "public-hockeylive", url, status: response.status, contentType: response.headers.get("content-type"), htmlLength: html.length, embeddedJsonObjects: json.length, candidateRows: candidates.slice(0, 25), tableHeaders: tableHeaders(html) };
}
