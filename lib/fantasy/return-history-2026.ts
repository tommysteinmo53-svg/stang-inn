export type ReturnPlayerHistory = {
  previousTeam: string;
  league: "EHL";
  seasonsNote: string;
  seniorGames: number;
  seniorPoints?: number;
  source: "EliteProspects" | "ClubOfficial" | "ManualVerified";
  sourceNote?: string;
};

// Separate cache for players who are not true imports, but whose latest-season
// sample is too thin to represent their established Norwegian senior history.
export const RETURN_HISTORY_2026: Record<string, ReturnPlayerHistory> = {
  "Bård Valstad Solheim": {
    previousTeam: "Nidaros Hockey", league: "EHL",
    seasonsNote: "Established Nidaros senior history prior to 2026/27; 2025/26 sample is only 2 EHL games",
    seniorGames: 54, seniorPoints: 20, source: "EliteProspects",
    sourceNote: "Career senior total for Nidaros used only as a return-player prior; do not treat 54 GP / 20 P as 2025/26 statistics",
  },
  "Eirik Østrem Salsten": {
    previousTeam: "Storhamar", league: "EHL",
    seasonsNote: "Returning Norwegian top-six forward with prior production around one point per game in Norway; external-league translation must not erase established EHL scoring level.",
    seniorGames: 1, seniorPoints: 1, source: "ManualVerified",
    sourceNote: "Scouting/return-player prior only. Placeholder 1 GP / 1 P encodes the verified ~1.0 P/GP level without pretending it is a season stat; replace with exact historical EHL totals when cache is expanded.",
  },
};
export function returnHistoryFor(name:string):ReturnPlayerHistory|null{return RETURN_HISTORY_2026[name]??null}
