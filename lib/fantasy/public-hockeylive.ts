type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

type Candidate = Record<string, unknown>;

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
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function looksLikeStatRow(value: Candidate) {
  const keys = Object.keys(value).map((key) => key.toLowerCase());
  const hasPlayer = keys.some((key) => ["player", "playername", "name", "fullname", "personname"].includes(key));
  const statHits = ["goals", "assists", "plusminus", "pim", "shots", "shotstarget", "shotsongoal", "saves", "goalsagainst", "gp", "gamesplayed"]
    .filter((needle) => keys.some((key) => key.replace(/[_-]/g, "").includes(needle))).length;
  return hasPlayer && statHits >= 2;
}

function walk(value: Json, output: Candidate[], seen: Set<object>) {
  if (!value || typeof value !== "object") return;
  if (seen.has(value as object)) return;
  seen.add(value as object);

  if (!Array.isArray(value) && looksLikeStatRow(value as Candidate)) {
    output.push(value as Candidate);
  }

  if (Array.isArray(value)) {
    for (const item of value) walk(item, output, seen);
    return;
  }

  for (const item of Object.values(value)) walk(item, output, seen);
}

function embeddedJson(html: string): Json[] {
  const results: Json[] = [];
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptRegex)) {
    const text = match[1]?.trim();
    if (!text) continue;

    const attempts = [text];
    const assignments = ["__NEXT_DATA__", "__NUXT__", "window.__INITIAL_STATE__", "window.__APOLLO_STATE__"];
    for (const marker of assignments) {
      const index = text.indexOf(marker);
      if (index >= 0) {
        const brace = text.indexOf("{", index);
        const bracket = text.indexOf("[", index);
        const start = [brace, bracket].filter((x) => x >= 0).sort((a, b) => a - b)[0];
        if (start !== undefined) attempts.push(text.slice(start).replace(/;\s*$/, ""));
      }
    }

    for (const attempt of attempts) {
      if (!(attempt.startsWith("{") || attempt.startsWith("["))) continue;
      try {
        results.push(JSON.parse(attempt));
        break;
      } catch {
        // Ignore non-JSON scripts. The endpoint is only a diagnostic/fallback probe.
      }
    }
  }
  return results;
}

function tableHeaders(html: string) {
  const headers: string[] = [];
  const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
  for (const match of html.matchAll(thRegex)) {
    const value = stripTags(match[1] || "");
    if (value && !headers.includes(value)) headers.push(value);
  }
  return headers.slice(0, 40);
}

export async function probePublicHockeyLiveStats(options?: { seasonId?: string; tournamentId?: string }) : Promise<PublicStatsProbe> {
  const seasonId = options?.seasonId || process.env.HOCKEYLIVE_SEASON_ID || "201059";
  const tournamentId = options?.tournamentId || process.env.HOCKEYLIVE_TOURNAMENT_ID || "435587";
  const url = `https://live.hockey.no/statistics/players?seasonId=${encodeURIComponent(seasonId)}&tournamentId=${encodeURIComponent(tournamentId)}`;

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "StangInn/1.0 fantasy-public-probe",
    },
  });
  const html = await response.text();
  const json = embeddedJson(html);
  const candidates: Candidate[] = [];
  const seen = new Set<object>();
  for (const item of json) walk(item, candidates, seen);

  return {
    source: "public-hockeylive",
    url,
    status: response.status,
    contentType: response.headers.get("content-type"),
    htmlLength: html.length,
    embeddedJsonObjects: json.length,
    candidateRows: candidates.slice(0, 25),
    tableHeaders: tableHeaders(html),
  };
}
