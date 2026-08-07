import type { ImportedMatch, MatchProvider } from "../../types/data-provider";

const HOCKEYLIVE_BASE = "https://live.hockey.no";
const DEFAULT_SEASON_ID = "201071";
const DEFAULT_TOURNAMENT_ID = "448981";
const DEFAULT_SEASON_LABEL = "2026/27";

type AnyObject = Record<string, any>;

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

function asIsoDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function looksLikeMatch(obj: AnyObject) {
  const home = first(obj.homeTeamName, obj.HomeTeamName, obj.homeTeam?.name, obj.HomeTeam?.name, obj.home?.name);
  const away = first(obj.awayTeamName, obj.AwayTeamName, obj.awayTeam?.name, obj.AwayTeam?.name, obj.away?.name);
  const id = first(obj.matchId, obj.MatchId, obj.MatchID, obj.id, obj.Id);
  return Boolean(home && away && id);
}

function normalize(raw: AnyObject, seasonLabel: string): ImportedMatch | null {
  const externalId = String(first(raw.matchId, raw.MatchId, raw.MatchID, raw.id, raw.Id) ?? "");
  const homeTeam = first(raw.homeTeamName, raw.HomeTeamName, raw.homeTeam?.name, raw.HomeTeam?.name, raw.home?.name);
  const awayTeam = first(raw.awayTeamName, raw.AwayTeamName, raw.awayTeam?.name, raw.AwayTeam?.name, raw.away?.name);
  const matchTime = asIsoDate(first(
    raw.matchStartDate,
    raw.MatchStartDate,
    raw.matchDate,
    raw.MatchDate,
    raw.startDate,
    raw.StartDate,
    raw.date,
    raw.Date,
    raw.startTime,
  ));
  const round = asNumber(first(raw.round, raw.Round, raw.roundNumber, raw.RoundNumber, raw.roundNo, raw.RoundNo));
  const homeScore = asNumber(first(raw.homeTeamGoals, raw.HomeTeamGoals, raw.homeScore, raw.HomeScore, raw.homeGoals));
  const awayScore = asNumber(first(raw.awayTeamGoals, raw.AwayTeamGoals, raw.awayScore, raw.AwayScore, raw.awayGoals));

  if (!externalId || !homeTeam || !awayTeam || !matchTime) return null;

  return {
    externalId: `hockeylive:${externalId}`,
    season: seasonLabel,
    round,
    homeTeam: String(homeTeam),
    awayTeam: String(awayTeam),
    matchTime,
    homeScore,
    awayScore,
    finished: homeScore !== null && awayScore !== null,
  };
}

function collectMatchObjects(value: unknown, output: AnyObject[] = [], seen = new Set<unknown>()): AnyObject[] {
  if (!value || typeof value !== "object" || seen.has(value)) return output;
  seen.add(value);

  if (!Array.isArray(value) && looksLikeMatch(value as AnyObject)) output.push(value as AnyObject);

  if (Array.isArray(value)) {
    for (const item of value) collectMatchObjects(item, output, seen);
  } else {
    for (const child of Object.values(value as AnyObject)) collectMatchObjects(child, output, seen);
  }
  return output;
}

function extractJsonScripts(html: string): unknown[] {
  const payloads: unknown[] = [];
  const scriptRegex = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptRegex)) {
    try { payloads.push(JSON.parse(match[1])); } catch { /* ignore non-JSON */ }
  }

  const nextData = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextData?.[1]) {
    try { payloads.push(JSON.parse(nextData[1])); } catch { /* ignore */ }
  }
  return payloads;
}

function extractScriptUrls(html: string, pageUrl: string): string[] {
  const urls = new Set<string>();
  const regex = /<script[^>]+src=["']([^"']+\.js(?:\?[^"']*)?)["']/gi;
  for (const match of html.matchAll(regex)) {
    try { urls.add(new URL(match[1], pageUrl).toString()); } catch { /* ignore */ }
  }
  return [...urls];
}

