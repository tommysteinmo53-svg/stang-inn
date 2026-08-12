export type ImportSkaterHistory = {
  kind: "skater";
  season: "2025/26";
  previousTeam: string;
  league: string;
  games: number;
  goals: number;
  assists: number;
  points: number;
  source: "EliteProspects" | "SHL" | "ClubOfficial";
  sourceNote?: string;
};

export type ImportGoalieHistory = {
  kind: "goalie";
  season: "2025/26";
  previousTeam: string;
  league: string;
  games: number;
  savePct: number;
  gaa: number;
  source: "EliteProspects";
  sourceNote?: string;
};

export type ImportHistory = ImportSkaterHistory | ImportGoalieHistory;

// Conservative league-strength multipliers for translation into EHL fantasy value.
// These are not 1:1 scoring equivalencies; they only scale the size of the
// adjustment away from the existing EHL positional-median prior.
export const LEAGUE_STRENGTH: Record<string, number> = {
  NHL: 1.30,
  AHL: 1.16,
  SHL: 1.08,
  Liiga: 1.06,
  NL: 1.06,
  DEL: 0.98,
  HockeyAllsvenskan: 0.88,
  ICEHL: 0.86,
  ECHL: 0.84,
  EIHL: 0.82,
  "Metal Ligaen": 0.80,
  HockeyEttan: 0.72,
  Mestis: 0.76,
};

// Versioned, manually verified previous-season import cache.
// Runtime scraping is intentionally avoided because EliteProspects blocks Vercel.
// Only add rows when previous-season senior statistics are reliably verified.
export const IMPORT_HISTORY_2026: Record<string, ImportHistory> = {
  "Albin Erik Eriksson": {
    kind: "skater", season: "2025/26", previousTeam: "Almtuna IS",
    league: "HockeyAllsvenskan", games: 42, goals: 8, assists: 4, points: 12,
    source: "ClubOfficial", sourceNote: "Almtuna official player profile; 2025/26 HockeyAllsvenskan regular season"
  },
  "Sebastian Dyk": {
    kind: "skater", season: "2025/26", previousTeam: "Södertälje SK",
    league: "HockeyAllsvenskan", games: 51, goals: 16, assists: 19, points: 35,
    source: "EliteProspects", sourceNote: "2025/26 regular season"
  },
  "Anton Gradin": {
    kind: "skater", season: "2025/26", previousTeam: "IF Troja-Ljungby",
    league: "HockeyAllsvenskan", games: 31, goals: 9, assists: 3, points: 12,
    source: "EliteProspects", sourceNote: "2025/26 regular season"
  },
  "Carl Ludvig Rensfeldt": {
    kind: "skater", season: "2025/26", previousTeam: "Djurgårdens IF",
    league: "SHL", games: 51, goals: 2, assists: 2, points: 4,
    source: "EliteProspects", sourceNote: "EP lists Ludvig Rensfeldt (C); fantasy roster uses W"
  },
  "Juuso Vainio": {
    kind: "skater", season: "2025/26", previousTeam: "Örebro HK",
    league: "SHL", games: 28, goals: 0, assists: 2, points: 2,
    source: "SHL", sourceNote: "SHL career statistics, 2025/26 regular season"
  },
  "Pathrik Westerholm": {
    kind: "skater", season: "2025/26", previousTeam: "Lukko",
    league: "Liiga", games: 45, goals: 3, assists: 14, points: 17,
    source: "EliteProspects", sourceNote: "2025/26 regular season"
  },
  "Ponthus Westerholm": {
    kind: "skater", season: "2025/26", previousTeam: "Lukko",
    league: "Liiga", games: 57, goals: 12, assists: 11, points: 23,
    source: "EliteProspects", sourceNote: "2025/26 regular season"
  },
  "Zachary Émond": {
    kind: "goalie", season: "2025/26", previousTeam: "Pelicans",
    league: "Liiga", games: 17, savePct: 0.894, gaa: 2.83,
    source: "EliteProspects", sourceNote: "2025/26 regular season"
  },
};

export function importHistoryFor(name: string): ImportHistory | null {
  return IMPORT_HISTORY_2026[name] ?? null;
}

export function leagueStrength(league: string): number | null {
  const value = LEAGUE_STRENGTH[league];
  return Number.isFinite(value) ? value : null;
}
