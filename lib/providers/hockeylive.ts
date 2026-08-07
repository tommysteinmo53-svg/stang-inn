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

function extractScriptUrls(html: string): string[] {
  const urls = new Set<string>();
  const re = /<script[^>]+src=["']([^"']+)["']/gi;
  for (const match of html.matchAll(re)) {
    try { urls.add(new URL(match[1], HOCKEYLIVE_BASE).toString()); } catch { /* ignore */ }
  }
  return [...urls];
}

function extractApiCandidates(source: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /https?:\\?\/\\?\/[^"'`\s]{5,180}/g,
    /["'`]([^"'`]{0,80}(?:api|schedule|match|tournament|season)[^"'`]{0,120})["'`]/gi,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const raw = (match[1] || match[0]).replace(/\\\//g, "/");
      if (raw.length < 5 || raw.length > 220) continue;
      if (/sourceMappingURL|webpack|google|sentry|favicon|manifest/i.test(raw)) continue;
      if (/(api|schedule|match|tournament|season)/i.test(raw)) found.add(raw);
      if (found.size >= 20) break;
    }
    if (found.size >= 20) break;
  }
  return [...found];
}

async function diagnoseBundles(html: string): Promise<{ scripts: string[]; candidates: string[] }> {
  const scripts = extractScriptUrls(html).slice(0, 16);
  const candidates = new Set<string>();

  await Promise.all(scripts.map(async (url) => {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "StangInn/0.7 (+https://stang-inn-xi.vercel.app)" },
        cache: "no-store",
      });
      if (!response.ok) return;
      const text = await response.text();
      for (const candidate of extractApiCandidates(text)) {
        candidates.add(candidate);
        if (candidates.size >= 20) break;
      }
    } catch {
      // Diagnostics are best-effort only.
    }
  }));

  return { scripts, candidates: [...candidates].slice(0, 20) };
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
          "User-Agent": "StangInn/0.7 (+https://stang-inn-xi.vercel.app)",
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
      if (unique.size === 0) {
        const diagnostics = await diagnoseBundles(html);
        const candidateText = diagnostics.candidates.length
          ? diagnostics.candidates.join(" | ")
          : "ingen kandidater funnet";
        throw new Error(
          `HockeyLive diagnostikk: fant ${diagnostics.scripts.length} JS-filer. ` +
          `Mulige dataendepunkter: ${candidateText}`,
        );
      }

      return [...unique.values()].sort((a, b) => a.matchTime.localeCompare(b.matchTime));
    },
  };
}