function cleanCandidate(value: string): string | null {
  const cleaned = value
    .replace(/\\\//g, "/")
    .replace(/\\u002F/gi, "/")
    .replace(/\\x2F/gi, "/")
    .trim();
  if (cleaned.length < 4 || cleaned.length > 180) return null;
  if (/\s/.test(cleaned)) return null;
  return cleaned;
}

function extractApiDiagnostics(js: string): { baseUrls: string[]; paths: string[]; keywords: string[] } {
  const baseUrls = new Set<string>();
  const paths = new Set<string>();
  const keywords = new Set<string>();

  for (const match of js.matchAll(/https?:\\?\/\\?\/[^"'`\\\s,;)}]+/gi)) {
    const candidate = cleanCandidate(match[0]);
    if (candidate && /(api|hockey|data|ta)/i.test(candidate)) baseUrls.add(candidate);
  }

  for (const match of js.matchAll(/(?:baseURL|baseUrl)\s*[:=]\s*["'`]([^"'`]+)["'`]/gi)) {
    const candidate = cleanCandidate(match[1]);
    if (candidate) baseUrls.add(candidate);
  }

  for (const match of js.matchAll(/["'`]((?:\/?)(?:api|ta)\/[A-Za-z0-9_?=&/${}.:+-]+)["'`]/g)) {
    const candidate = cleanCandidate(match[1]);
    if (candidate) paths.add(candidate);
  }

  for (const match of js.matchAll(/["'`]([^"'`]{0,70}(?:TournamentMatches|Matches|Schedule|Scheduler|Tournaments|Standings)[^"'`]{0,70})["'`]/gi)) {
    const candidate = cleanCandidate(match[1]);
    if (candidate) keywords.add(candidate);
  }

  return {
    baseUrls: [...baseUrls].slice(0, 12),
    paths: [...paths].slice(0, 30),
    keywords: [...keywords].slice(0, 20),
  };
}

export function createHockeyLiveProvider(): MatchProvider {
  return {
    name: "hockeylive",
    async fetchMatches() {
      const seasonId = process.env.HOCKEYLIVE_SEASON_ID || DEFAULT_SEASON_ID;
      const tournamentId = process.env.HOCKEYLIVE_TOURNAMENT_ID || DEFAULT_TOURNAMENT_ID;
      const seasonLabel = process.env.NIF_SEASON_LABEL || DEFAULT_SEASON_LABEL;
      const url = `${HOCKEYLIVE_BASE}/schedule?seasonId=${encodeURIComponent(seasonId)}&tournamentId=${encodeURIComponent(tournamentId)}`;

      const response = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "StangInn/0.6 (+https://stang-inn-xi.vercel.app)",
        },
        cache: "no-store",
      });

      if (!response.ok) throw new Error(`HockeyLive svarte ${response.status}`);
      const html = await response.text();

      const payloads = extractJsonScripts(html);
      const rawMatches = payloads.flatMap((payload) => collectMatchObjects(payload));
      const normalized = rawMatches
        .map((raw) => normalize(raw, seasonLabel))
        .filter(Boolean) as ImportedMatch[];

      const unique = new Map(normalized.map((match) => [match.externalId, match]));
      if (unique.size > 0) {
        return [...unique.values()].sort((a, b) => a.matchTime.localeCompare(b.matchTime));
      }

      const scriptUrls = extractScriptUrls(html, url);
      const foundBaseUrls = new Set<string>();
      const foundPaths = new Set<string>();
      const foundKeywords = new Set<string>();

      for (const scriptUrl of scriptUrls.slice(0, 12)) {
        try {
          const jsResponse = await fetch(scriptUrl, {
            headers: { "User-Agent": "StangInn/0.6 (+https://stang-inn-xi.vercel.app)" },
            cache: "no-store",
          });
          if (!jsResponse.ok) continue;
          const js = await jsResponse.text();
          const diagnostics = extractApiDiagnostics(js);
          diagnostics.baseUrls.forEach((x) => foundBaseUrls.add(x));
          diagnostics.paths.forEach((x) => foundPaths.add(x));
          diagnostics.keywords.forEach((x) => foundKeywords.add(x));
        } catch { /* diagnostic fetch only */ }
      }

      const bases = [...foundBaseUrls].slice(0, 10);
      const paths = [...foundPaths].slice(0, 25);
      const keywords = [...foundKeywords].slice(0, 15);

      throw new Error(
        `HockeyLive API-diagnostikk: JS-filer=${scriptUrls.length}. ` +
        `Base-URLer=[${bases.join(" | ") || "ingen"}]. ` +
        `API-stier=[${paths.join(" | ") || "ingen"}]. ` +
        `Relevante strenger=[${keywords.join(" | ") || "ingen"}].`,
      );
    },
  };
}
