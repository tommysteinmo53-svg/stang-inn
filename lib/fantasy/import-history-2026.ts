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
  source: "EliteProspects" | "ClubOfficial";
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
  Slovakia: 0.86,
  ECHL: 0.84,
  EIHL: 0.82,
  "Metal Ligaen": 0.80,
  Poland: 0.78,
  HockeyEttan: 0.72,
  Mestis: 0.76,
  NAHL: 0.68,
  Norway2: 0.66,
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
  "Case McCarthy": {
    kind: "skater", season: "2025/26", previousTeam: "Worcester Railers",
    league: "ECHL", games: 18, goals: 4, assists: 6, points: 10,
    source: "EliteProspects", sourceNote: "2025/26 ECHL regular season; also appeared in AHL"
  },
  "Carl Ludvig Rensfeldt": {
    kind: "skater", season: "2025/26", previousTeam: "Djurgårdens IF",
    league: "SHL", games: 51, goals: 2, assists: 2, points: 4,
    source: "EliteProspects", sourceNote: "EP lists Ludvig Rensfeldt (C); fantasy roster uses W"
  },
  "Daniel Lebedeff": {
    kind: "goalie", season: "2025/26", previousTeam: "HK 32 Liptovsky Mikulas",
    league: "Slovakia", games: 25, savePct: 0.898, gaa: 3.15,
    source: "EliteProspects", sourceNote: "2025/26 Slovak Extraliga regular season"
  },
  "Eirik Østrem Salsten": {
    kind: "skater", season: "2025/26", previousTeam: "Iserlohn Roosters",
    league: "DEL", games: 52, goals: 8, assists: 12, points: 20,
    source: "ClubOfficial", sourceNote: "PENNY DEL official 2025/26 regular-season statistics; returning Storhamar player with extensive prior EHL history"
  },
  "Kristoffer Gunnarsson": {
    kind: "skater", season: "2025/26", previousTeam: "Mora IK",
    league: "HockeyAllsvenskan", games: 52, goals: 3, assists: 10, points: 13,
    source: "EliteProspects", sourceNote: "2025/26 HockeyAllsvenskan regular season"
  },
  "Tyler Parks": {
    kind: "goalie", season: "2025/26", previousTeam: "HK Poprad",
    league: "Slovakia", games: 21, savePct: 0.921, gaa: 2.18,
    source: "EliteProspects", sourceNote: "2025/26 Slovak Extraliga regular season"
  },
  "Viljami Arvid Juusola": {
    kind: "skater", season: "2025/26", previousTeam: "Kärpät",
    league: "Liiga", games: 25, goals: 1, assists: 5, points: 6,
    source: "EliteProspects", sourceNote: "2025/26 Liiga regular season"
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
  "Jack Avery York": {
    kind: "skater", season: "2025/26", previousTeam: "AIK",
    league: "HockeyAllsvenskan", games: 37, goals: 2, assists: 5, points: 7,
    source: "EliteProspects", sourceNote: "2025/26 HockeyAllsvenskan regular season"
  },
  "Anton Karl Yngve Hjalmarsson": {
    kind: "goalie", season: "2025/26", previousTeam: "Boden Hockey",
    league: "HockeyEttan", games: 20, savePct: 0.907, gaa: 2.08,
    source: "ClubOfficial", sourceNote: "2025/26 HockeyEttan regular season; verified against published league statistics"
  },
  "Faustas Nauseda": {
    kind: "goalie", season: "2025/26", previousTeam: "Pyry Hockey",
    league: "Mestis", games: 32, savePct: 0.897, gaa: 2.98,
    source: "EliteProspects", sourceNote: "2025/26 Mestis regular season"
  },
  "Lars Volden": {
    kind: "goalie", season: "2025/26", previousTeam: "BIK Karlskoga",
    league: "HockeyAllsvenskan", games: 22, savePct: 0.9161, gaa: 1.95,
    source: "ClubOfficial", sourceNote: "BIK Karlskoga/HockeyAllsvenskan official 2025/26 regular-season statistics; 22 appearances, 91.61 SV%, 1.95 GAA"
  },
  "Alexander Anderberg": {
    kind: "skater", season: "2025/26", previousTeam: "Östersunds IK",
    league: "HockeyAllsvenskan", games: 49, goals: 6, assists: 23, points: 29,
    source: "ClubOfficial", sourceNote: "Östersunds IK official career statistics; 2025/26 HockeyAllsvenskan regular season"
  },
  "Adam Isac Bäckstrand": {
    kind: "skater", season: "2025/26", previousTeam: "Tingsryds AIF",
    league: "HockeyEttan", games: 38, goals: 10, assists: 16, points: 26,
    source: "EliteProspects", sourceNote: "2025/26 HockeyEttan overall regular-season totals"
  },
  "Mathias Despotovic Kristiansen": {
    kind: "skater", season: "2025/26", previousTeam: "NAHL",
    league: "NAHL", games: 42, goals: 3, assists: 4, points: 7,
    source: "EliteProspects", sourceNote: "2025/26 NAHL totals; 42 GP, 3 G, 4 A, 7 P; cross-checked against published NAHL aggregate statistics"
  },
  "Niilo Ensio Halonen": {
    kind: "goalie", season: "2025/26", previousTeam: "Zagłębie Sosnowiec",
    league: "Poland", games: 25, savePct: 0.926, gaa: 2.15,
    source: "ClubOfficial", sourceNote: "2025/26 Polish regular season: 25 GP, 92.6 SV%, 2.15 GAA; also 11 playoff GP at 91.7 SV% and 2.62 GAA"
  },
  "Oliver Tufte Langland": {
    kind: "skater", season: "2025/26", previousTeam: "Grüner",
    league: "Norway2", games: 28, goals: 14, assists: 14, points: 28,
    source: "EliteProspects", sourceNote: "2025/26 Norway2 regular-season totals"
  },
  "Erlend Sletmoe-Kjærnet": {
    kind: "skater", season: "2025/26", previousTeam: "Grüner",
    league: "Norway2", games: 34, goals: 3, assists: 13, points: 16,
    source: "EliteProspects", sourceNote: "2025/26 Norway2 regular-season totals"
  },
  "Alieu Moldal Bah": {
    kind: "skater", season: "2025/26", previousTeam: "Strömsbro IF",
    league: "HockeyEttan", games: 4, goals: 1, assists: 1, points: 2,
    source: "EliteProspects", sourceNote: "2025/26 senior HockeyEttan sample; also played Brynäs IF U20"
  },
};

export function importHistoryFor(name: string): ImportHistory | null {
  return IMPORT_HISTORY_2026[name] ?? null;
}

export function leagueStrength(league: string): number | null {
  const value = LEAGUE_STRENGTH[league];
  return Number.isFinite(value) ? value : null;
}
