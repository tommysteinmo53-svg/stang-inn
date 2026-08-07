export type ImportedMatch = {
  externalId: string;
  season: string;
  round: number | null;
  homeTeam: string;
  awayTeam: string;
  matchTime: string;
  homeScore: number | null;
  awayScore: number | null;
  finished: boolean;
};

export type MatchProvider = {
  name: string;
  fetchMatches(): Promise<ImportedMatch[]>;
};
