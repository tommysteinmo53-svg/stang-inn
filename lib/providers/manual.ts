import type { ImportedMatch, MatchProvider } from "../../types/data-provider";

export function createManualProvider(matches: ImportedMatch[]): MatchProvider {
  return {
    name: "manual",
    async fetchMatches() {
      return matches;
    },
  };
}
