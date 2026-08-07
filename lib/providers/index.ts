import type { ImportedMatch, MatchProvider } from "../../types/data-provider";
import { createHockeyLiveProvider } from "./hockeylive";
import { createManualProvider } from "./manual";
import { createNifProvider } from "./nif";

export type ProviderName = "hockeylive" | "nif" | "manual";

export function getMatchProvider(name: ProviderName, manualMatches: ImportedMatch[] = []): MatchProvider {
  if (name === "manual") return createManualProvider(manualMatches);
  if (name === "nif") return createNifProvider();
  return createHockeyLiveProvider();
}
