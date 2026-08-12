export type ReturnPlayerHistory = {
  previousTeam: string;
  league: "EHL";
  seasonsNote: string;
  seniorGames: number;
  seniorPoints?: number;
  source: "EliteProspects" | "ClubOfficial";
  sourceNote?: string;
};

// Separate cache for players who are not true imports, but whose latest-season
// sample is too thin to represent their established Norwegian senior history.
// This is intentionally kept out of IMPORT_HISTORY_2026 so we do not relabel
// multi-season EHL history as 2025/26 import production.
export const RETURN_HISTORY_2026: Record<string, ReturnPlayerHistory> = {
  "Bård Valstad Solheim": {
    previousTeam: "Nidaros Hockey",
    league: "EHL",
    seasonsNote: "Established Nidaros senior history prior to 2026/27; 2025/26 sample is only 2 EHL games",
    seniorGames: 54,
    seniorPoints: 20,
    source: "EliteProspects",
    sourceNote: "Career senior total for Nidaros used only as a return-player prior; do not treat 54 GP / 20 P as 2025/26 statistics",
  },
};

export function returnHistoryFor(name: string): ReturnPlayerHistory | null {
  return RETURN_HISTORY_2026[name] ?? null;
}
