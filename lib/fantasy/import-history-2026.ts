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
  Mestis: 0.76,
  Latvia: 0.74,
  HockeyEttan: 0.72,
  NAHL: 0.68,
  Norway2: 0.66,
  USHL: 0.66,
  "J20 Nationell": 0.58,
  "Norway U20": 0.52,
  "Norway U18": 0.44,
};

// Versioned, manually verified previous-season import cache.
// Runtime scraping is intentionally avoided because EliteProspects blocks Vercel.
// Only add rows when previous-season statistics are reliably verified.
export const IMPORT_HISTORY_2026: Record<string, ImportHistory> = {
  "Albin Erik Eriksson": { kind: "skater", season: "2025/26", previousTeam: "Almtuna IS", league: "HockeyAllsvenskan", games: 42, goals: 8, assists: 4, points: 12, source: "ClubOfficial", sourceNote: "Almtuna official player profile; 2025/26 HockeyAllsvenskan regular season" },
  "Sebastian Dyk": { kind: "skater", season: "2025/26", previousTeam: "Södertälje SK", league: "HockeyAllsvenskan", games: 51, goals: 16, assists: 19, points: 35, source: "EliteProspects", sourceNote: "2025/26 regular season" },
  "Anton Gradin": { kind: "skater", season: "2025/26", previousTeam: "IF Troja-Ljungby", league: "HockeyAllsvenskan", games: 31, goals: 9, assists: 3, points: 12, source: "EliteProspects", sourceNote: "2025/26 regular season" },
  "Case McCarthy": { kind: "skater", season: "2025/26", previousTeam: "Worcester Railers", league: "ECHL", games: 18, goals: 4, assists: 6, points: 10, source: "EliteProspects", sourceNote: "2025/26 ECHL regular season; also appeared in AHL" },
  "Carl Ludvig Rensfeldt": { kind: "skater", season: "2025/26", previousTeam: "Djurgårdens IF", league: "SHL", games: 51, goals: 2, assists: 2, points: 4, source: "EliteProspects", sourceNote: "EP lists Ludvig Rensfeldt (C); fantasy roster uses W" },
  "Daniel Lebedeff": { kind: "goalie", season: "2025/26", previousTeam: "HK 32 Liptovsky Mikulas", league: "Slovakia", games: 25, savePct: 0.898, gaa: 3.15, source: "EliteProspects", sourceNote: "2025/26 Slovak Extraliga regular season" },
  "Eirik Østrem Salsten": { kind: "skater", season: "2025/26", previousTeam: "Iserlohn Roosters", league: "DEL", games: 52, goals: 8, assists: 12, points: 20, source: "ClubOfficial", sourceNote: "PENNY DEL official 2025/26 regular-season statistics; returning Storhamar player with extensive prior EHL history" },
  "Kristoffer Gunnarsson": { kind: "skater", season: "2025/26", previousTeam: "Mora IK", league: "HockeyAllsvenskan", games: 52, goals: 3, assists: 10, points: 13, source: "EliteProspects", sourceNote: "2025/26 HockeyAllsvenskan regular season" },
  "Tyler Parks": { kind: "goalie", season: "2025/26", previousTeam: "HK Poprad", league: "Slovakia", games: 21, savePct: 0.921, gaa: 2.18, source: "EliteProspects", sourceNote: "2025/26 Slovak Extraliga regular season" },
  "Viljami Arvid Juusola": { kind: "skater", season: "2025/26", previousTeam: "Kärpät", league: "Liiga", games: 25, goals: 1, assists: 5, points: 6, source: "EliteProspects", sourceNote: "2025/26 Liiga regular season" },
  "Juuso Vainio": { kind: "skater", season: "2025/26", previousTeam: "Örebro HK", league: "SHL", games: 28, goals: 0, assists: 2, points: 2, source: "SHL", sourceNote: "SHL career statistics, 2025/26 regular season" },
  "Pathrik Westerholm": { kind: "skater", season: "2025/26", previousTeam: "Lukko", league: "Liiga", games: 45, goals: 3, assists: 14, points: 17, source: "EliteProspects", sourceNote: "2025/26 regular season" },
  "Ponthus Westerholm": { kind: "skater", season: "2025/26", previousTeam: "Lukko", league: "Liiga", games: 57, goals: 12, assists: 11, points: 23, source: "EliteProspects", sourceNote: "2025/26 regular season" },
  "Zachary Émond": { kind: "goalie", season: "2025/26", previousTeam: "Pelicans", league: "Liiga", games: 17, savePct: 0.894, gaa: 2.83, source: "EliteProspects", sourceNote: "2025/26 regular season" },
  "Jack Avery York": { kind: "skater", season: "2025/26", previousTeam: "AIK", league: "HockeyAllsvenskan", games: 37, goals: 2, assists: 5, points: 7, source: "EliteProspects", sourceNote: "2025/26 HockeyAllsvenskan regular season" },
  "Anton Karl Yngve Hjalmarsson": { kind: "goalie", season: "2025/26", previousTeam: "Boden Hockey", league: "HockeyEttan", games: 20, savePct: 0.907, gaa: 2.08, source: "ClubOfficial", sourceNote: "2025/26 HockeyEttan regular season; verified against published league statistics" },
  "Faustas Nauseda": { kind: "goalie", season: "2025/26", previousTeam: "Pyry Hockey", league: "Mestis", games: 32, savePct: 0.897, gaa: 2.98, source: "EliteProspects", sourceNote: "2025/26 Mestis regular season" },
  "Lars Volden": { kind: "goalie", season: "2025/26", previousTeam: "BIK Karlskoga", league: "HockeyAllsvenskan", games: 22, savePct: 0.9161, gaa: 1.95, source: "ClubOfficial", sourceNote: "BIK Karlskoga/HockeyAllsvenskan official 2025/26 regular-season statistics; 22 appearances, 91.61 SV%, 1.95 GAA" },
  "Alexander Anderberg": { kind: "skater", season: "2025/26", previousTeam: "Östersunds IK", league: "HockeyAllsvenskan", games: 49, goals: 6, assists: 23, points: 29, source: "ClubOfficial", sourceNote: "Östersunds IK official career statistics; 2025/26 HockeyAllsvenskan regular season" },
  "Adam Isac Bäckstrand": { kind: "skater", season: "2025/26", previousTeam: "Tingsryds AIF", league: "HockeyEttan", games: 38, goals: 10, assists: 16, points: 26, source: "EliteProspects", sourceNote: "2025/26 HockeyEttan overall regular-season totals" },
  "Mathias Despotovic Kristiansen": { kind: "skater", season: "2025/26", previousTeam: "NAHL", league: "NAHL", games: 42, goals: 3, assists: 4, points: 7, source: "EliteProspects", sourceNote: "2025/26 NAHL totals; 42 GP, 3 G, 4 A, 7 P; cross-checked against published NAHL aggregate statistics" },
  "Niilo Ensio Halonen": { kind: "goalie", season: "2025/26", previousTeam: "Zagłębie Sosnowiec", league: "Poland", games: 25, savePct: 0.926, gaa: 2.15, source: "ClubOfficial", sourceNote: "2025/26 Polish regular season: 25 GP, 92.6 SV%, 2.15 GAA; also 11 playoff GP at 91.7 SV% and 2.62 GAA" },
  "Oliver Tufte Langland": { kind: "skater", season: "2025/26", previousTeam: "Grüner", league: "Norway2", games: 28, goals: 14, assists: 14, points: 28, source: "EliteProspects", sourceNote: "2025/26 Norway2 regular-season totals" },
  "Erlend Sletmoe-Kjærnet": { kind: "skater", season: "2025/26", previousTeam: "Grüner", league: "Norway2", games: 34, goals: 3, assists: 13, points: 16, source: "EliteProspects", sourceNote: "2025/26 Norway2 regular-season totals" },
  "Alieu Moldal Bah": { kind: "skater", season: "2025/26", previousTeam: "Brynäs IF U20", league: "J20 Nationell", games: 34, goals: 5, assists: 11, points: 16, source: "EliteProspects", sourceNote: "2025/26 U20 Nationell regular season; 34 GP, 5 G, 11 A, 16 P. Also 4 GP, 1 G, 1 A in HockeyEttan." },
  "Max Mikael Freyschuss Nordin": { kind: "skater", season: "2025/26", previousTeam: "Ringerike", league: "Norway2", games: 28, goals: 22, assists: 18, points: 40, source: "EliteProspects", sourceNote: "2025/26 Norway2 regular season; Ringerike team statistics" },
  "Tobias Skogstad Falkeid": { kind: "skater", season: "2025/26", previousTeam: "Ringerike", league: "Norway2", games: 32, goals: 11, assists: 23, points: 34, source: "EliteProspects", sourceNote: "2025/26 Norway2 regular season; Ringerike team statistics" },
  "Thomas Bækken": { kind: "skater", season: "2025/26", previousTeam: "Ringerike", league: "Norway2", games: 29, goals: 11, assists: 14, points: 25, source: "EliteProspects", sourceNote: "2025/26 Norway2 regular season; Ringerike team statistics" },
  "Iver Wick Karlsen": { kind: "skater", season: "2025/26", previousTeam: "Ringerike", league: "Norway2", games: 35, goals: 8, assists: 7, points: 15, source: "EliteProspects", sourceNote: "2025/26 Norway2 regular season; Ringerike team statistics" },
  "Jørgen Rønning": { kind: "goalie", season: "2025/26", previousTeam: "Ringerike", league: "Norway2", games: 15, savePct: 0.910, gaa: 1.78, source: "EliteProspects", sourceNote: "2025/26 Norway2 regular season goaltending: 15 GP, 91.0 SV%, 1.78 GAA" },
  "Jakob Aasen Rian": { kind: "skater", season: "2025/26", previousTeam: "Ringerike", league: "Norway2", games: 30, goals: 5, assists: 5, points: 10, source: "EliteProspects", sourceNote: "2025/26 Norway2 regular season; corrected full-season total: 30 GP, 5 G, 5 A, 10 P" },
  "Ludvik Kind Bakkevig": { kind: "skater", season: "2025/26", previousTeam: "Malmö Redhawks J20", league: "J20 Nationell", games: 34, goals: 3, assists: 8, points: 11, source: "EliteProspects", sourceNote: "2025/26 J20 Nationell; junior production translated conservatively into EHL prior" },
  "Viktor Natanael Lundseie Lindholm": { kind: "skater", season: "2025/26", previousTeam: "Gjøvik Hockey", league: "Norway2", games: 32, goals: 11, assists: 18, points: 29, source: "EliteProspects", sourceNote: "Roster name corresponds to Natanael Lindholm; 2025/26 Norway2 regular season, 32 GP, 11 G, 18 A, 29 P" },
  "Evald Lukas Rhodin": { kind: "skater", season: "2025/26", previousTeam: "Gjøvik Hockey", league: "Norway2", games: 34, goals: 1, assists: 9, points: 10, source: "EliteProspects", sourceNote: "EliteProspects lists player as Lukas Rhodin; 2025/26 Norway2 regular season, 34 GP, 1 G, 9 A, 10 P" },
  "Kalle Falch Grotnes": { kind: "goalie", season: "2025/26", previousTeam: "Stjernen Hockey U20", league: "Norway U20", games: 26, savePct: 0.877, gaa: 4.72, source: "EliteProspects", sourceNote: "2025/26 Stjernen U20 overall totals; 26 GP, 87.7 SV%, 4.72 GAA. Junior goalie data translated conservatively." },
  "Theodor Flåm": { kind: "goalie", season: "2025/26", previousTeam: "Stjernen Hockey U18", league: "Norway U18", games: 31, savePct: 0.893, gaa: 3.00, source: "EliteProspects", sourceNote: "2025/26 Stjernen U18 regular season; 31 GP, 89.3 SV%, 3.00 GAA. Junior goalie data translated conservatively." },
  "Mats Simon Hjalmarsson": { kind: "skater", season: "2025/26", previousTeam: "Sport", league: "Liiga", games: 45, goals: 3, assists: 25, points: 28, source: "EliteProspects", sourceNote: "Roster full name corresponds to Simon Hjalmarsson; 2025/26 Liiga regular season, 45 GP, 3 G, 25 A, 28 P" },
  "Elias Straume Vatne": { kind: "skater", season: "2025/26", previousTeam: "Sioux City Musketeers", league: "USHL", games: 56, goals: 13, assists: 17, points: 30, source: "EliteProspects", sourceNote: "2025/26 USHL regular season; 56 GP, 13 G, 17 A, 30 P" },
  "Isak Hansen": { kind: "skater", season: "2025/26", previousTeam: "Vimmerby HC", league: "HockeyAllsvenskan", games: 43, goals: 1, assists: 3, points: 4, source: "EliteProspects", sourceNote: "2025/26 HockeyAllsvenskan regular season; 43 GP, 1 G, 3 A, 4 P" },
  "Rasmus Olsen Brekke": { kind: "skater", season: "2025/26", previousTeam: "Skellefteå AIK U20", league: "J20 Nationell", games: 32, goals: 9, assists: 2, points: 11, source: "EliteProspects", sourceNote: "2025/26 U20 Nationell regular season; 32 GP, 9 G, 2 A, 11 P" },
  "Niks Fenenko": { kind: "skater", season: "2025/26", previousTeam: "HK Mogo", league: "Latvia", games: 18, goals: 8, assists: 23, points: 31, source: "ClubOfficial", sourceNote: "Latvian federation 2025/26 OHL regular season; 18 GP, 8 G, 23 A, 31 P. Playoffs excluded from model row." },
};

export function importHistoryFor(name: string): ImportHistory | null {
  return IMPORT_HISTORY_2026[name] ?? null;
}

export function leagueStrength(league: string): number | null {
  const value = LEAGUE_STRENGTH[league];
  return Number.isFinite(value) ? value : null;
}
